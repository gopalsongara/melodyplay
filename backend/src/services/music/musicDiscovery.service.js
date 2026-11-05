import { sayaRequest } from "./saya.client.js";
import {
  jiosaavnRequest,
  pickBestDownloadUrl,
  extractArtistNames,
  extractImageUrl,
} from "./jiosaavn.client.js";
import {
  mapAudiusTrack,
  mapJioSaavnFullSong,
  mapAlbums,
  mapArtists,
  mapPlaylists,
  mapTracks,
  normalizePlayableTrack,
} from "./music.mapper.js";
import { filterDiscoverableEntities } from "./providerRegistry.js";

const mapFullJio = (item) =>
  mapJioSaavnFullSong(item, {
    pickBestDownloadUrl,
    extractArtistNames,
    extractImageUrl,
  });

const safe = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    return { error: error.message, status: error.status };
  }
};

const albumsFromTracks = (tracks = []) => {
  const seen = new Set();
  const albums = [];
  for (const track of tracks) {
    const albumId = track.albumId;
    if (!albumId || seen.has(albumId)) continue;
    seen.add(albumId);
    albums.push({
      id: `${track.provider}:${albumId}`,
      provider: track.provider,
      providerId: String(albumId),
      type: "album",
      title: track.album || track.title || "Album",
      artist: track.artist || "Unknown Artist",
      imgUrl: track.imgUrl,
      releaseDate: null,
      trackCount: null,
      externalUrl: null,
    });
  }
  return albums;
};

export const getCharts = async ({ limit = 20 } = {}) => {
  const n = Number(limit) || 20;
  const [jioSongs, jioAlbums, jioArtists, jioPlaylists, audius] =
    await Promise.all([
      safe(() =>
        jiosaavnRequest("/api/trending/songs", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/albums", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/artists", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/playlists", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        sayaRequest("/v1/audius/trending/tracks", {
          params: { limit: n },
          cache: true,
        }),
      ),
    ]);

  const jioTracks = jioSongs.error
    ? []
    : mapTracks(jioSongs?.data?.results || jioSongs?.data, mapFullJio).map(
        normalizePlayableTrack,
      );
  const audiusTracks = audius.error
    ? []
    : mapTracks(audius?.data?.data || audius?.data, mapAudiusTrack).map(
        normalizePlayableTrack,
      );

  return {
    tracks: filterDiscoverableEntities([...jioTracks, ...audiusTracks]).slice(
      0,
      n,
    ),
    albums: jioAlbums.error
      ? albumsFromTracks(jioTracks).slice(0, n)
      : mapAlbums(jioAlbums?.data?.results || jioAlbums?.data, "jiosaavn").slice(
          0,
          n,
        ),
    artists: jioArtists.error
      ? []
      : mapArtists(
          jioArtists?.data?.results || jioArtists?.data,
          "jiosaavn",
        ).slice(0, n),
    playlists: jioPlaylists.error
      ? []
      : mapPlaylists(
          jioPlaylists?.data?.results || jioPlaylists?.data,
          "jiosaavn",
        ).slice(0, n),
    podcasts: [],
    sources: {
      jiosaavn: !jioSongs.error,
      audius: !audius.error,
    },
  };
};

