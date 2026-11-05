import { sayaRequest, SayaApiError } from "./saya.client.js";
import {
  jiosaavnRequest,
  pickBestDownloadUrl,
  extractArtistNames,
  extractImageUrl,
} from "./jiosaavn.client.js";
import {
  mapJioSaavnSong,
  mapJioSaavnFullSong,
  mapAudiusTrack,
  mapJamendoTrack,
  mapAlbums,
  mapArtists,
  mapPlaylists,
  mapTracks,
  asArray,
  normalizePlayableTrack,
} from "./music.mapper.js";
import { isJamendoConfigured, jamendoSearchTracks } from "./jamendo.client.js";
import {
  DEFAULT_TRACK_PROVIDERS,
  DEFAULT_CATALOG_PROVIDERS,
  parseProviderList,
  filterAllowedEntities,
  filterDiscoverableEntities,
  isProviderAllowed,
} from "./providerRegistry.js";
import {
  buildSearchVariants,
  detectSearchIntent,
  stringSimilarity,
  normalizeForMatch,
  lookupOfficialArtists,
} from "./queryNormalize.js";
import {
  isUntrustedCatalogueTrack,
  isLowQualityUpload,
} from "./legacyTrackPolicy.js";
import {
  buildMetadataSearchSeeds,
  creditsMatchOfficial,
} from "./musicMetadata.js";
import {
  fetchCatalogHits,
  catalogMatchBoost,
} from "./catalogOracle.js";
import { runProviderTasks, dedupeInflight } from "./searchOrchestrator.js";

/** Clips at or under this length are treated as previews / stubs — never song rows. */
const MIN_FULL_DURATION_SEC = 46;

const titleTokens = (title = "") =>
  normalizeForMatch(String(title).replace(/\(.*?\)/g, "")).split(/\s+/).filter(Boolean);

/** Query token appears as a whole word (or near-typo) in the title — not a random substring. */
const titleMatchesQueryWord = (title, query) => {
  const q = normalizeForMatch(query);
  if (!q) return false;
  const tokens = titleTokens(title);
  if (!tokens.length) return false;
  if (tokens.includes(q)) return true;
  if (tokens.some((tok) => stringSimilarity(tok, q) >= 0.88)) return true;
  const joined = tokens.join(" ");
  if (joined === q || joined.startsWith(`${q} `) || joined.endsWith(` ${q}`))
    return true;
  return stringSimilarity(joined, q) >= 0.9;
};
import { dedupeTracks, dedupeById } from "./dedupe.js";
import { enrichArtworkIfMissing, isPlaceholderArt } from "./artwork.service.js";
import { appleAdapter, musicbrainzAdapter } from "./adapters/index.js";
import { PlaybackType } from "./adapters/providerAdapter.js";

const mapFullJio = (item) =>
  mapJioSaavnFullSong(item, {
    pickBestDownloadUrl,
    extractArtistNames,
    extractImageUrl,
  });

const emptyResult = (query, type) => ({
  query,
  type,
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  podcasts: [],
  total: 0,
});

/**
 * Transparent relevance score.
 * RULE: playback availability is a small tie-breaker only — never outranks
 * an exact/near-exact title or artist match.
 */
const versionLabel = (rawTitle = "") => {
  const t = String(rawTitle).toLowerCase();
  if (/female\s*version|nikhita/.test(t) && /qaafirana|female/.test(t))
    return "female";
  if (/vocals?\s*only|instrumental|karaoke/.test(t)) return "instrumental";
  if (
    /remix|mashup|lofi|slowed|reverb|cover|fingerstyle|synthwave|acoustic|unplugged|dance mix|8d|nightcore/.test(
      t,
    )
  )
    return "alt";
  return "original";
};

