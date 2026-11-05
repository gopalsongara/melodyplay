import { axiosInstance } from "@/lib/axios";
import type { PlayableTrack, UserPlaylist } from "@/types";
import { create } from "zustand";
import toast from "react-hot-toast";
import { isAxiosError } from "axios";

const FAVORITES_KEY = "melodyplay-favorites";

interface LibraryStore {
  favorites: PlayableTrack[];
  history: PlayableTrack[];
  playlists: UserPlaylist[];
  isLoading: boolean;

  fetchFavorites: () => Promise<void>;
  toggleFavorite: (track: PlayableTrack) => Promise<void>;
  isFavorite: (trackId: string) => boolean;
  syncLocalFavoritesToServer: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  createPlaylist: (title: string) => Promise<UserPlaylist | null>;
  addToPlaylist: (playlistId: string, track: PlayableTrack) => Promise<void>;
}

const trackKey = (track: Partial<PlayableTrack> | string | null | undefined) => {
  if (!track) return "";
  if (typeof track === "string") return track;
  return String(track._id || track.id || track.providerId || "");
};

const toPlayable = (item: any): PlayableTrack => ({
  _id: item.trackId || item._id || item.id,
  id: item.trackId || item.id || item._id,
  provider: item.provider || "unknown",
  providerId: item.providerId || String(item.trackId || item.id || "").split(":")[1] || "",
  title: item.title || "Unknown",
  artist: item.artist || "Unknown Artist",
  album: item.album,
  imgUrl: item.imgUrl,
  audioUrl: item.audioUrl,
  duration: item.duration || 0,
  isPreview: item.isPreview,
  mimeType: item.mimeType,
  externalUrl: item.externalUrl,
  playable: Boolean(item.audioUrl || item.playable),
  source: "external",
  needsStreamResolve: item.needsStreamResolve,
});

const readLocalFavorites = (): PlayableTrack[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toPlayable);
  } catch {
    return [];
  }
};

const writeLocalFavorites = (favorites: PlayableTrack[]) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // ignore quota errors
  }
};

const favoritePayload = (track: PlayableTrack) => {
  const id = trackKey(track);
  return {
    ...track,
    _id: id,
    id,
    trackId: id,
    provider: track.provider || "unknown",
    providerId:
      track.providerId ||
      (id.includes(":") ? id.split(":").slice(1).join(":") : id),
    title: track.title || "Unknown",
    artist: track.artist || "Unknown Artist",
    album: typeof track.album === "string" ? track.album : track.album || null,
    imgUrl: track.imgUrl || "",
    audioUrl: track.audioUrl || "",
    duration: track.duration || 0,
    isPreview: Boolean(track.isPreview),
    mimeType: track.mimeType || null,
    externalUrl: track.externalUrl || null,
  };
};

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  favorites: readLocalFavorites(),
  history: [],
  playlists: [],
  isLoading: false,

  fetchFavorites: async () => {
    const local = readLocalFavorites();
    try {
      const { data } = await axiosInstance.get("/library/favorites");
      const remote = (data.data || []).map(toPlayable);
      const mergedMap = new Map<string, PlayableTrack>();
      [...remote, ...local].forEach((track) => {
        const key = trackKey(track);
        if (key) mergedMap.set(key, track);
      });
      const favorites = Array.from(mergedMap.values());
      writeLocalFavorites(favorites);
      set({ favorites });
    } catch {
      set({ favorites: local });
    }
  },

  isFavorite: (trackId) => {
    const id = trackKey(trackId);
    if (!id) return false;
    return get().favorites.some((f) => trackKey(f) === id);
  },

  toggleFavorite: async (track) => {
    const payload = favoritePayload(track);
    const id = trackKey(payload);
    if (!id) {
      toast.error("Could not favorite this track");
      return;
    }

    const exists = get().isFavorite(id);
    const previous = get().favorites;

    const next = exists
      ? previous.filter((f) => trackKey(f) !== id)
      : [payload, ...previous.filter((f) => trackKey(f) !== id)];

    writeLocalFavorites(next);
    set({ favorites: next });
    toast.success(exists ? "Removed from Liked Songs" : "Added to Liked Songs");

    try {
      if (exists) {
        await axiosInstance.delete(
          `/library/favorites/${encodeURIComponent(id)}`,
        );
      } else {
        await axiosInstance.post("/library/favorites", payload);
      }
    } catch (error) {
      // Keep local favorite working even if user is signed out / API fails
      if (isAxiosError(error) && error.response?.status === 401) {
        toast("Saved on this device — sign in to sync", { icon: "♡" });
        return;
      }
      // Revert only on unexpected server errors after auth
      if (isAxiosError(error) && error.response?.status && error.response.status < 500) {
        // validation etc — keep local anyway
        return;
      }
    }
  },

  syncLocalFavoritesToServer: async () => {
    const local = readLocalFavorites();
    if (!local.length) return;

    for (const track of local) {
      try {
        await axiosInstance.post("/library/favorites", favoritePayload(track));
      } catch {
        // ignore individual failures
      }
    }
  },

  fetchHistory: async () => {
    try {
      const { data } = await axiosInstance.get("/library/history");
      set({ history: (data.data || []).map(toPlayable) });
    } catch {
      set({ history: [] });
    }
  },

  clearHistory: async () => {
    try {
      await axiosInstance.delete("/library/history");
      set({ history: [] });
      toast.success("History cleared");
    } catch {
      toast.error("Could not clear history");
    }
  },

  fetchPlaylists: async () => {
    try {
      const { data } = await axiosInstance.get("/library/playlists");
      set({ playlists: data.data || [] });
    } catch {
      set({ playlists: [] });
    }
  },

  createPlaylist: async (title) => {
    try {
      const { data } = await axiosInstance.post("/library/playlists", { title });
      set({ playlists: [data.data, ...get().playlists] });
      toast.success("Playlist created");
      return data.data;
    } catch {
      toast.error("Sign in to create playlists");
      return null;
    }
  },

  addToPlaylist: async (playlistId, track) => {
    try {
      await axiosInstance.post(
        `/library/playlists/${playlistId}/tracks`,
        favoritePayload(track),
      );
      toast.success("Added to playlist");
      await get().fetchPlaylists();
    } catch {
      toast.error("Could not add to playlist");
    }
  },
}));
