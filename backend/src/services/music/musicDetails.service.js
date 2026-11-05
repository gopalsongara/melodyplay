import { sayaRequest, SayaApiError } from "./saya.client.js";
import {
  jiosaavnRequest,
  pickBestDownloadUrl,
  extractArtistNames,
  extractImageUrl,
} from "./jiosaavn.client.js";
import {
  mapJioSaavnFullSong,
  mapAudiusTrack,
  mapAppleTrack,
  mapAlbum,
  mapArtist,
  mapPlaylist,
  mapTracks,
  mapAlbums,
  asArray,
  normalizePlayableTrack,
  pickImage,
} from "./music.mapper.js";
import { assertProviderAllowed } from "./providerRegistry.js";

const requireId = (id) => {
  if (!id) throw new SayaApiError("id is required", { status: 400 });
  return String(id);
};

export const getTrackDetails = async ({ provider = "audius", id }) => {
  const providerId = requireId(id);
  const p = String(provider).toLowerCase();
  assertProviderAllowed(p);

  if (p === "apple") {
    const res = await sayaRequest(`/v1/apple/tracks/${providerId}`, {
      cache: true,
    });
    const results = res?.data?.results || [res?.data];
    const raw = asArray(results)[0];
    const track = normalizePlayableTrack(
      raw
        ? {
            id: `apple:${raw.trackId || providerId}`,
            provider: "apple",
            providerId: String(raw.trackId || providerId),
            type: "track",
            title: raw.trackName,
            artist: raw.artistName,
            album: raw.collectionName,
            albumId: raw.collectionId ? String(raw.collectionId) : null,
            artistId: raw.artistId ? String(raw.artistId) : null,
            imgUrl: pickImage(
              raw.artworkUrl100?.replace("100x100", "600x600"),
              raw.artworkUrl100,
            ),
            duration: Math.round((raw.trackTimeMillis || 0) / 1000),
            audioUrl: raw.previewUrl || null,
            previewUrl: raw.previewUrl || null,
            playable: Boolean(raw.previewUrl),
            isPreview: Boolean(raw.previewUrl),
            previewDuration: raw.previewUrl ? 30 : null,
            mimeType: "audio/mpeg",
            externalUrl: raw.trackViewUrl || null,
          }
        : null,
    );
    if (!track) throw new SayaApiError("Track not found", { status: 404 });
    return { track, related: [] };
  }

  if (p === "audius") {
    const res = await sayaRequest(`/v1/audius/tracks/${providerId}`, {
      cache: true,
    });
    const data = res?.data?.data || res?.data;
    const artwork =
      data?.artwork?.["480x480"] ||
      data?.artwork?.["150x150"] ||
      data?.artwork?.["1000x1000"];
    const track = normalizePlayableTrack({
      id: `audius:${providerId}`,
      provider: "audius",
      providerId,
      type: "track",
      title: data?.title || "Unknown",
      artist: data?.user?.name || "Unknown Artist",
      imgUrl: pickImage(artwork),
      duration: data?.duration || 0,
      playable: true,
      needsStreamResolve: true,
      mimeType: "audio/mpeg",
      externalUrl: data?.permalink ? `https://audius.co${data.permalink}` : null,
      genre: data?.genre || null,
    });
    return { track, related: [] };
  }

  if (p === "jiosaavn") {
    const res = await jiosaavnRequest(`/api/songs/${providerId}`, {
      cacheEnabled: true,
    });
    const raw = Array.isArray(res?.data) ? res.data[0] : res?.data;
    const track = normalizePlayableTrack(
      mapJioSaavnFullSong(raw, {
        pickBestDownloadUrl,
        extractArtistNames,
        extractImageUrl,
      }),
    );
    if (!track) throw new SayaApiError("Track not found", { status: 404 });

    let related = [];
    try {
      const suggestions = await jiosaavnRequest(
        `/api/songs/${providerId}/suggestions`,
        { params: { limit: 15 }, cacheEnabled: true },
      );
      const list = Array.isArray(suggestions?.data)
        ? suggestions.data
        : suggestions?.data?.results || [];
      related = mapTracks(list, (item) =>
        mapJioSaavnFullSong(item, {
          pickBestDownloadUrl,
          extractArtistNames,
          extractImageUrl,
        }),
      ).map(normalizePlayableTrack);
    } catch {
      related = [];
    }

    return { track, related };
  }

  throw new SayaApiError(`Unsupported provider: ${provider}`, { status: 400 });
};