export const getTrending = async ({ limit = 20 } = {}) => {
  const n = Number(limit) || 20;
  const [jioSongs, jioAlbums, jioArtists, jioPlaylists, audius] =
    await Promise.all([
      safe(() =>
        jiosaavnRequest("/api/trending/songs", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/albums", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/artists", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        jiosaavnRequest("/api/trending/playlists", {
          params: { limit: n },
          cacheEnabled: true,
        }),
      ),
      safe(() =>
        sayaRequest("/v1/audius/trending/tracks", {
          params: { limit: n },
          cache: true,
        }),
      ),
    ]);

  const jioTracks = jioSongs.error
    ? []
    : mapTracks(jioSongs?.data?.results || jioSongs?.data, mapFullJio).map(
        normalizePlayableTrack,
      );
  const audiusTracks = audius.error
    ? []
    : mapTracks(audius?.data?.data || audius?.data, mapAudiusTrack).map(
        normalizePlayableTrack,
      );

  const jiosaavnAlbums = jioAlbums.error
    ? []
    : mapAlbums(jioAlbums?.data?.results || jioAlbums?.data, "jiosaavn");
  const jiosaavnArtists = jioArtists.error
    ? []
    : mapArtists(jioArtists?.data?.results || jioArtists?.data, "jiosaavn");
  const jiosaavnPlaylists = jioPlaylists.error
    ? []
    : mapPlaylists(
        jioPlaylists?.data?.results || jioPlaylists?.data,
        "jiosaavn",
      );

  const fallbackAlbums = albumsFromTracks(jioTracks);

  return {
    tracks: filterDiscoverableEntities([...jioTracks, ...audiusTracks]).slice(0, n),
    albums: [
      ...(jiosaavnAlbums.length ? jiosaavnAlbums : fallbackAlbums),
    ].slice(0, n),
    artists: [...jiosaavnArtists].slice(0, n),
    playlists: [...jiosaavnPlaylists].slice(0, n),
    sources: {
      jiosaavn: !jioSongs.error,
      audius: !audius.error,
      jiosaavnError: jioSongs.error || null,
      audiusError: audius.error || null,
    },
  };
};

const uniqueById = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item?.id || item?.providerId || item?.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const parseSeeds = (seeds) => {
  if (Array.isArray(seeds)) {
    return seeds
      .map((s) => String(s || "").trim())
      .filter((s) => s.length >= 2)
      .slice(0, 8);
  }
  if (typeof seeds === "string" && seeds.trim()) {
    return seeds
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 8);
  }
  return [];
};

/**
 * Albums / artists / tracks shaped by user search + listening interests.
 */
export const getPersonalizedDiscovery = async ({
  seeds = [],
  limit = 12,
} = {}) => {
  const interestSeeds = parseSeeds(seeds);
  const n = Number(limit) || 12;

  if (!interestSeeds.length) {
    const trending = await getTrending({ limit: n });
    return {
      personalized: false,
      seeds: [],
      albums: trending.albums || [],
      artists: trending.artists || [],
      tracks: (trending.tracks || []).filter((t) => !t.isPreview).slice(0, n),
      reasons: {},
    };
  }

  const albumBatches = await Promise.all(
    interestSeeds.map((seed) =>
      safe(async () => {
        const res = await jiosaavnRequest("/api/search/albums", {
          params: { query: seed, limit: 6 },
          cacheEnabled: true,
        });
        return {
          seed,
          albums: mapAlbums(res?.data?.results || res?.data, "jiosaavn"),
        };
      }),
    ),
  );

  const trackBatches = await Promise.all(
    interestSeeds.slice(0, 4).map((seed) =>
      safe(async () => {
        const res = await jiosaavnRequest("/api/search/songs", {
          // Artist/album seeds → related songs (not random search terms)
          params: { query: `${seed} songs`, limit: 8 },
          cacheEnabled: true,
        });
        return {
          seed,
          tracks: mapTracks(res?.data?.results || [], mapFullJio).map(
            normalizePlayableTrack,
          ),
        };
      }),
    ),
  );

  const artistBatches = await Promise.all(
    interestSeeds.slice(0, 4).map((seed) =>
      safe(async () => {
        const res = await jiosaavnRequest("/api/search/artists", {
          params: { query: seed, limit: 4 },
          cacheEnabled: true,
        });
        return {
          seed,
          artists: mapArtists(res?.data?.results || res?.data, "jiosaavn"),
        };
      }),
    ),
  );

  const albums = [];
  const artists = [];
  const tracks = [];
  const reasons = {};

  for (const batch of albumBatches) {
    if (batch.error) continue;
    for (const album of batch.albums || []) {
      albums.push(album);
      if (!reasons[album.id]) reasons[album.id] = `Based on “${batch.seed}”`;
    }
  }
  for (const batch of artistBatches) {
    if (batch.error) continue;
    artists.push(...(batch.artists || []));
  }
  for (const batch of trackBatches) {
    if (batch.error) continue;
    tracks.push(...(batch.tracks || []).filter((t) => !t.isPreview));
  }

  // Fill with trending if personalization returned too little
  let trendingFill = { albums: [], artists: [], tracks: [] };
  if (albums.length < 6 || artists.length < 4 || tracks.length < 6) {
    trendingFill = await getTrending({ limit: n });
  }

  return {
    personalized: true,
    seeds: interestSeeds,
    albums: uniqueById([...albums, ...(trendingFill.albums || [])]).slice(0, n),
    artists: uniqueById([...artists, ...(trendingFill.artists || [])]).slice(
      0,
      n,
    ),
    tracks: uniqueById([...tracks, ...(trendingFill.tracks || [])]).slice(0, n),
    reasons,
  };
};

