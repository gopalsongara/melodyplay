import type { PlayableTrack, RepeatMode, Song } from "@/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { axiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";
import {
  isUntrustedCatalogueTrack,
  playbackBlockedReason,
  sanitizePersistedTrack,
  sanitizeTrackList,
} from "@/lib/legacyTrackPolicy";

type Track = PlayableTrack | Song;

const axiosErrorMessage = (error: unknown, fallback: string) => {
  const err = error as {
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  const apiMsg = err?.response?.data?.message;
  if (apiMsg) return apiMsg;
  const status = err?.response?.status;
  if (status === 410) return "This provider is no longer available in MelodyPlay";
  if (status === 403) return "This source is blocked from MelodyPlay playback";
  if (status === 502 || status === 503)
    return "Playback service temporarily unavailable (upstream error)";
  return err?.message || fallback;
};

export interface PlaybackDiagnostics {
  provider?: string;
  isPreview?: boolean;
  upgradeAttempted?: boolean;
  upgradeSucceeded?: boolean;
  upgradeSource?: string | null;
  audioHost?: string | null;
  audioReadyState?: number | null;
  mediaErrorCode?: number | null;
  actualDuration?: number | null;
  note?: string | null;
}

const audioHostOf = (url?: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

interface PlayerStore {
  currentSong: Track | null;
  isPlaying: boolean;
  shouldAutoplay: boolean;
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  recentlyPlayed: Track[];
  playbackError: string | null;
  isBuffering: boolean;
  /** Safe playback diagnostics (no secrets / full signed URLs) */
  playbackDiagnostics: PlaybackDiagnostics | null;
  playerExpanded: boolean;

  setShouldAutoplay: (v: boolean) => void;
  setVolume: (v: number) => void;
  setBuffering: (v: boolean) => void;
  setPlaybackError: (msg: string | null) => void;
  setPlaybackDiagnostics: (d: PlaybackDiagnostics | null) => void;
  setPlayerExpanded: (v: boolean) => void;
  initQueue: (songs: Track[]) => void;
  playAt: (songs: Track[], index?: number) => Promise<void>;
  setCurrentSong: (song: Track | null) => Promise<void>;
  togglePlay: () => void;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (song: Track) => void;
  /** Insert right after current song — plays as the very next track */
  playNextInQueue: (song: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  resolveStreamIfNeeded: (song: Track) => Promise<Track>;
  extendQueueWithRelated: () => Promise<boolean>;
}

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const trackKey = (t: Track) => t._id || (t as PlayableTrack).id || "";

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      shouldAutoplay: false,
      queue: [],
      originalQueue: [],
      currentIndex: -1,
      volume: 0.75,
      isShuffle: false,
      repeatMode: "off",
      recentlyPlayed: [],
      playbackError: null,
      isBuffering: false,
      playbackDiagnostics: null,
      playerExpanded: false,

      setShouldAutoplay: (v) => set({ shouldAutoplay: v }),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
      setBuffering: (v) => set({ isBuffering: v }),
      setPlaybackError: (msg) => set({ playbackError: msg }),
      setPlaybackDiagnostics: (d) => set({ playbackDiagnostics: d }),
      setPlayerExpanded: (v) => set({ playerExpanded: v }),

      resolveStreamIfNeeded: async (song) => {
        const playable = song as PlayableTrack;
        let upgradeAttempted = false;
        let upgradeSucceeded = false;
        let upgradeSource: string | null = null;

        const blocked = playbackBlockedReason(playable);
        if (blocked) {
          throw new Error(blocked);
        }

        // Never trust a cached Deezer CDN URL even if provider field was cleared
        if (
          /dzcdn\.net|deezer\.com/i.test(
            String(
              playable.audioUrl ||
                (playable as PlayableTrack & { streamUrl?: string }).streamUrl ||
                "",
            ),
          )
        ) {
          throw new Error("Deezer streams are not available in MelodyPlay");
        }

        // Upgrade Apple 30s previews to full track when authorized source available
        const looksLikePreview =
          Boolean(playable.isPreview) ||
          playable.provider === "apple" ||
          ((playable.duration || 0) > 0 &&
            (playable.duration || 0) <= 35 &&
            playable.provider !== "jiosaavn" &&
            playable.provider !== "audius");

        if (looksLikePreview && playable.title) {
          upgradeAttempted = true;
          try {
            const { data } = await axiosInstance.post("/music/upgrade-full", {
              title: playable.title,
              artist: playable.artist,
              provider: playable.provider,
              providerId: playable.providerId,
              duration: playable.duration,
              isPreview: playable.isPreview,
            });
            const upgraded = data?.data?.track;
            if (upgraded?.audioUrl && !upgraded.isPreview) {
              upgradeSucceeded = true;
              upgradeSource = upgraded.provider || "full";
              const resolved = {
                ...song,
                ...upgraded,
                _id: upgraded._id || upgraded.id,
                id: upgraded.id || upgraded._id,
                needsStreamResolve: false,
                playable: true,
                isPreview: false,
              };
              set({
                playbackDiagnostics: {
                  provider: upgraded.provider,
                  isPreview: false,
                  upgradeAttempted,
                  upgradeSucceeded,
                  upgradeSource,
                  audioHost: audioHostOf(upgraded.audioUrl),
                  note: `Upgraded from ${playable.provider || "preview"} via ${upgradeSource}`,
                },
              });
              return resolved;
            }
          } catch {
            // fall through to native stream/preview
          }
        }

        // Full JioSaavn (and similar) already have direct audio URLs
        if (
          playable.audioUrl &&
          !playable.needsStreamResolve &&
          !playable.isPreview &&
          playable.provider !== "apple"
        ) {
          return song;
        }

        if (!playable.provider || !playable.providerId) {
          if (!playable.audioUrl) {
            throw new Error("Track has no playable audio URL");
          }
          return song;
        }

        if (
          playable.needsStreamResolve ||
          playable.provider === "jiosaavn" ||
          playable.provider === "audius" ||
          playable.provider === "radio-browser" ||
          playable.provider === "apple" ||
          !playable.audioUrl ||
          playable.isPreview
        ) {
          const { data } = await axiosInstance.get("/music/stream", {
            params: {
              source: playable.provider,
              id: playable.providerId,
              uuid:
                playable.provider === "radio-browser"
                  ? playable.providerId
                  : undefined,
            },
          });

          const stream = data?.data;
          const audioUrl = stream?.audioUrl || stream?.streamUrl;
          if (!audioUrl) {
            throw new Error(stream?.message || "Stream unavailable");
          }

          const resolvedTrack = stream?.track || {};
          const isPreview = Boolean(
            stream?.isPreview ?? resolvedTrack.isPreview,
          );
          const previewDuration =
            Number(stream?.previewDuration ?? resolvedTrack.previewDuration) ||
            (isPreview ? 30 : null);

          // Never present a 30s preview as a full-length track in the player UI
          const duration = isPreview
            ? previewDuration || 30
            : resolvedTrack.duration ||
              stream.duration ||
              playable.duration;

          if (isPreview) {
            toast("Apple preview (~30s) — full track needs JioSaavn/Audius match", {
              id: "preview-playback",
            });
          }

          const finalProvider =
            resolvedTrack.provider || playable.provider || stream?.source;
          set({
            playbackDiagnostics: {
              provider: finalProvider,
              isPreview,
              upgradeAttempted,
              upgradeSucceeded: upgradeAttempted && !isPreview,
              upgradeSource: isPreview ? null : finalProvider,
              audioHost: audioHostOf(audioUrl),
              note: isPreview
                ? "Playing provider preview clip"
                : stream?.upgradedFrom
                  ? `Full stream (upgraded from ${stream.upgradedFrom})`
                  : "Full stream",
            },
          });

          return {
            ...song,
            ...resolvedTrack,
            audioUrl,
            duration,
            previewDuration,
            provider: finalProvider,
            providerId: resolvedTrack.providerId || playable.providerId,
            _id: resolvedTrack._id || resolvedTrack.id || playable._id || playable.id,
            id: resolvedTrack.id || resolvedTrack._id || playable.id || playable._id,
            isPreview,
            needsStreamResolve: false,
            playable: true,
          };
        }

        set({
          playbackDiagnostics: {
            provider: playable.provider,
            isPreview: Boolean(playable.isPreview),
            upgradeAttempted,
            upgradeSucceeded,
            upgradeSource,
            audioHost: audioHostOf(playable.audioUrl),
            note: "Using existing audio URL",
          },
        });
        return song;
      },

      initQueue: (songs) => {
        set({
          queue: songs,
          originalQueue: songs,
          currentSong: get().currentSong || songs[0] || null,
          currentIndex: get().currentIndex === -1 ? 0 : get().currentIndex,
        });
      },

      playAt: async (songs, startIndex = 0) => {
        const safeSongs = sanitizeTrackList(songs as PlayableTrack[]) as Track[];
        if (!safeSongs.length) {
          set({
            playbackError:
              "No playable tracks (blocked or legacy sources were removed)",
            isPlaying: false,
          });
          return;
        }
        const index = Math.max(0, Math.min(startIndex, safeSongs.length - 1));
        let song = safeSongs[index];

        try {
          set({ isBuffering: true, playbackError: null });
          song = await get().resolveStreamIfNeeded(song);

          if (!(song as PlayableTrack).audioUrl && !(song as Song).audioUrl) {
            throw new Error("Track unavailable for playback");
          }

          const recentlyPlayed = sanitizeTrackList([
            song as PlayableTrack,
            ...get().recentlyPlayed.filter(
              (t) => trackKey(t) !== trackKey(song),
            ),
          ] as PlayableTrack[]).slice(0, 30) as Track[];

          // Keep resolved stream URL inside the queue so next/prev stay playable
          const nextQueue = [...safeSongs];
          nextQueue[index] = song;

          set({
            queue: nextQueue,
            originalQueue: nextQueue,
            currentSong: song,
            currentIndex: index,
            isPlaying: true,
            shouldAutoplay: true,
            recentlyPlayed,
            isBuffering: false,
            playbackError: null,
          });

          // Spotify-like: keep a mix ready so the next song auto-plays
          if (nextQueue.length < 6) {
            void get().extendQueueWithRelated();
          }

          // Best-effort history (requires auth)
          try {
            await axiosInstance.post("/library/history", song);
          } catch {
            /* guest users skip */
          }
        } catch (error: unknown) {
          const message = axiosErrorMessage(error, "Playback failed");
          set({
            isBuffering: false,
            isPlaying: false,
            playbackError: message,
          });
          toast.error(message, { id: "playback-error" });
        }
      },

      setCurrentSong: async (song) => {
        if (!song) return;
        const queue = get().queue;
        let songIndex = queue.findIndex((s) => trackKey(s) === trackKey(song));
        let nextQueue = queue;

        if (songIndex === -1) {
          nextQueue = [...queue, song];
          songIndex = nextQueue.length - 1;
        }

        await get().playAt(nextQueue, songIndex);
      },

      togglePlay: () => {
        if (!get().currentSong) return;
        set({ isPlaying: !get().isPlaying, playbackError: null });
      },

      extendQueueWithRelated: async () => {
        const { currentSong, queue, currentIndex } = get();
        if (!currentSong) return false;

        const playable = currentSong as PlayableTrack;
        try {
          const { data } = await axiosInstance.get(
            `/music/related/${encodeURIComponent(playable.provider || "jiosaavn")}/${encodeURIComponent(playable.providerId || playable.id || "x")}`,
            {
              params: {
                artist: playable.artist,
                title: playable.title,
              },
            },
          );

          const related: Track[] = sanitizeTrackList(
            (data?.data?.tracks || []) as PlayableTrack[],
          ).filter(
            (t) =>
              trackKey(t) &&
              trackKey(t) !== trackKey(currentSong) &&
              !isUntrustedCatalogueTrack(t) &&
              !queue.some((q) => trackKey(q) === trackKey(t)),
          ) as Track[];

          if (!related.length) return false;

          const nextQueue = [...queue, ...related.slice(0, 12)];
          set({
            queue: nextQueue,
            originalQueue: nextQueue,
            currentIndex: Math.min(currentIndex, nextQueue.length - 1),
          });
          return true;
        } catch {
          return false;
        }
      },

      playNext: async () => {
        const { queue, currentIndex, repeatMode, isShuffle, currentSong } =
          get();
        if (!queue.length) {
          set({ isPlaying: false, shouldAutoplay: false });
          return;
        }

        const currentKey = currentSong ? trackKey(currentSong) : "";
        const sameAsCurrent = (t: Track) => {
          const key = trackKey(t);
          if (currentKey && key && key === currentKey) return true;
          if (!currentSong) return false;
          const a = `${(t.title || "").toLowerCase()}|${(t.artist || "").split(",")[0].toLowerCase()}`;
          const b = `${(currentSong.title || "").toLowerCase()}|${(currentSong.artist || "").split(",")[0].toLowerCase()}`;
          return Boolean(a.length > 3 && a === b);
        };

        // Prefetch related mix near the end so continuous play never stalls
        const nearEnd = currentIndex >= queue.length - 1;
        if (queue.length <= 1 || nearEnd) {
          await get().extendQueueWithRelated();
        }

        const liveQueue = get().queue;
        const liveIndex = get().currentIndex;

        // Only one track and nothing new — stop (never restart same song on "ended")
        if (liveQueue.length <= 1) {
          set({ isPlaying: false, shouldAutoplay: false });
          return;
        }

        let nextIndex: number | null = null;

        if (isShuffle) {
          const candidates = liveQueue
            .map((_, i) => i)
            .filter((i) => i !== liveIndex && !sameAsCurrent(liveQueue[i]));
          if (candidates.length) {
            nextIndex =
              candidates[Math.floor(Math.random() * candidates.length)] ?? null;
          }
        } else {
          for (let i = liveIndex + 1; i < liveQueue.length; i++) {
            if (!sameAsCurrent(liveQueue[i])) {
              nextIndex = i;
              break;
            }
          }
          if (nextIndex === null && repeatMode === "all") {
            for (let i = 0; i < liveIndex; i++) {
              if (!sameAsCurrent(liveQueue[i])) {
                nextIndex = i;
                break;
              }
            }
          }
        }

        if (nextIndex === null) {
          // Last resort: extend again then take first different track after current
          await get().extendQueueWithRelated();
          const q2 = get().queue;
          const idx2 = get().currentIndex;
          for (let i = idx2 + 1; i < q2.length; i++) {
            if (!sameAsCurrent(q2[i])) {
              nextIndex = i;
              break;
            }
          }
          if (nextIndex === null) {
            set({ isPlaying: false, shouldAutoplay: false });
            return;
          }
          await get().playAt(get().queue, nextIndex);
          return;
        }

        await get().playAt(liveQueue, nextIndex);
      },

      playPrev: async () => {
        const { queue, currentIndex, repeatMode } = get();
        if (!queue.length) return;

        if (currentIndex <= 0) {
          if (repeatMode === "all") {
            await get().playAt(queue, queue.length - 1);
          } else {
            set({ shouldAutoplay: true, isPlaying: true });
          }
          return;
        }

        await get().playAt(queue, currentIndex - 1);
      },

      toggleShuffle: () => {
        const { isShuffle, queue, originalQueue, currentSong } = get();
        if (!isShuffle) {
          const shuffled = shuffleArray(queue);
          const idx = shuffled.findIndex(
            (s) => trackKey(s) === trackKey(currentSong || ({} as Track)),
          );
          set({
            isShuffle: true,
            originalQueue: queue.length ? queue : originalQueue,
            queue: shuffled,
            currentIndex: idx >= 0 ? idx : 0,
          });
        } else {
          const base = originalQueue.length ? originalQueue : queue;
          const idx = base.findIndex(
            (s) => trackKey(s) === trackKey(currentSong || ({} as Track)),
          );
          set({
            isShuffle: false,
            queue: base,
            currentIndex: idx >= 0 ? idx : 0,
          });
        }
      },

      cycleRepeat: () => {
        const order: RepeatMode[] = ["off", "all", "one"];
        const current = get().repeatMode;
        const next = order[(order.indexOf(current) + 1) % order.length];
        set({ repeatMode: next });
      },

      addToQueue: (song) => {
        const { queue, currentSong, currentIndex } = get();
        // If nothing is playing, start this track
        if (!currentSong || currentIndex < 0 || !queue.length) {
          void get().playAt([song], 0);
          return;
        }
        const key = trackKey(song);
        const withoutDup = key
          ? queue.filter((t) => trackKey(t) !== key)
          : queue;
        // Keep current index stable if we removed a duplicate before it
        const removedBefore = key
          ? queue
              .slice(0, currentIndex + 1)
              .filter((t) => trackKey(t) === key).length
          : 0;
        set({
          queue: [...withoutDup, song],
          originalQueue: [...withoutDup, song],
          currentIndex: Math.max(0, currentIndex - removedBefore),
        });
      },

      playNextInQueue: (song) => {
        const { queue, currentSong, currentIndex } = get();
        // Nothing playing → play immediately
        if (!currentSong || currentIndex < 0 || !queue.length) {
          void get().playAt([song], 0);
          return;
        }

        const key = trackKey(song);

        // Remove existing copies so "Play next" always wins position
        const cleaned = key
          ? queue.filter((t) => trackKey(t) !== key)
          : [...queue];
        const liveIndex = cleaned.findIndex(
          (t) => trackKey(t) === trackKey(currentSong),
        );
        const idx = liveIndex >= 0 ? liveIndex : currentIndex;
        const nextQueue = [
          ...cleaned.slice(0, idx + 1),
          song,
          ...cleaned.slice(idx + 1),
        ];

        set({
          queue: nextQueue,
          originalQueue: nextQueue,
          currentIndex: idx,
        });
      },

      removeFromQueue: (index) => {
        const queue = [...get().queue];
        queue.splice(index, 1);
        const currentIndex = get().currentIndex;
        set({
          queue,
          originalQueue: queue,
          currentIndex:
            index < currentIndex
              ? currentIndex - 1
              : index === currentIndex
                ? Math.min(currentIndex, queue.length - 1)
                : currentIndex,
        });
      },

      clearQueue: () => {
        set({
          queue: get().currentSong ? [get().currentSong!] : [],
          originalQueue: get().currentSong ? [get().currentSong!] : [],
          currentIndex: get().currentSong ? 0 : -1,
        });
      },
    }),
    {
      name: "player-storage",
      partialize: (state) => ({
        volume: state.volume,
        repeatMode: state.repeatMode,
        recentlyPlayed: sanitizeTrackList(
          state.recentlyPlayed as PlayableTrack[],
        ),
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<PlayerStore>;
        const recent = sanitizeTrackList(
          (p.recentlyPlayed || []) as PlayableTrack[],
        ) as Track[];
        const currentSong = sanitizePersistedTrack(
          (p as { currentSong?: Track }).currentSong as PlayableTrack,
        ) as Track | null;
        return {
          ...current,
          ...p,
          recentlyPlayed: recent,
          currentSong: currentSong || current.currentSong,
          queue: sanitizeTrackList(
            ((p as { queue?: Track[] }).queue || current.queue) as PlayableTrack[],
          ) as Track[],
          originalQueue: sanitizeTrackList(
            ((p as { originalQueue?: Track[] }).originalQueue ||
              current.originalQueue) as PlayableTrack[],
          ) as Track[],
        };
      },
    },
  ),
);
