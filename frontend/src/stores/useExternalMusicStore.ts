import { axiosInstance } from "@/lib/axios";
import type {
  Album,
  Artist,
  ExternalPlaylist,
  PlayableTrack,
  Podcast,
  RadioStation,
} from "@/types";
import { create } from "zustand";
import { isAxiosError } from "axios";

interface ExternalMusicStore {
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  homeFeatured: PlayableTrack[];
  charts: PlayableTrack[];
  trendingAlbums: Album[];
  trendingArtists: Artist[];
  trendingPlaylists: ExternalPlaylist[];
  mixPlaylists: ExternalPlaylist[];
  playlistShelves: Array<{
    id: string;
    title: string;
    subtitle?: string;
    accent?: string;
    query?: string;
    playlists: ExternalPlaylist[];
  }>;
  throwbackTracks: PlayableTrack[];
  homeRadios: any[];
  homePodcasts: Podcast[];
  forYouAlbums: Album[];
  albumReasons: Record<string, string>;
  interestSeeds: string[];
  isPersonalized: boolean;
  searchResults: {
    tracks: PlayableTrack[];
    albums: Album[];
    artists: Artist[];
    playlists: ExternalPlaylist[];
    podcasts: Podcast[];
    recommended?: PlayableTrack[];
    recommendSeed?: { artist?: string; title?: string } | null;
    topResult?: PlayableTrack | Album | Artist | null;
    intent?: { intent?: string; confidence?: number } | null;
    searchPrimary?: string | null;
    providerErrors?: Array<{ provider?: string; error?: string }>;
  };
  suggestions: Array<{ text: string; type: string; track?: PlayableTrack }>;
  currentAlbum: { album: Album; tracks: PlayableTrack[] } | null;
  currentArtist: {
    artist: Artist;
    topTracks: PlayableTrack[];
    albums: Album[];
    singles?: Album[];
  } | null;
  currentPlaylist: { playlist: ExternalPlaylist; tracks: PlayableTrack[] } | null;
  radioStations: RadioStation[];
  genres: Array<{ id: string; title: string; query: string }>;
  genreTracks: PlayableTrack[];
  relatedTracks: PlayableTrack[];
  lyrics: {
    available: boolean;
    message?: string;
    lyrics?: string | null;
  } | null;

  fetchHome: (seeds?: string[]) => Promise<void>;
  fetchCharts: () => Promise<void>;
  search: (q: string) => Promise<void>;
  autocomplete: (q: string) => Promise<void>;
  fetchAlbum: (provider: string, id: string) => Promise<void>;
  fetchArtist: (provider: string, id: string) => Promise<void>;
  fetchPlaylist: (provider: string, id: string) => Promise<void>;
  fetchRadio: (params?: { q?: string; tag?: string }) => Promise<void>;
  fetchGenres: () => Promise<void>;
  fetchGenre: (genre: string) => Promise<void>;
  fetchRelated: (provider: string, id: string) => Promise<void>;
  fetchLyrics: (params: {
    provider?: string;
    id?: string;
    artist?: string;
    title?: string;
  }) => Promise<void>;
  setSearchQuery: (q: string) => void;
  clearSearch: () => void;
}

const emptySearch = {
  tracks: [] as PlayableTrack[],
  albums: [] as Album[],
  artists: [] as Artist[],
  playlists: [] as ExternalPlaylist[],
  podcasts: [] as Podcast[],
  recommended: [] as PlayableTrack[],
  recommendSeed: null as { artist?: string; title?: string } | null,
  topResult: null as PlayableTrack | Album | Artist | null,
  intent: null as { intent?: string; confidence?: number } | null,
  searchPrimary: null as string | null,
  providerErrors: [] as Array<{ provider?: string; error?: string }>,
};

let searchRequestId = 0;
let autocompleteRequestId = 0;