const relevanceScore = (
  track,
  query,
  { artistIntent = false, catalogHits = [] } = {},
) => {
  const q = normalizeForMatch(query);
  if (!q) return 0;
  if (isUntrustedCatalogueTrack(track)) return -9999;
  if (isLowQualityUpload(track)) return -500;
  const duration = Number(track.duration || 0);
  if (duration > 0 && duration < MIN_FULL_DURATION_SEC) return -9999;

  const rawTitle = String(track.title || "");
  const title = normalizeForMatch(rawTitle.replace(/\(.*?\)/g, ""));
  const artist = normalizeForMatch(track.artist || "");
  const primaryArtist = artist.split(",")[0].trim();
  const featuredHit =
    artist.includes(q) ||
    q.split(" ").every((t) => t.length < 2 || artist.includes(t));
  const album = normalizeForMatch(track.album || "");
  let score = 0;

  // Core relevance (dominant)
  const titleSim = stringSimilarity(q, title);
  const artistSim = Math.max(
    stringSimilarity(q, primaryArtist),
    stringSimilarity(q, artist) * 0.9,
  );
  const wordHit = titleMatchesQueryWord(rawTitle, q);
  score += Math.round(titleSim * 160);
  score += Math.round(artistSim * 180);

  // Exact / word-level title hits beat fuzzy substring noise (Alfazema, Alfa Zulu…)
  if (title === q || title.startsWith(`${q} `)) score += 120;
  else if (wordHit) score += 70;
  else if (titleSim < 0.78 && q.length >= 4) score -= 140;

  // Known-title queries: prefer official cast over name collisions
  const official = lookupOfficialArtists(q) || lookupOfficialArtists(title);
  if (official?.length && titleSim >= 0.72) {
    const creditHit = official.some(
      (name) =>
        artist.includes(name) ||
        stringSimilarity(primaryArtist, name) >= 0.78,
    );
    if (creditHit) score += 140;
    else score -= 100;

    const ver = versionLabel(rawTitle);
    if (ver === "original" && creditHit) score += 35;
    if (ver === "female" && /female|nikhita/.test(q)) score += 40;
    else if (ver === "female" && !/female|nikhita/.test(q)) score -= 15;
    if (ver === "instrumental") score -= 50;
    if (ver === "alt") score -= 70;
  }

  if (artistIntent) {
    // Artist searches: primary/featured credit must carry the query
    if (artistSim >= 0.85 || featuredHit) score += 80;
    else score -= 120;
    // Title-only hits of the artist name (ringtone uploads) are weak
    if (titleSim > artistSim && artistSim < 0.5) score -= 40;
  }

  if (album) score += Math.round(stringSimilarity(q, album) * 35);

  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  let tokenHits = 0;
  for (const token of tokens) {
    if (title.includes(token)) tokenHits += 1;
    if (artist.includes(token)) tokenHits += 1.5;
  }
  score += Math.round(tokenHits * 10);

  const wantsAlt =
    /mashup|remix|lofi|slowed|reverb|cover|ringtone|acoustic|synthwave|unplugged/.test(
      q,
    );
  const noiseTitle =
    /mashup|remix|lofi|slowed|reverb|cover|nightcore|ringtone|fingerstyle|instrumental|karaoke|8d audio|bass boosted|synthwave|dance mix|female version|guitar version|sped\s*up|slowed\s*\+/.test(
      rawTitle.toLowerCase(),
    );
  if (!wantsAlt && noiseTitle) {
    score -= 110;
  }
  // Prefer clean exact titles over "Title - long credit dump" / mega-duration stubs
  if (duration > 600) score -= 40;

  // Soft provider confidence (not a relevance override)
  if (track.provider === "apple") score += 8;
  if (track.provider === "jiosaavn") score += 10;
  if (track.provider === "audius") {
    // Audius is noisy for Bollywood artist queries unless uploader≈artist
    if (artistIntent) {
      if (artistSim < 0.75) score -= 80;
      if (noiseTitle) score -= 40;
    } else {
      score += 4;
    }
  }

  // Prefer full authorized streams over 30s preview clips (never Deezer)
  if (!track.isPreview && duration >= MIN_FULL_DURATION_SEC) score += 8;
  else if (track.isPreview || track.provider === "apple") score -= 25;
  if (!isPlaceholderArt(track.imgUrl)) score += 3;

  // Live catalog popularity (iTunes / Jio play counts) — works for EVERY query
  if (!artistIntent && catalogHits?.length) {
    score += catalogMatchBoost(track, catalogHits);
  }

  // Official recording boost only for song-title queries (not artist-name searches)
  if (!artistIntent) {
    const officialHit = creditsMatchOfficial(track, query);
    if (officialHit === true) score += 50;
    if (officialHit === false && titleSim >= 0.8) score -= 40;
  }

  // Soft boost for primary full-catalog provider when title is relevant
  if (track.provider === "jiosaavn" && (wordHit || titleSim >= 0.8)) score += 25;

  return score;
};