const MIX_PLAYLIST_QUERIES = [
  "mix",
  "bollywood hits",
  "punjabi mix",
  "90s bollywood",
  "2000s hits",
  "chill mix",
  "party mix",
  "romantic mix",
];

const THROWBACK_QUERIES = [
  "best of 90s hindi",
  "best of 2000s hindi",
  "classic bollywood",
  "old hindi songs",
];

/** Spotify Browse-style curated shelves (title + JioSaavn playlist search). */
export const PLAYLIST_SHELF_DEFS = [
  {
    id: "bollywood",
    title: "Bollywood Hits",
    subtitle: "Biggest Hindi chart-toppers",
    query: "bollywood hits",
    accent: "#8B5A2B",
  },
  {
    id: "punjabi",
    title: "Punjabi Beats",
    subtitle: "Bhangra, pop & desi vibes",
    query: "punjabi hits",
    accent: "#C45C26",
  },
  {
    id: "romantic",
    title: "Romantic",
    subtitle: "Love songs for every mood",
    query: "romantic bollywood",
    accent: "#9B2C5A",
  },
  {
    id: "party",
    title: "Party",
    subtitle: "Dance floor ready",
    query: "party mix bollywood",
    accent: "#1B6CA8",
  },
  {
    id: "chill",
    title: "Chill",
    subtitle: "Soft, calm & late night",
    query: "chill hindi",
    accent: "#2F6F4E",
  },
  {
    id: "workout",
    title: "Workout",
    subtitle: "High energy focus",
    query: "gym workout hindi",
    accent: "#B45309",
  },
  {
    id: "indie",
    title: "Indie India",
    subtitle: "Fresh independent sounds",
    query: "indie india",
    accent: "#4C1D95",
  },
  {
    id: "tamil",
    title: "Tamil Hits",
    subtitle: "Kollywood favourites",
    query: "tamil hits",
    accent: "#0F766E",
  },
  {
    id: "telugu",
    title: "Telugu Hits",
    subtitle: "Tollywood energy",
    query: "telugu hits",
    accent: "#7C3AED",
  },
  {
    id: "english",
    title: "English Pop",
    subtitle: "Global chart favourites",
    query: "english pop hits",
    accent: "#0369A1",
  },
  {
    id: "throwback-90s",
    title: "90s Throwback",
    subtitle: "Golden era classics",
    query: "90s bollywood hits",
    accent: "#854D0E",
  },
  {
    id: "focus",
    title: "Focus",
    subtitle: "Study & deep work",
    query: "lofi study",
    accent: "#334155",
  },
];

const searchPlaylistsByQuery = async (query, limit = 8) => {
  const jio = await safe(() =>
    jiosaavnRequest("/api/search/playlists", {
      params: { query, limit },
      cacheEnabled: true,
    }),
  );

  if (!jio.error) {
    const mapped = mapPlaylists(jio?.data?.results || jio?.data, "jiosaavn");
    if (mapped.length) return mapped;
  }

  return [];
};

export const getMixPlaylists = async ({ seeds = [], limit = 12 } = {}) => {
  const interestSeeds = parseSeeds(seeds);
  const queries = uniqueById(
    [
      ...interestSeeds.map((s) => `${s} mix`),
      ...interestSeeds.map((s) => `${s} hits`),
      ...MIX_PLAYLIST_QUERIES,
    ].map((q) => ({ id: q, title: q })),
  )
    .map((x) => x.title)
    .slice(0, 6);

  const batches = await Promise.all(
    queries.map((query) =>
      safe(async () => searchPlaylistsByQuery(query, 4)),
    ),
  );

  const trending = await safe(() =>
    jiosaavnRequest("/api/trending/playlists", {
      params: { limit: 12 },
      cacheEnabled: true,
    }),
  );

  const trendingMapped = trending.error
    ? []
    : mapPlaylists(trending?.data?.results || trending?.data, "jiosaavn");

  const searched = batches.flatMap((b) => (b.error ? [] : b));

  return uniqueById([...searched, ...trendingMapped]).slice(0, limit);
};