const mapFullJio = (item) =>
  mapJioSaavnFullSong(item, {
    pickBestDownloadUrl,
    extractArtistNames,
    extractImageUrl,
  });

export const getAlbumDetails = async ({ provider = "jiosaavn", id }) => {
  const providerId = requireId(id);
  const p = String(provider).toLowerCase();
  assertProviderAllowed(p);

  if (p === "jiosaavn") {
    const res = await jiosaavnRequest("/api/albums", {
      params: { id: providerId },
      cacheEnabled: true,
    });
    const raw = res?.data;
    const album = mapAlbum(raw, "jiosaavn");
    if (!album) throw new SayaApiError("Album not found", { status: 404 });

    const tracks = mapTracks(raw?.songs, mapFullJio).map((t) =>
      normalizePlayableTrack({
        ...t,
        album: album.title,
        albumId: album.providerId,
        imgUrl: t.imgUrl || album.imgUrl,
      }),
    );

    return { album, tracks };
  }

  if (p === "apple") {
    const url = new URL("https://itunes.apple.com/lookup");
    url.searchParams.set("id", providerId);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "200");
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new SayaApiError(`Apple lookup HTTP ${res.status}`, {
        status: 502,
      });
    }
    const data = await res.json();
    const results = data?.results || [];
    const collection = results.find((r) => r.wrapperType === "collection");
    const songs = results.filter((r) => r.wrapperType === "track");
    const album = mapAlbum(collection || results[0], "apple");
    if (!album) throw new SayaApiError("Album not found", { status: 404 });

    const tracks = mapTracks(songs, mapAppleTrack).map((t) =>
      normalizePlayableTrack({
        ...t,
        album: album.title,
        albumId: album.providerId,
        imgUrl: t.imgUrl || album.imgUrl,
      }),
    );

    return {
      album: {
        ...album,
        playbackCapability: "preview_only",
        detailCapability: "itunes_lookup",
      },
      tracks,
    };
  }

  throw new SayaApiError(
    `Album tracklists are not available for provider "${p}"`,
    { status: 501 },
  );
};

export const getArtistDetails = async ({ provider = "jiosaavn", id }) => {
  const providerId = requireId(id);
  const p = String(provider).toLowerCase();
  assertProviderAllowed(p);

  if (p === "jiosaavn") {
    const res = await jiosaavnRequest("/api/artists", {
      params: { id: providerId },
      cacheEnabled: true,
    });
    const raw = res?.data;
    const artist = mapArtist(raw, "jiosaavn");
    if (!artist) throw new SayaApiError("Artist not found", { status: 404 });

    const topTracks = mapTracks(raw?.topSongs || raw?.songs, mapFullJio).map(
      normalizePlayableTrack,
    );
    const albums = mapAlbums(
      raw?.topAlbums || raw?.albums || [],
      "jiosaavn",
    );

    return { artist, topTracks, albums };
  }

  if (p === "apple") {
    const { appleAdapter } = await import("./adapters/apple.adapter.js");
    const [artist, albums] = await Promise.all([
      appleAdapter.getArtist(providerId),
      appleAdapter.getArtistAlbums(providerId, { limit: 50 }),
    ]);
    if (!artist) throw new SayaApiError("Artist not found", { status: 404 });

    return {
      artist: {
        ...artist,
        playbackCapability: "preview",
        detailCapability: "itunes_lookup",
      },
      // Never list Apple 30s previews as playable top tracks
      topTracks: [],
      albums,
      singles: albums.filter((a) =>
        /single/i.test(a.title || ""),
      ),
      note: "Apple artist pages are metadata-only; preview clips are not listed as songs",
    };
  }

  if (p === "musicbrainz") {
    const { musicbrainzAdapter } = await import(
      "./adapters/musicbrainz.adapter.js"
    );
    const artist = await musicbrainzAdapter.getArtist(providerId);
    if (!artist) throw new SayaApiError("Artist not found", { status: 404 });
    const albums = await musicbrainzAdapter.getArtistAlbums(providerId, {
      limit: 50,
    });
    return {
      artist,
      topTracks: [],
      albums,
      note: "MusicBrainz provides metadata only — no playback streams",
    };
  }

  throw new SayaApiError(
    `Artist discography details are not available for provider "${p}"`,
    { status: 501 },
  );
};