/** True only for authorized full streams — never Apple/Deezer 30s previews. */
export const isFullPlayableTrack = (track = {}) => {
  if (!track) return false;
  if (isUntrustedCatalogueTrack(track)) return false;
  const provider = String(track.provider || "").toLowerCase();
  if (provider === "apple" || provider === "deezer") return false;
  if (track.isPreview) return false;
  const duration = Number(track.duration || 0);
  // Known short clips are never full songs (4s stubs, 30s previews, etc.)
  if (duration > 0 && duration < MIN_FULL_DURATION_SEC) return false;
  if (provider === "jiosaavn" || provider === "jamendo") {
    return Boolean(track.audioUrl || track.playable || track.needsStreamResolve);
  }
  if (provider === "audius") {
    return Boolean(
      track.needsStreamResolve ||
        track.audioUrl ||
        track.playable ||
        duration >= MIN_FULL_DURATION_SEC,
    );
  }
  if (provider === "radio-browser" || provider === "archive") {
    return Boolean(track.audioUrl || track.needsStreamResolve || track.playable);
  }
  return (
    !track.isPreview &&
    Boolean(track.audioUrl || track.needsStreamResolve) &&
    duration >= MIN_FULL_DURATION_SEC
  );
};

/** Hard filter: song search never lists 30s preview clips / low-quality stubs. */
const filterFullPlayableOnly = (tracks = []) =>
  (Array.isArray(tracks) ? tracks : []).filter(
    (t) => isFullPlayableTrack(t) && !isLowQualityUpload(t),
  );

/**
 * Drop Apple/preview rows when a full stream of the same recording exists.
 * Kept as a soft step before the hard full-only filter.
 */
const preferFullOverPreview = (tracks = []) => {
  const fullKeys = new Set();
  for (const t of tracks) {
    if (!isFullPlayableTrack(t)) continue;
    const key = `${normalizeForMatch(t.title)}|${normalizeForMatch(
      String(t.artist || "").split(",")[0],
    )}`;
    fullKeys.add(key);
  }
  if (!fullKeys.size) return tracks.filter((t) => !t.isPreview && t.provider !== "apple");
  return tracks.filter((t) => {
    if (isFullPlayableTrack(t)) return true;
    if (!(t.isPreview || t.provider === "apple")) return true;
    const key = `${normalizeForMatch(t.title)}|${normalizeForMatch(
      String(t.artist || "").split(",")[0],
    )}`;
    return !fullKeys.has(key);
  });
};

/**
 * Collapse near-duplicate recordings of the same title+primary artist,
 * keeping the highest-ranked version. Different genuine versions
 * (female / remix) stay when their version labels differ.
 */
const collapseNearDuplicateVersions = (tracks = []) => {
  const seen = new Map();
  const out = [];
  for (const track of tracks) {
    const title = normalizeForMatch(
      String(track.title || "").replace(/\(.*?\)/g, "").replace(/-.*$/, ""),
    );
    const artist = normalizeForMatch(
      String(track.artist || "").split(",")[0],
    );
    const ver = versionLabel(track.title);
    const key = `${title}|${artist}|${ver}`;
    if (seen.has(key)) continue;
    seen.set(key, true);
    out.push({ ...track, versionKind: ver });
  }
  return out;
};

const rankTracks = (tracks, query, opts = {}) =>
  [...tracks].sort((a, b) => {
    const diff =
      relevanceScore(b, query, opts) - relevanceScore(a, query, opts);
    if (diff !== 0) return diff;
    // Prefer higher play-like signals via duration as weak tie-break only
    return (b.duration || 0) - (a.duration || 0);
  });

/**
 * Spotify-like ordering: pull live popular catalog matches to the front
 * (title+artist), then keep the remaining relevance-ranked list.
 * Works for every query via catalogHits — no per-song hardcoding.
 */
const promoteCatalogMatches = (tracks = [], catalogHits = []) => {
  if (!catalogHits.length || !tracks.length) return tracks;
  const used = new Set();
  const head = [];

  for (const hit of catalogHits) {
    const ht = normalizeForMatch(
      String(hit.title || "").replace(/\(.*?\)/g, ""),
    );
    const ha = normalizeForMatch(
      String(hit.artist || "").split(/,|&/)[0] || "",
    );
    if (!ht) continue;

    const found = tracks.find((t) => {
      const id = t.id || `${t.provider}:${t.providerId}`;
      if (!id || used.has(id)) return false;
      const title = normalizeForMatch(
        String(t.title || "").replace(/\(.*?\)/g, ""),
      );
      const artist = normalizeForMatch(t.artist || "");
      const primary = artist.split(",")[0].trim();
      const titleOk =
        stringSimilarity(title, ht) >= 0.85 ||
        title === ht ||
        title.startsWith(`${ht} `);
      if (!titleOk) return false;
      if (!ha) return true;
      return (
        primary.includes(ha) ||
        artist.includes(ha) ||
        stringSimilarity(primary, ha) >= 0.72
      );
    });

    if (found) {
      const id = found.id || `${found.provider}:${found.providerId}`;
      used.add(id);
      head.push(found);
    }
  }

  const rest = tracks.filter((t) => {
    const id = t.id || `${t.provider}:${t.providerId}`;
    return !used.has(id);
  });
  return [...head, ...rest];
};

