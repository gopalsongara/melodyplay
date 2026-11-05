import { itunesSearch } from "../itunes.client.js";
import {
  mapAppleTrack,
  mapAppleAlbum,
  mapAppleArtist,
  mapTracks,
  normalizePlayableTrack,
} from "../music.mapper.js";
import { PlaybackType, createStubAdapter } from "./providerAdapter.js";

const lookup = async ({ id, entity, limit = 50 }) => {
  const url = new URL("https://itunes.apple.com/lookup");
  url.searchParams.set("id", String(id));
  if (entity) url.searchParams.set("entity", entity);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "IN");
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`iTunes lookup HTTP ${res.status}`);
  return res.json();
};

export const appleAdapter = {
  ...createStubAdapter("apple", {
    searchSongs: true,
    searchArtists: true,
    searchAlbums: true,
    getArtist: true,
    getArtistSongs: true,
    getArtistAlbums: true,
    getAlbum: true,
    getAlbumTracks: true,
    playbackType: PlaybackType.PREVIEW,
  }),

  async searchSongs(query, { limit = 25 } = {}) {
    const itunes = await itunesSearch({ term: query, entity: "song", limit });
    return mapTracks(itunes?.results || [], mapAppleTrack)
      .map(normalizePlayableTrack)
      .map((t) => ({
        ...t,
        playbackType: PlaybackType.PREVIEW,
        playbackAvailable: Boolean(t.audioUrl),
      }));
  },

  async searchArtists(query, { limit = 10 } = {}) {
    const itunes = await itunesSearch({
      term: query,
      entity: "musicArtist",
      limit: Math.max(limit, 8),
    });
    const artists = (itunes?.results || []).map(mapAppleArtist).filter(Boolean);
    // Prefer exact / near-exact name matches; collapse duplicate display names
    // by keeping the first (typically primary) artistId for that name.
    const seenNames = new Set();
    const ranked = [];
    for (const a of artists) {
      const key = String(a.name || a.title || "")
        .toLowerCase()
        .trim();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      ranked.push(a);
      if (ranked.length >= limit) break;
    }
    return ranked;
  },

  /** Resolve best Apple artist ID for a query (exact-ish name match). */
  async resolveArtist(query) {
    const artists = await this.searchArtists(query, { limit: 5 });
    const q = String(query || "")
      .toLowerCase()
      .trim();
    const exact = artists.find(
      (a) => String(a.name || "").toLowerCase().trim() === q,
    );
    return exact || artists[0] || null;
  },

  async searchAlbums(query, { limit = 25 } = {}) {
    const itunes = await itunesSearch({ term: query, entity: "album", limit });
    return (itunes?.results || []).map(mapAppleAlbum).filter(Boolean);
  },

  async getArtist(artistId) {
    const data = await lookup({ id: artistId, entity: "album", limit: 1 });
    const row = (data.results || []).find((r) => r.wrapperType === "artist");
    return mapAppleArtist(row || { artistId, artistName: "Artist" });
  },

  async getArtistSongs(artistId, { limit = 50 } = {}) {
    const data = await lookup({ id: artistId, entity: "song", limit });
    const songs = (data.results || []).filter((r) => r.wrapperType === "track");
    return mapTracks(songs, mapAppleTrack)
      .map(normalizePlayableTrack)
      .map((t) => ({
        ...t,
        playbackType: PlaybackType.PREVIEW,
        playbackAvailable: Boolean(t.audioUrl),
      }));
  },

  async getArtistAlbums(artistId, { limit = 50 } = {}) {
    const data = await lookup({ id: artistId, entity: "album", limit });
    return (data.results || [])
      .filter((r) => r.wrapperType === "collection")
      .map(mapAppleAlbum)
      .filter(Boolean);
  },

  async getAlbum(albumId) {
    const data = await lookup({ id: albumId, entity: "song", limit: 1 });
    const collection = (data.results || []).find(
      (r) => r.wrapperType === "collection",
    );
    return mapAppleAlbum(collection || null);
  },

  async getAlbumTracks(albumId, { limit = 200 } = {}) {
    const data = await lookup({ id: albumId, entity: "song", limit });
    const songs = (data.results || []).filter((r) => r.wrapperType === "track");
    return mapTracks(songs, mapAppleTrack)
      .map(normalizePlayableTrack)
      .map((t) => ({
        ...t,
        playbackType: PlaybackType.PREVIEW,
        playbackAvailable: Boolean(t.audioUrl),
      }));
  },
};