/** Spotify-like multi-shelf playlist browse. */
export const getPlaylistShelves = async ({ seeds = [], perShelf = 8 } = {}) => {
  const interestSeeds = parseSeeds(seeds);
  const personalizedShelf =
    interestSeeds.length > 0
      ? {
          id: "for-you",
          title: "Made for you",
          subtitle: `Based on ${interestSeeds.slice(0, 2).join(", ")}`,
          query: `${interestSeeds[0]} mix`,
          accent: "#1DB954",
        }
      : null;

  const defs = [
    ...(personalizedShelf ? [personalizedShelf] : []),
    ...PLAYLIST_SHELF_DEFS,
  ].slice(0, 10);

  const shelves = await Promise.all(
    defs.map(async (def) => {
      const playlists = await safe(() =>
        searchPlaylistsByQuery(def.query, perShelf),
      );
      return {
        id: def.id,
        title: def.title,
        subtitle: def.subtitle,
        accent: def.accent,
        query: def.query,
        playlists: playlists.error
          ? []
          : uniqueById(playlists || []).slice(0, perShelf),
      };
    }),
  );

  return shelves.filter((s) => s.playlists.length > 0);
};

export const getThrowbackTracks = async ({ limit = 12 } = {}) => {
  const batches = await Promise.all(
    THROWBACK_QUERIES.map((query) =>
      safe(async () => {
        const res = await jiosaavnRequest("/api/search/songs", {
          params: { query, limit: 8 },
          cacheEnabled: true,
        });
        return mapTracks(res?.data?.results || [], mapFullJio).map(
          normalizePlayableTrack,
        );
      }),
    ),
  );

  return uniqueById(batches.flatMap((b) => (b.error ? [] : b)))
    .filter((t) => t && t.provider === "jiosaavn" && t.providerId)
    .slice(0, limit);
};

export const getHomeDiscovery = async ({ seeds = [] } = {}) => {
  const interestSeeds = parseSeeds(seeds);

  const [trending, charts, personalized, mixPlaylists, throwback, playlistShelves] =
    await Promise.all([
      safe(() => getTrending({ limit: 12 })),
      safe(() => getCharts({ limit: 12 })),
      safe(() => getPersonalizedDiscovery({ seeds: interestSeeds, limit: 12 })),
      safe(() => getMixPlaylists({ seeds: interestSeeds, limit: 12 })),
      safe(() => getThrowbackTracks({ limit: 12 })),
      safe(() => getPlaylistShelves({ seeds: interestSeeds, perShelf: 8 })),
    ]);

  const fullTracks = filterDiscoverableEntities(trending.tracks || []).filter(
    (t) => !t.isPreview,
  );
  const personalizedTracks = filterDiscoverableEntities(
    personalized.tracks || [],
  ).filter((t) => !t.isPreview);
  const chartTracks = filterDiscoverableEntities(charts.tracks || []);
  const throwbackTracks = throwback.error ? [] : throwback || [];
  const shelves = playlistShelves.error ? [] : playlistShelves || [];

  const featuredTracks = (
    personalizedTracks.length
      ? [...personalizedTracks, ...fullTracks]
      : fullTracks.length
        ? fullTracks
        : chartTracks
  ).slice(0, 6);

  const trendingAlbums = uniqueById([
    ...(personalized.albums || []),
    ...(trending.albums || []),
    ...albumsFromTracks(featuredTracks),
    ...(charts.albums || []),
  ]).slice(0, 12);

  const trendingArtists = uniqueById([
    ...(personalized.artists || []),
    ...(trending.artists || []),
    ...(charts.artists || []),
  ]).slice(0, 12);

  const trendingPlaylists = uniqueById([
    ...(mixPlaylists.error ? [] : mixPlaylists || []),
    ...(trending.playlists || []),
    ...(charts.playlists || []),
    ...shelves.flatMap((s) => s.playlists || []),
  ]).slice(0, 12);

  return {
    featured: featuredTracks,
    charts: personalizedTracks.length
      ? uniqueById([...personalizedTracks, ...fullTracks]).slice(0, 12)
      : fullTracks.length
        ? fullTracks
        : chartTracks,
    trendingAlbums,
    trendingArtists,
    trendingPlaylists,
    mixPlaylists: mixPlaylists.error ? trendingPlaylists : mixPlaylists || [],
    playlistShelves: shelves,
    throwbackTracks,
    radios: [],
    podcasts: [],
    personalized: Boolean(personalized.personalized && interestSeeds.length),
    interestSeeds,
    albumReasons: personalized.reasons || {},
    errors: [
      trending.error,
      charts.error,
      personalized.error,
      mixPlaylists.error,
      throwback.error,
      playlistShelves.error,
    ].filter(Boolean),
  };
};