const rankCatalog = (items, query, nameKeys = ["title", "name"]) =>
  [...items].sort((a, b) => {
    const aName = nameKeys.map((k) => a?.[k]).find(Boolean) || "";
    const bName = nameKeys.map((k) => b?.[k]).find(Boolean) || "";
    const aArtist = normalizeForMatch(a?.artist || "");
    const bArtist = normalizeForMatch(b?.artist || "");
    const q = normalizeForMatch(query);
    const aScore =
      stringSimilarity(q, aName) * 0.55 + stringSimilarity(q, aArtist) * 0.45;
    const bScore =
      stringSimilarity(q, bName) * 0.55 + stringSimilarity(q, bArtist) * 0.45;
    if (Math.abs(bScore - aScore) > 0.001) return bScore - aScore;
    return 0;
  });

/** Keep albums that actually credit the queried artist (or strong title match). */
const filterAlbumsForQuery = (albums, query, { artistIntent = false } = {}) => {
  const q = normalizeForMatch(query);
  if (!q) return albums;
  return albums.filter((album) => {
    const title = normalizeForMatch(album.title || "");
    const artist = normalizeForMatch(album.artist || "");
    const artistScore = stringSimilarity(q, artist);
    const titleScore = stringSimilarity(q, title);
    if (artistIntent) return artistScore >= 0.72 || artist.includes(q);
    // Song-like queries: album title or artist should relate
    return artistScore >= 0.55 || titleScore >= 0.55 || artist.includes(q) || title.includes(q);
  });
};

const annotatePlayback = (track) => {
  if (!track) return track;
  let playbackType = PlaybackType.UNAVAILABLE;
  if (track.provider === "apple" || track.isPreview) {
    playbackType = PlaybackType.PREVIEW;
  } else if (
    track.provider === "audius" ||
    track.provider === "jiosaavn" ||
    track.provider === "jamendo" ||
    track.provider === "radio-browser" ||
    track.provider === "archive"
  ) {
    playbackType = track.playable || track.audioUrl || track.needsStreamResolve
      ? PlaybackType.AUTHORIZED_FULL_STREAM
      : PlaybackType.UNAVAILABLE;
  }
  return {
    ...track,
    playbackType,
    // Search UI only treats full streams as available
    playbackAvailable: playbackType === PlaybackType.AUTHORIZED_FULL_STREAM,
  };
};

const collectTrackTasks = (query, providerList, limit, offset) => {
  const tasks = [];

  if (providerList.includes("jiosaavn")) {
    tasks.push({
      name: "jiosaavn",
      run: async () => {
        const res = await jiosaavnRequest("/api/search/songs", {
          params: { query, limit, page: Math.floor(offset / (limit || 20)) },
          cacheEnabled: true,
        });
        return mapTracks(res?.data?.results || [], mapFullJio).map(
          normalizePlayableTrack,
        );
      },
    });
  }

  if (providerList.includes("jiosaavn-preview")) {
    tasks.push({
      name: "jiosaavn-preview",
      run: async () => {
        const res = await sayaRequest("/v1/jiosaavn/search/songs", {
          params: { q: query },
          cache: true,
        });
        return mapTracks(res?.data?.results, mapJioSaavnSong).map(
          normalizePlayableTrack,
        );
      },
    });
  }

  if (providerList.includes("audius")) {
    tasks.push({
      name: "audius",
      run: async () => {
        const res = await sayaRequest("/v1/audius/search/tracks", {
          params: { q: query, limit },
          cache: true,
        });
        return mapTracks(res?.data?.data || res?.data, mapAudiusTrack).map(
          normalizePlayableTrack,
        );
      },
    });
  }

  if (providerList.includes("jamendo") && isJamendoConfigured()) {
    tasks.push({
      name: "jamendo",
      run: async () =>
        mapTracks(await jamendoSearchTracks(query, { limit }), mapJamendoTrack)
          .map(normalizePlayableTrack)
          .filter(Boolean),
    });
  }

  // Apple song search intentionally omitted — 30s previews must never appear as songs.

  return tasks;
};