export const useExternalMusicStore = create<ExternalMusicStore>((set) => ({
  isLoading: false,
  error: null,
  searchQuery: "",
  homeFeatured: [],
  charts: [],
  trendingAlbums: [],
  trendingArtists: [],
  trendingPlaylists: [],
  mixPlaylists: [],
  playlistShelves: [],
  throwbackTracks: [],
  homeRadios: [],
  homePodcasts: [],
  forYouAlbums: [],
  albumReasons: {},
  interestSeeds: [],
  isPersonalized: false,
  searchResults: emptySearch,
  suggestions: [],
  currentAlbum: null,
  currentArtist: null,
  currentPlaylist: null,
  radioStations: [],
  genres: [],
  genreTracks: [],
  relatedTracks: [],
  lyrics: null,

  fetchHome: async (seeds = []) => {
    set({ isLoading: true, error: null });
    try {
      const cleanSeeds = [...new Set(seeds.map((s) => s.trim()).filter(Boolean))];
      const { data } = await axiosInstance.get("/music/home", {
        params: cleanSeeds.length ? { seeds: cleanSeeds.join(",") } : undefined,
      });
      const payload = data.data;
      const albums = payload.trendingAlbums || [];
      set({
        homeFeatured: payload.featured || [],
        charts: payload.charts || [],
        trendingAlbums: albums,
        forYouAlbums: payload.personalized ? albums : albums,
        trendingArtists: payload.trendingArtists || [],
        trendingPlaylists: payload.trendingPlaylists || [],
        mixPlaylists: payload.mixPlaylists || payload.trendingPlaylists || [],
        playlistShelves: payload.playlistShelves || [],
        throwbackTracks: payload.throwbackTracks || [],
        homeRadios: payload.radios || [],
        homePodcasts: payload.podcasts || [],
        albumReasons: payload.albumReasons || {},
        interestSeeds: payload.interestSeeds || cleanSeeds,
        isPersonalized: Boolean(payload.personalized),
      });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Failed to load home"
          : "Failed to load home",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCharts: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/music/charts");
      set({
        charts: data.data.tracks || [],
        trendingAlbums: data.data.albums || [],
        trendingArtists: data.data.artists || [],
        trendingPlaylists: data.data.playlists || [],
      });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Failed to load charts"
          : "Failed to load charts",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  search: async (q) => {
    const requestId = ++searchRequestId;
    if (!q.trim()) {
      set({ searchResults: emptySearch, isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/music/search", {
        params: { q, limit: 16 },
      });
      if (requestId !== searchRequestId) return;
      const raw = data.data || emptySearch;
      const stripBlocked = <T extends { provider?: string; audioUrl?: string }>(
        items: T[] = [],
      ) =>
        items.filter((t) => {
          const p = String(t.provider || "").toLowerCase();
          if (p === "deezer" || p.startsWith("deezer")) return false;
          if (/dzcdn\.net|deezer\.com/i.test(String(t.audioUrl || "")))
            return false;
          return true;
        });
      // Song rows: never show Apple / preview / ≤45s stub clips
      const tracks = stripBlocked(raw.tracks || []).filter((t) => {
        const p = String(t.provider || "").toLowerCase();
        if (p === "apple") return false;
        if ((t as { isPreview?: boolean }).isPreview) return false;
        const dur = Number((t as { duration?: number }).duration || 0);
        if (dur > 0 && dur <= 45) return false;
        return true;
      });
      const topOk = raw.topResult
        ? stripBlocked([raw.topResult as { provider?: string; audioUrl?: string }])
            .length > 0
        : false;
      set({
        searchResults: {
          ...raw,
          tracks,
          albums: stripBlocked(raw.albums || []),
          artists: stripBlocked(raw.artists || []),
          playlists: stripBlocked(raw.playlists || []),
          recommended: stripBlocked(raw.recommended || []),
          topResult: topOk ? raw.topResult : tracks[0] || null,
        },
      });
    } catch (error) {
      if (requestId !== searchRequestId) return;
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Search failed"
          : "Search failed",
        searchResults: emptySearch,
      });
    } finally {
      if (requestId === searchRequestId) set({ isLoading: false });
    }
  },

  autocomplete: async (q) => {
    const requestId = ++autocompleteRequestId;
    if (q.trim().length < 2) {
      set({ suggestions: [] });
      return;
    }
    try {
      const { data } = await axiosInstance.get("/music/autocomplete", {
        params: { q, limit: 8 },
      });
      if (requestId !== autocompleteRequestId) return;
      set({ suggestions: data.data.suggestions || [] });
    } catch {
      if (requestId !== autocompleteRequestId) return;
      set({ suggestions: [] });
    }
  },

  fetchAlbum: async (provider, id) => {
    set({ isLoading: true, error: null, currentAlbum: null });
    try {
      const { data } = await axiosInstance.get(
        `/music/albums/${provider}/${id}`,
      );
      set({ currentAlbum: data.data });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Album not found"
          : "Album not found",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchArtist: async (provider, id) => {
    set({ isLoading: true, error: null, currentArtist: null });
    try {
      const { data } = await axiosInstance.get(
        `/music/artists/${provider}/${id}`,
      );
      set({ currentArtist: data.data });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Artist not found"
          : "Artist not found",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPlaylist: async (provider, id) => {
    set({ isLoading: true, error: null, currentPlaylist: null });
    try {
      const { data } = await axiosInstance.get(
        `/music/playlists/${provider}/${id}`,
      );
      set({ currentPlaylist: data.data });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Playlist not found"
          : "Playlist not found",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRadio: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/music/radio", { params });
      set({ radioStations: data.data.stations || [] });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Radio fetch failed"
          : "Radio fetch failed",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchGenres: async () => {
    try {
      const { data } = await axiosInstance.get("/music/genres");
      set({ genres: data.data.genres || [] });
    } catch {
      set({ genres: [] });
    }
  },

  fetchGenre: async (genre) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axiosInstance.get(
        `/music/genres/${encodeURIComponent(genre)}`,
      );
      set({ genreTracks: data.data.tracks || [] });
    } catch (error) {
      set({
        error: isAxiosError(error)
          ? error.response?.data?.message || "Genre fetch failed"
          : "Genre fetch failed",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRelated: async (provider, id) => {
    try {
      const { data } = await axiosInstance.get(
        `/music/related/${provider}/${id}`,
      );
      set({ relatedTracks: data.data.tracks || [] });
    } catch {
      set({ relatedTracks: [] });
    }
  },

  fetchLyrics: async (params) => {
    try {
      const { data } = await axiosInstance.get("/music/lyrics", { params });
      set({ lyrics: data.data });
    } catch {
      set({
        lyrics: {
          available: false,
          message: "Lyrics unavailable",
        },
      });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  clearSearch: () => {
    searchRequestId += 1;
    autocompleteRequestId += 1;
    set({
      searchResults: emptySearch,
      suggestions: [],
      isLoading: false,
      error: null,
    });
  },
}));
