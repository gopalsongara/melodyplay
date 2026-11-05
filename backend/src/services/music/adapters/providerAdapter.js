/**
 * Shared adapter contract for MelodyPlay catalogue providers.
 * Adapters must never leak raw provider payloads to the frontend.
 */

export const PlaybackType = {
  AUTHORIZED_FULL_STREAM: "authorized_full_stream",
  OFFICIAL_EMBEDDED_PLAYER: "official_embedded_player",
  PREVIEW: "preview",
  UNAVAILABLE: "unavailable",
  METADATA_ONLY: "metadata_only",
};

/**
 * @typedef {Object} AdapterCapabilities
 * @property {boolean} searchSongs
 * @property {boolean} searchArtists
 * @property {boolean} searchAlbums
 * @property {boolean} searchPlaylists
 * @property {boolean} getArtist
 * @property {boolean} getArtistSongs
 * @property {boolean} getArtistAlbums
 * @property {boolean} getAlbum
 * @property {boolean} getAlbumTracks
 * @property {boolean} getPlaylist
 * @property {string} playbackType
 */

/**
 * Create a stub adapter that reports missing capabilities honestly.
 */
export const createStubAdapter = (name, capabilities = {}) => ({
  name,
  capabilities: {
    searchSongs: false,
    searchArtists: false,
    searchAlbums: false,
    searchPlaylists: false,
    getArtist: false,
    getArtistSongs: false,
    getArtistAlbums: false,
    getAlbum: false,
    getAlbumTracks: false,
    getPlaylist: false,
    playbackType: PlaybackType.UNAVAILABLE,
    ...capabilities,
  },
  async searchSongs() {
    return [];
  },
  async searchArtists() {
    return [];
  },
  async searchAlbums() {
    return [];
  },
  async searchPlaylists() {
    return [];
  },
  async getArtist() {
    return null;
  },
  async getArtistSongs() {
    return [];
  },
  async getArtistAlbums() {
    return [];
  },
  async getAlbum() {
    return null;
  },
  async getAlbumTracks() {
    return [];
  },
  async getPlaylist() {
    return null;
  },
});