export const searchTracks = async ({
  q,
  limit = 20,
  offset = 0,
  providers = DEFAULT_TRACK_PROVIDERS,
}) => {
  if (!q || String(q).trim().length < 1) {
    return emptyResult(q, "tracks");
  }

  const original = String(q).trim();
  const intent = detectSearchIntent(original);
  const entityRaw = intent.entityQuery || original;
  const { primary, variants, normalized } = buildSearchVariants(entityRaw);
  const providerList = parseProviderList(providers, DEFAULT_TRACK_PROVIDERS);
  const cacheKey = `tracks:${normalized}:${providerList.join(",")}:${limit}:${offset}`;
  const startedAt = Date.now();

  return dedupeInflight(cacheKey, async () => {
    const artistIntent = Boolean(intent.artistIntent);
    // Live popularity oracle (works for every query — not a hardcoded song list)
    const catalog = artistIntent
      ? { hits: [], seeds: [] }
      : await fetchCatalogHits(primary, { limit: 8 }).catch(() => ({
          hits: [],
          seeds: [],
        }));
    const catalogHits = catalog.hits || [];

    // Song queries: expand with live catalog seeds + light metadata aliases.
    // Artist queries: keep primary search clean; adjacent songs appended later.
    const metaSeeds = buildMetadataSearchSeeds(entityRaw, {
      artistIntent: false,
      maxSeeds: 3,
    });
    const adjacentSeeds = artistIntent
      ? buildMetadataSearchSeeds(entityRaw, { artistIntent: true, maxSeeds: 4 })
      : [];
    const searchTerms = [
      ...new Set([
        primary,
        ...variants.map((v) => v.text),
        ...(artistIntent ? [] : catalog.seeds || []),
        ...(artistIntent ? [] : metaSeeds),
      ]),
    ].slice(0, 6);
    const allTracks = [];
    const adjacentTracks = [];
    const errors = [];
    const byProvider = {};
    const timing = {};
    let providerStatus = {};

    const perProviderLimit = Math.max(Number(limit) || 20, artistIntent ? 40 : 25);
    const scoreOpts = { artistIntent, catalogHits };
    // Always run primary + live catalog seeds (Spotify-like hits). Early-exit
    // only after those terms so popular titles aren't skipped.
    const priorityTerms = new Set(
      [primary, ...(catalog.seeds || []).slice(0, 3)].map((t) =>
        normalizeForMatch(t),
      ),
    );

    for (const term of searchTerms) {
      const batch = await runProviderTasks(
        collectTrackTasks(term, providerList, perProviderLimit, offset),
      );
      Object.assign(timing, batch.timing);
      Object.assign(providerStatus, batch.providerStatus);
      for (const err of batch.errors) errors.push(err);
      for (const r of batch.results) {
        if (!isProviderAllowed(r.provider)) continue;
        const tracks = filterDiscoverableEntities(r.data || []);
        byProvider[r.provider] = (byProvider[r.provider] || 0) + tracks.length;
        allTracks.push(...tracks);
      }
      const strong = allTracks.filter(
        (t) => relevanceScore(t, primary, scoreOpts) >= 120,
      );
      const termDone = !priorityTerms.has(normalizeForMatch(term));
      if (
        termDone &&
        strong.length >= Math.min(12, Number(limit) || 20)
      ) {
        break;
      }
    }

    // Adjacent known songs for artist-name queries (metadata graph)
    for (const seed of adjacentSeeds.slice(0, 3)) {
      try {
        const batch = await runProviderTasks(
          collectTrackTasks(seed, providerList, 8, 0),
        );
        for (const r of batch.results) {
          if (!isProviderAllowed(r.provider)) continue;
          adjacentTracks.push(
            ...filterDiscoverableEntities(r.data || []).map((t) => ({
              ...t,
              metadataAdjacent: true,
              metadataSeed: seed,
            })),
          );
        }
      } catch {
        /* ignore seed failures */
      }
    }

    // Apple discography is preview-only — skipped for full-track search mode.

    // Prefer full streams then HARD-filter: never return 30s / short clips
    const deduped = filterFullPlayableOnly(
      preferFullOverPreview(
        collapseNearDuplicateVersions(
          dedupeTracks(filterDiscoverableEntities(allTracks)),
        ),
      ),
    ).map(annotatePlayback);
    const ranked = promoteCatalogMatches(
      rankTracks(deduped, primary, scoreOpts),
      catalogHits,
    );
    const filtered = artistIntent
      ? ranked.filter((t) => relevanceScore(t, primary, scoreOpts) >= 40)
      : ranked.filter((t) => relevanceScore(t, primary, scoreOpts) >= 55);

    const seenIds = new Set(
      filtered.map((t) => t.id || `${t.provider}:${t.providerId}`),
    );
    const adjacentRanked = rankTracks(
      filterFullPlayableOnly(
        preferFullOverPreview(
          dedupeTracks(filterDiscoverableEntities(adjacentTracks)),
        ),
      ).map(annotatePlayback),
      primary,
      { artistIntent: true, catalogHits: [] },
    ).filter((t) => {
      const key = t.id || `${t.provider}:${t.providerId}`;
      if (!key || seenIds.has(key)) return false;
      // Keep only tracks that credit the queried artist
      if (artistIntent) {
        const artist = normalizeForMatch(t.artist || "");
        const q = normalizeForMatch(primary);
        if (!(artist.includes(q) || stringSimilarity(q, artist) >= 0.55))
          return false;
      }
      seenIds.add(key);
      return true;
    });

    const merged = [
      ...filtered,
      ...adjacentRanked.map((t) => ({ ...t, fromMetadataGraph: true })),
    ];

    return {
      query: original,
      normalizedQuery: normalized,
      searchPrimary: primary,
      entityQuery: entityRaw,
      detectedIntent: intent.intent,
      variants: variants.map((v) => v.text),
      intent: { ...intent, artistIntent },
      type: "tracks",
      tracks: merged.slice(0, Number(limit) || 20),
      total: merged.length,
      resultCounts: { tracks: merged.length },
      metadataSeeds: [...metaSeeds, ...adjacentSeeds],
      providerSources: byProvider,
      byProvider,
      providerStatus,
      timing,
      searchLatencyMs: Date.now() - startedAt,
      errors: errors.length ? errors : undefined,
    };
  });
};

