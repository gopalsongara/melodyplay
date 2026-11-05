import { PlaybackType, createStubAdapter } from "./providerAdapter.js";
import { normalizeForMatch, stringSimilarity } from "../queryNormalize.js";
import {
  getCachedSearch,
  setCachedSearch,
} from "../searchOrchestrator.js";

const UA =
  process.env.MUSICBRAINZ_USER_AGENT ||
  "MelodyPlay/1.0 (https://localhost; catalogue-metadata)";

/** MusicBrainz: max ~1 request/second */
let lastMbAt = 0;
const mbQueue = [];
let mbPumping = false;

const pumpMbQueue = async () => {
  if (mbPumping) return;
  mbPumping = true;
  while (mbQueue.length) {
    const wait = Math.max(0, 1100 - (Date.now() - lastMbAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const job = mbQueue.shift();
    lastMbAt = Date.now();
    try {
      job.resolve(await job.run());
    } catch (error) {
      job.reject(error);
    }
  }
  mbPumping = false;
};

const scheduleMb = (run) =>
  new Promise((resolve, reject) => {
    mbQueue.push({ run, resolve, reject });
    pumpMbQueue();
  });

const mbFetch = async (path, params = {}) => {
  const cacheKey = `mb:${path}:${JSON.stringify(params)}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) return cached;

  const data = await scheduleMb(async () => {
    const url = new URL(`https://musicbrainz.org/ws/2/${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    });
    if (!url.searchParams.has("fmt")) url.searchParams.set("fmt", "json");

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = new Error(`MusicBrainz HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  });

  setCachedSearch(cacheKey, data);
  return data;
};

const mapMbArtist = (a) => {
  if (!a?.id) return null;
  return {
    id: `musicbrainz:${a.id}`,
    provider: "musicbrainz",
    providerId: a.id,
    type: "artist",
    title: a.name,
    name: a.name,
    imgUrl: null,
    disambiguation: a.disambiguation || null,
    artistType: a.type || null,
    aliases: (a.aliases || []).map((x) => x.name).filter(Boolean),
    playbackCapability: "metadata_only",
    playbackType: PlaybackType.METADATA_ONLY,
  };
};

const mapMbReleaseGroup = (rg, artistName = "") => {
  if (!rg?.id) return null;
  const title = rg.title || "Album";
  return {
    id: `musicbrainz:${rg.id}`,
    provider: "musicbrainz",
    providerId: rg.id,
    type: "album",
    title,
    artist:
      artistName ||
      rg["artist-credit"]?.map((c) => c.name || c.artist?.name).join(", ") ||
      "Unknown Artist",
    imgUrl: null,
    releaseDate: rg["first-release-date"] || null,
    trackCount: null,
    primaryType: rg["primary-type"] || null,
    playbackCapability: "metadata_only",
    playbackType: PlaybackType.METADATA_ONLY,
    musicBrainzId: rg.id,
  };
};

export const musicbrainzAdapter = {
  ...createStubAdapter("musicbrainz", {
    searchArtists: true,
    getArtist: true,
    getArtistAlbums: true,
    playbackType: PlaybackType.METADATA_ONLY,
  }),

  async searchArtists(query, { limit = 5 } = {}) {
    const data = await mbFetch("artist/", {
      query: `artist:"${query}"`,
      limit,
    });
    return (data.artists || []).map(mapMbArtist).filter(Boolean);
  },

  async getArtist(artistId) {
    const data = await mbFetch(`artist/${artistId}`, { inc: "aliases" });
    return mapMbArtist(data);
  },

  async getArtistAlbums(artistId, { limit = 50 } = {}) {
    const data = await mbFetch("release-group", {
      artist: artistId,
      type: "album|ep|single",
      limit,
    });
    const artist = await this.getArtist(artistId).catch(() => null);
    return (data["release-groups"] || [])
      .map((rg) => mapMbReleaseGroup(rg, artist?.name))
      .filter(Boolean);
  },

  /**
   * Find best MB artist for a query (exact / high similarity only).
   */
  async resolveArtistId(query) {
    const artists = await this.searchArtists(query, { limit: 5 });
    const q = normalizeForMatch(query);
    const best = artists
      .map((a) => ({ a, score: stringSimilarity(q, a.name) }))
      .sort((x, y) => y.score - x.score)[0];
    if (!best || best.score < 0.85) return null;
    return best.a;
  },
};
