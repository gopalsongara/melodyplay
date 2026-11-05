import { usePlayerStore } from "@/stores/usePlayerStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { PlayableTrack } from "@/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ChevronDown,
  Heart,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPlaybackLabel } from "@/lib/playbackDisplay";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

const MobileNowPlaying = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    isBuffering,
    playbackError,
    playbackDiagnostics,
    playerExpanded,
    setPlayerExpanded,
  } = usePlayerStore();
  const { toggleFavorite, isFavorite } = useLibraryStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = document.querySelector("audio");
    if (!audio) return;
    const meta = Number((currentSong as PlayableTrack)?.duration) || 0;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDur = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(d > 0 ? d : meta);
    };
    onDur();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDur);
    audio.addEventListener("durationchange", onDur);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDur);
      audio.removeEventListener("durationchange", onDur);
    };
  }, [currentSong]);

  if (!playerExpanded || !currentSong) return null;

  const track = currentSong as PlayableTrack;
  const favoriteId = track._id || track.id || "";
  const label = getPlaybackLabel(track);

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-zinc-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="size-11 text-white"
          aria-label="Collapse player"
          onClick={() => setPlayerExpanded(false)}
        >
          <ChevronDown className="size-6" />
        </Button>
        <div className="text-[10px] sm:text-xs uppercase tracking-wider text-zinc-400">
          Now playing
        </div>
        <Link to="/queue" onClick={() => setPlayerExpanded(false)}>
          <Button
            size="icon"
            variant="ghost"
            className="size-11 text-white"
            aria-label="Queue"
          >
            <ListMusic className="size-5" />
          </Button>
        </Link>
      </div>

      {/* Scrollable middle (art + meta) so short phones never clip controls */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6">
        <div className="flex items-center justify-center py-2 sm:py-4">
          <img
            src={track.imgUrl}
            alt=""
            className="w-[min(100%,18rem)] sm:w-full sm:max-w-sm aspect-square max-h-[38vh] sm:max-h-[42vh] object-cover rounded-lg shadow-2xl bg-zinc-900"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://placehold.co/600x600/18181b/71717a?text=♪";
            }}
          />
        </div>

        <div className="space-y-0.5 mb-3 sm:mb-4">
          <h2 className="text-xl sm:text-2xl font-bold truncate">{track.title}</h2>
          <p className="text-sm sm:text-base text-zinc-400 truncate">
            {track.artist}
            {label ? ` · ${label}` : ""}
          </p>
          {playbackError && (
            <p className="text-sm text-red-400">{playbackError}</p>
          )}
        </div>
      </div>

      {/* Controls — pinned, never shrink off-screen */}
      <div className="shrink-0 px-4 sm:px-6 pb-3 sm:pb-5 pt-1 space-y-3">
        <div className="space-y-1.5">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={(v) => {
              const audio = document.querySelector("audio");
              if (audio) audio.currentTime = v[0];
            }}
          />
          <div className="flex justify-between text-[11px] sm:text-xs text-zinc-400 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <Button
            size="icon"
            variant="ghost"
            className={`size-11 sm:size-12 ${isShuffle ? "text-emerald-400" : "text-zinc-300"}`}
            aria-label="Shuffle"
            onClick={toggleShuffle}
          >
            <Shuffle className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-12 sm:size-14 text-white"
            aria-label="Previous"
            onClick={() => playPrev()}
          >
            <SkipBack className="size-7" />
          </Button>
          <Button
            size="icon"
            className="size-14 sm:size-16 rounded-full bg-white text-black hover:bg-white/90 shrink-0"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
          >
            {isBuffering ? (
              <Loader2 className="size-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="size-7 fill-black" />
            ) : (
              <Play className="size-7 fill-black" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-12 sm:size-14 text-white"
            aria-label="Next"
            onClick={() => playNext()}
          >
            <SkipForward className="size-7" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={`size-11 sm:size-12 ${
              repeatMode !== "off" ? "text-emerald-400" : "text-zinc-300"
            }`}
            aria-label="Repeat"
            onClick={cycleRepeat}
          >
            {repeatMode === "one" ? (
              <Repeat1 className="size-5" />
            ) : (
              <Repeat className="size-5" />
            )}
          </Button>
        </div>

        <div className="flex justify-center">
          <Button
            size="icon"
            variant="ghost"
            className="size-11"
            aria-label="Favorite"
            onClick={() => toggleFavorite(track)}
          >
            <Heart
              className={`size-6 ${
                isFavorite(favoriteId)
                  ? "fill-emerald-500 text-emerald-500"
                  : "text-zinc-400"
              }`}
            />
          </Button>
        </div>

        {playbackDiagnostics && (
          <details className="rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] sm:text-[11px] text-zinc-400 font-mono">
            <summary className="px-3 py-2 cursor-pointer select-none text-zinc-500">
              Playback info
            </summary>
            <div className="px-3 pb-3 space-y-1">
              <div>provider: {playbackDiagnostics.provider || "—"}</div>
              <div>
                mode:{" "}
                {playbackDiagnostics.isPreview ? "preview (~30s)" : "full"}
              </div>
              <div>
                upgrade:{" "}
                {playbackDiagnostics.upgradeAttempted
                  ? playbackDiagnostics.upgradeSucceeded
                    ? `ok via ${playbackDiagnostics.upgradeSource}`
                    : "failed / unavailable"
                  : "not needed"}
              </div>
              <div>host: {playbackDiagnostics.audioHost || "—"}</div>
              {playbackDiagnostics.actualDuration != null && (
                <div>
                  media duration:{" "}
                  {Math.round(playbackDiagnostics.actualDuration)}s
                </div>
              )}
              {playbackDiagnostics.note && <div>{playbackDiagnostics.note}</div>}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default MobileNowPlaying;