export const searchAlbums = async ({
  q,
  limit = 20,
  providers = DEFAULT_CATALOG_PROVIDERS,
}) => {
  if (!q || !String(q).trim()) return emptyResult(q, "albums");
  const original = String(q).trim();
  const intent = detectSearchIntent(original);
  const entityRaw = intent.entityQuery || original;
  const { primary: entityPrimary, normalized } = buildSearchVariants(entityRaw);
  const providerList = parseProviderList(
    providers.includes("apple") ? providers : `${providers},apple`,
    "jiosaavn,apple",
  );
  const artistIntent =
    Boolean(intent.artistIntent) || intent.intent === "ALBUM";

  const tasks = [];
  if (providerList.includes("jiosaavn")) {
    tasks.push({
      name: "jiosaavn",
      run: async () => {
        const res = await jiosaavnRequest("/api/search/albums", {
          params: { query: entityPrimary, limit },
          cacheEnabled: true,
        });
        return mapAlbums(res?.data?.results || res?.data, "jiosaavn");
      },
    });
  }
  if (providerList.includes("apple") && !artistIntent) {
    tasks.push({
      name: "apple",
      run: async () =>
        appleAdapter.searchAlbums(entityPrimary, {
          limit: Math.max(Number(limit) || 20, 25),
        }),
    });
  }

  // Prefer Apple artist album discography when query is an artist name
  if (artistIntent) {
    tasks.push({
      name: "apple_artist_albums",
      run: async () => {
        const top = await appleAdapter.resolveArtist(entityPrimary);
        if (
          !top?.providerId ||
          stringSimilarity(entityPrimary, top.name || top.title) < 0.8
        ) {
          return [];
        }
        return appleAdapter.getArtistAlbums(top.providerId, { limit: 40 });
      },
    });
    tasks.push({
      name: "musicbrainz_albums",
      run: async () => {
        const mbArtist = await musicbrainzAdapter.resolveArtistId(entityPrimary);
        if (!mbArtist?.providerId) return [];
        return musicbrainzAdapter.getArtistAlbums(mbArtist.providerId, {
          limit: 25,
        });
      },
    });
  }

  const { results, errors, timing, providerStatus } = await runProviderTasks(tasks);
  let albums = [];
  for (const r of results) albums.push(...(r.data || []));
  albums = filterAlbumsForQuery(
    rankCatalog(dedupeById(filterAllowedEntities(albums)), entityPrimary),
    entityPrimary,
    { artistIntent },
  );

  albums = await Promise.all(
    albums.slice(0, Number(limit) || 20).map(async (album, idx) => {
      if (idx < 4 && isPlaceholderArt(album.imgUrl)) {
        return enrichArtworkIfMissing(album);
      }
      return album;
    }),
  );

  return {
    query: original,
    normalizedQuery: normalized,
    searchPrimary: entityPrimary,
    entityQuery: entityRaw,
    detectedIntent: intent.intent,
    intent: { ...intent, artistIntent },
    type: "albums",
    albums,
    total: albums.length,
    resultCounts: { albums: albums.length },
    providerSources: Object.fromEntries(
      results.map((r) => [r.provider, (r.data || []).length]),
    ),
    providerStatus,
    timing,
    errors: errors.length ? errors : undefined,
  };
};