export const getPlaylistDetails = async ({ provider = "jiosaavn", id }) => {
  const providerId = requireId(id);
  const p = String(provider).toLowerCase();
  assertProviderAllowed(p);

  if (p === "jiosaavn") {
    const res = await jiosaavnRequest("/api/playlists", {
      params: { id: providerId },
      cacheEnabled: true,
    });
    const raw = res?.data;
    const playlist = mapPlaylist(raw, "jiosaavn");
    if (!playlist) throw new SayaApiError("Playlist not found", { status: 404 });

    const tracks = mapTracks(raw?.songs, mapFullJio).map(normalizePlayableTrack);
    return { playlist, tracks };
  }

  throw new SayaApiError(
    "Playlist tracklists are currently available for JioSaavn",
    { status: 501 },
  );
};

export const getPodcastDetails = async ({ id }) => {
  requireId(id);
  throw new SayaApiError(
    "Podcast catalog is unavailable after Deezer removal",
    { status: 410 },
  );
};

export const getRelatedTracks = async ({
  provider = "jiosaavn",
  id,
  artist,
  title,
}) => {
  const providerId = id ? String(id) : "";
  const p = String(provider || "").toLowerCase();
  if (p) {
    try {
      assertProviderAllowed(p);
    } catch {
      return { tracks: [] };
    }
  }
  const artistName = String(artist || "").split(",")[0].trim();
  const titleName = String(title || "").trim();

  let searchQuery = artistName || titleName;

  if (!searchQuery && p === "jiosaavn" && providerId) {
    try {
      const songRes = await jiosaavnRequest(`/api/songs/${providerId}`, {
        cacheEnabled: true,
      });
      const raw = Array.isArray(songRes?.data)
        ? songRes.data[0]
        : songRes?.data;
      searchQuery =
        extractArtistNames(raw?.artists)?.split(",")[0]?.trim() ||
        raw?.name ||
        raw?.title ||
        "";
    } catch {
      searchQuery = "";
    }
  }

  if (!searchQuery && p === "audius" && providerId) {
    try {
      const res = await sayaRequest(`/v1/audius/tracks/${providerId}`, {
        cache: true,
      });
      const data = res?.data?.data || res?.data;
      searchQuery = data?.user?.name || data?.title || "";
    } catch {
      searchQuery = "";
    }
  }

  if (!searchQuery) return { tracks: [] };

  const tracks = [];

  try {
    const res = await jiosaavnRequest("/api/search/songs", {
      params: { query: searchQuery, limit: 20 },
      cacheEnabled: true,
    });
    tracks.push(
      ...mapTracks(res?.data?.results || [], mapFullJio)
        .map(normalizePlayableTrack)
        .filter(
          (t) =>
            t &&
            t.provider === "jiosaavn" &&
            t.providerId &&
            (!providerId || t.providerId !== providerId),
        ),
    );
  } catch {
    /* sidecar may be down */
  }

  if (tracks.length < 8) {
    try {
      const audius = await sayaRequest("/v1/audius/search/tracks", {
        params: { q: searchQuery, limit: 15 },
        cache: true,
      });
      tracks.push(
        ...mapTracks(audius?.data?.data || audius?.data || [], mapAudiusTrack)
          .map(normalizePlayableTrack)
          .filter(
            (t) =>
              t &&
              (!providerId ||
                t.provider !== p ||
                t.providerId !== providerId),
          ),
      );
    } catch {
      /* ignore */
    }
  }

  return { tracks: tracks.slice(0, 15) };
};

export const resolveExternalLinks = async ({ url }) => {
  if (!url) throw new SayaApiError("url is required", { status: 400 });
  const res = await sayaRequest("/v1/resolve", {
    params: { url },
    cache: true,
  });
  return res?.data || res;
};