export const getGenres = async () => {
  return {
    genres: [
      { id: "pop", title: "Pop", query: "pop", type: "mood" },
      { id: "rock", title: "Rock", query: "rock", type: "mood" },
      { id: "hip-hop", title: "Hip-Hop", query: "hip hop", type: "mood" },
      { id: "electronic", title: "Electronic", query: "electronic", type: "mood" },
      { id: "jazz", title: "Jazz", query: "jazz", type: "mood" },
      { id: "classical", title: "Classical", query: "classical", type: "mood" },
      { id: "indie", title: "Indie", query: "indie", type: "mood" },
      { id: "rnb", title: "R&B", query: "r&b", type: "mood" },
      { id: "bollywood", title: "Bollywood", query: "bollywood hits", type: "mood" },
      { id: "punjabi", title: "Punjabi", query: "punjabi hits", type: "mood" },
      { id: "tamil", title: "Tamil", query: "tamil hits", type: "mood" },
      { id: "telugu", title: "Telugu", query: "telugu hits", type: "mood" },
      { id: "romantic", title: "Romantic", query: "romantic bollywood", type: "mood" },
      { id: "party", title: "Party", query: "party mix bollywood", type: "mood" },
      { id: "chill", title: "Chill", query: "chill hindi", type: "mood" },
      { id: "workout", title: "Workout", query: "gym workout hindi", type: "mood" },
      { id: "lofi", title: "Lo-fi", query: "lofi study", type: "mood" },
      { id: "english", title: "English Pop", query: "english pop hits", type: "mood" },
      { id: "90s", title: "90s Hits", query: "90s bollywood hits", type: "mood" },
      { id: "2000s", title: "2000s", query: "2000s hindi songs", type: "mood" },
      {
        id: "classics",
        title: "Classics",
        query: "classic bollywood",
        type: "mood",
      },
      { id: "devotional", title: "Devotional", query: "bhajan", type: "mood" },
    ],
    note: "Moods resolve via JioSaavn + Audius search. Deezer genre radios were removed.",
  };
};

export const getGenreTracks = async ({ genre, limit = 20 }) => {
  const q = String(genre || "").trim();
  if (!q) return { tracks: [], radios: [] };

  const [jioRes, audiusRes] = await Promise.all([
    safe(() =>
      jiosaavnRequest("/api/search/songs", {
        params: { query: q, limit },
        cacheEnabled: true,
      }),
    ),
    safe(() =>
      sayaRequest("/v1/audius/search/tracks", {
        params: { q, limit },
        cache: true,
      }),
    ),
  ]);

  const jioTracks = jioRes.error
    ? []
    : mapTracks(jioRes?.data?.results || jioRes?.data, mapFullJio).map(
        normalizePlayableTrack,
      );
  const audiusTracks = audiusRes.error
    ? []
    : mapTracks(audiusRes?.data?.data || audiusRes?.data, mapAudiusTrack).map(
        normalizePlayableTrack,
      );

  return {
    genre: q,
    tracks: filterDiscoverableEntities([...jioTracks, ...audiusTracks]).slice(
      0,
      Number(limit) || 20,
    ),
    radios: [],
  };
};