export const searchArtists = async ({
  q,
  limit = 20,
  providers = DEFAULT_CATALOG_PROVIDERS,
}) => {
  if (!q || !String(q).trim()) return emptyResult(q, "artists");
  const original = String(q).trim();
  const { primary, normalized } = buildSearchVariants(original);
  const providerList = parseProviderList(
    providers.includes("apple") ? providers : `${providers},apple`,
    "jiosaavn,apple",
  );

  const tasks = [];
  if (providerList.includes("jiosaavn")) {
    tasks.push({
      name: "jiosaavn",
      run: async () => {
        const res = await jiosaavnRequest("/api/search/artists", {
          params: { query: primary, limit },
          cacheEnabled: true,
        });
        return mapArtists(res?.data?.results || res?.data, "jiosaavn");
      },
    });
  }
  if (providerList.includes("apple")) {
    tasks.push({
      name: "apple",
      run: async () => appleAdapter.searchArtists(primary, { limit }),
    });
  }
  tasks.push({
    name: "musicbrainz",
    run: async () => musicbrainzAdapter.searchArtists(primary, { limit: 5 }),
  });

  const { results, errors, timing, providerStatus } = await runProviderTasks(tasks);
  let artists = [];
  for (const r of results) artists.push(...(r.data || []));
  artists = rankCatalog(
    dedupeById(filterAllowedEntities(artists)),
    primary,
    ["name", "title"],
  )
    .filter((a) => stringSimilarity(primary, a.name || a.title || "") >= 0.55)
    .slice(0, Number(limit) || 20);

  return {
    query: original,
    normalizedQuery: normalized,
    searchPrimary: primary,
    detectedIntent: "ARTIST",
    type: "artists",
    artists,
    total: artists.length,
    resultCounts: { artists: artists.length },
    providerSources: Object.fromEntries(
      results.map((r) => [r.provider, (r.data || []).length]),
    ),
    providerStatus,
    timing,
    errors: errors.length ? errors : undefined,
  };
};

export const searchPlaylists = async ({
  q,
  limit = 20,
  providers = DEFAULT_CATALOG_PROVIDERS,
}) => {
  if (!q || !String(q).trim()) return emptyResult(q, "playlists");
  const original = String(q).trim();
  const { primary, normalized } = buildSearchVariants(original);
  const providerList = parseProviderList(providers, DEFAULT_CATALOG_PROVIDERS);

  const tasks = [];
  if (providerList.includes("jiosaavn")) {
    tasks.push({
      name: "jiosaavn",
      run: async () => {
        const res = await jiosaavnRequest("/api/search/playlists", {
          params: { query: primary, limit },
          cacheEnabled: true,
        });
        return mapPlaylists(res?.data?.results || res?.data, "jiosaavn");
      },
    });
  }

  const { results, errors, timing } = await runProviderTasks(tasks);
  let playlists = [];
  for (const r of results) playlists.push(...(r.data || []));
  playlists = rankCatalog(
    dedupeById(filterAllowedEntities(playlists)),
    primary,
  ).slice(0, Number(limit) || 20);

  return {
    query: original,
    normalizedQuery: normalized,
    searchPrimary: primary,
    type: "playlists",
    playlists,
    total: playlists.length,
    timing,
    errors: errors.length ? errors : undefined,
  };
};

export const searchPodcasts = async ({ q, limit = 20 }) => {
  if (!q || !String(q).trim()) return emptyResult(q, "podcasts");
  return {
    query: String(q).trim(),
    type: "podcasts",
    podcasts: [],
    total: 0,
    note: "Podcast search is unavailable after Deezer removal",
    limit: Number(limit) || 20,
  };
};

export const universalSearch = async ({
  q,
  limit = 12,
  types = "tracks,albums,artists,playlists",
}) => {
  if (!q || String(q).trim().length < 1) {
    return {
      query: q || "",
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      podcasts: [],
      message: "Enter a search query",
    };
  }

  const original = String(q).trim();
  const { primary, normalized, variants } = buildSearchVariants(original);
  const intent = detectSearchIntent(original);
  const typeList = String(types).split(",").map((t) => t.trim());
  const cacheKey = `universal:${normalized}:${typeList.join(",")}:${limit}`;

  return dedupeInflight(cacheKey, async () => {
    const [tracks, albums, artists, playlists, podcasts] = await Promise.all([
      typeList.includes("tracks")
        ? searchTracks({ q: original, limit })
        : Promise.resolve({ tracks: [] }),
      typeList.includes("albums")
        ? searchAlbums({ q: original, limit })
        : Promise.resolve({ albums: [] }),
      typeList.includes("artists")
        ? searchArtists({ q: original, limit })
        : Promise.resolve({ artists: [] }),
      typeList.includes("playlists")
        ? searchPlaylists({ q: original, limit })
        : Promise.resolve({ playlists: [] }),
      typeList.includes("podcasts")
        ? searchPodcasts({ q: original, limit })
        : Promise.resolve({ podcasts: [] }),
    ]);

    const primaryTracks = filterDiscoverableEntities(tracks.tracks || []);
    const top =
      primaryTracks.find((t) => t.provider === "jiosaavn" && !t.isPreview) ||
      primaryTracks.find(
        (t) =>
          t.provider === "audius" &&
          !t.isPreview &&
          !isLowQualityUpload(t),
      ) ||
      primaryTracks[0];

    let recommended = [];
    if (top?.artist) {
      const seedArtist = String(top.artist).split(",")[0].trim();
      const related = await searchTracks({
        q: seedArtist,
        limit: Math.min(14, Number(limit) || 12),
      }).catch(() => ({ tracks: [] }));
      const seen = new Set(
        primaryTracks.map((t) => t.id || `${t.provider}:${t.providerId}`),
      );
      recommended = filterDiscoverableEntities(related.tracks || []).filter(
        (t) => {
          if (isLowQualityUpload(t)) return false;
          const key = t.id || `${t.provider}:${t.providerId}`;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        },
      );
    }

    const topResult =
      intent.intent === "ARTIST" || intent.artistIntent
        ? artists.artists?.[0] || top
        : intent.intent === "ALBUM"
          ? albums.albums?.[0] || top
          : top || artists.artists?.[0] || albums.albums?.[0];

    return {
      query: original,
      normalizedQuery: normalized,
      searchPrimary: primary,
      entityQuery: intent.entityQuery || original,
      detectedIntent: intent.intent,
      variants: variants.map((v) => v.text),
      metadataSeeds: tracks.metadataSeeds || [],
      intent,
      topResult: topResult || null,
      tracks: primaryTracks,
      albums: filterDiscoverableEntities(albums.albums || []),
      artists: filterDiscoverableEntities(artists.artists || []),
      playlists: filterDiscoverableEntities(playlists.playlists || []),
      podcasts: podcasts.podcasts || [],
      recommended,
      recommendSeed: top
        ? {
            artist: String(top.artist || "").split(",")[0].trim(),
            title: top.title,
          }
        : null,
      resultCounts: {
        tracks: primaryTracks.length,
        albums: (albums.albums || []).length,
        artists: (artists.artists || []).length,
        playlists: (playlists.playlists || []).length,
      },
      providerSources: {
        tracks: tracks.providerSources || tracks.byProvider,
        albums: albums.providerSources,
        artists: artists.providerSources,
      },
      providerStatus: {
        ...(tracks.providerStatus || {}),
        ...(albums.providerStatus || {}),
        ...(artists.providerStatus || {}),
      },
      providerErrors: [
        ...(tracks.errors || []),
        ...(albums.errors || []),
        ...(artists.errors || []),
        ...(playlists.errors || []),
      ].filter(Boolean),
    };
  });
};

export const autocomplete = async ({ q, limit = 8 }) => {
  if (!q || String(q).trim().length < 2) {
    return { query: q || "", suggestions: [] };
  }

  const original = String(q).trim();
  const { primary } = buildSearchVariants(original);

  const [autoRes, trackRes] = await Promise.all([
    (async () => {
      try {
        return await sayaRequest("/v1/autocomplete", {
          params: { q: primary },
          cache: true,
        });
      } catch {
        return null;
      }
    })(),
    searchTracks({ q: original, limit, providers: DEFAULT_TRACK_PROVIDERS }),
  ]);

  const suggestions = [];
  for (const item of asArray(autoRes?.data)) {
    if (typeof item === "string") suggestions.push({ text: item, type: "query" });
    else if (item?.title || item?.name || item?.text) {
      suggestions.push({
        text: item.title || item.name || item.text,
        type: item.type || "query",
      });
    }
  }

  for (const track of filterAllowedEntities(trackRes.tracks || [])) {
    suggestions.push({
      text: `${track.title} — ${track.artist}`,
      type: "track",
      track,
    });
  }

  const seen = new Set();
  const unique = suggestions.filter((s) => {
    const key = s.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    query: original,
    searchPrimary: primary,
    suggestions: unique.slice(0, Number(limit) || 8),
  };
};

export const matchTrack = async ({ artist, title }) => {
  if (!artist || !title) {
    throw new SayaApiError("artist and title are required", { status: 400 });
  }

  const query = `${title} ${artist}`.trim();
  const result = await searchTracks({
    q: query,
    limit: 8,
    providers: DEFAULT_TRACK_PROVIDERS,
  });

  return {
    artist,
    title,
    tracks: result.tracks,
    bestMatch: result.tracks[0] || null,
  };
};
