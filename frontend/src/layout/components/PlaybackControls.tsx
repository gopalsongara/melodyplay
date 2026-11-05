import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import {
  Shuffle,
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Repeat,
  Repeat1,
  Volume1,
  VolumeX,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  ChevronUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayableTrack } from "@/types";
import { Link } from "react-router-dom";
import FavoritesButton from "@/components/FavoritesButton";
import AddToPlaylistDialog from "@/components/music/AddToPlaylistDialog";
import { getPlaybackLabel } from "@/lib/playbackDisplay";

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const PlaybackControls = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    volume,
    setVolume,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    playbackError,
    isBuffering,
    playerExpanded,
    setPlayerExpanded,
  } = usePlayerStore();

  const { toggleFavorite, isFavorite } = useLibraryStore();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = document.querySelector("audio");
    if (!audio) return;

    audioRef.current = audio;
    audio.volume = volume;

    const metaDuration = Number((currentSong as PlayableTrack)?.duration) || 0;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      const audioDur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(audioDur > 0 ? audioDur : metaDuration);
    };

    updateDuration();
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [currentSong, volume]);

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
    }
  };

  const favoriteId = currentSong?._id || (currentSong as PlayableTrack)?.id || "";
  const label = currentSong
    ? getPlaybackLabel(currentSong as PlayableTrack)
    : "";

  const showMobileMini = Boolean(currentSong) && !playerExpanded;

  return (
    <>
      {/* Mobile: fixed mini-player stuck above Home/Search nav */}
      {showMobileMini && (
        <div
          className="md:hidden fixed inset-x-0 z-[45] border-t border-zinc-800/90 bg-zinc-900/95 backdrop-blur-md px-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
          style={{
            bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="relative pt-0.5 max-w-lg mx-auto">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-800 overflow-hidden rounded-full">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-200 ease-linear"
                style={{
                  width: `${
                    duration > 0
                      ? Math.min(100, (currentTime / duration) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 py-2 min-h-[56px]">
              <button
                type="button"
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left touch-manipulation"
                onClick={() => setPlayerExpanded(true)}
                aria-label="Open now playing"
              >
                <img
                  src={currentSong!.imgUrl}
                  alt=""
                  className="size-11 rounded object-cover bg-zinc-800 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/96x96/18181b/71717a?text=♪";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm text-white">
                    {currentSong!.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {currentSong!.artist}
                    {label ? ` · ${label}` : ""}
                  </div>
                </div>
                <ChevronUp
                  className="size-4 text-zinc-500 shrink-0"
                  aria-hidden
                />
              </button>

              <div className="flex items-center shrink-0 gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-10 text-white"
                  aria-label="Previous"
                  onClick={() => playPrev()}
                >
                  <SkipBack className="size-5 fill-white" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-11 text-white"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  onClick={() => togglePlay()}
                >
                  {isBuffering ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="size-6 fill-white" />
                  ) : (
                    <Play className="size-6 fill-white" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-10 text-white"
                  aria-label="Next"
                  onClick={() => playNext()}
                >
                  <SkipForward className="size-5 fill-white" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile spacer (nav + optional mini-player) / Desktop footer player */}
      <footer
        className={`shrink-0 bg-transparent md:bg-zinc-900 border-0 md:border-t md:border-zinc-800 px-0 md:px-4 ${
          showMobileMini
            ? "max-md:h-[calc(3.5rem+3.75rem+env(safe-area-inset-bottom,0px))]"
            : "max-md:h-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
        } md:h-auto`}
      >
      {/* Desktop player */}
      <div className="hidden md:flex justify-between items-center h-24 max-w-[1600px] mx-auto gap-2">
        <div className="flex items-center gap-4 min-w-0 w-[30%]">
          {currentSong && (
            <>
              <img
                src={currentSong.imgUrl}
                alt={currentSong.title}
                className="w-14 h-14 object-cover rounded-md bg-zinc-800 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/112x112/18181b/71717a?text=♪";
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{currentSong.title}</div>
                <div className="text-sm text-zinc-400 truncate">
                  {currentSong.artist}
                  {label ? ` · ${label}` : ""}
                  {(currentSong as PlayableTrack).isLive ? " · Live" : ""}
                </div>
                {playbackError && (
                  <div className="text-xs text-red-400 truncate">
                    {playbackError}
                  </div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-400 hover:text-white shrink-0"
                onClick={() => toggleFavorite(currentSong as PlayableTrack)}
              >
                <Heart
                  className={`h-4 w-4 ${
                    isFavorite(favoriteId)
                      ? "fill-emerald-500 text-emerald-500"
                      : ""
                  }`}
                />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-400 hover:text-white shrink-0"
                aria-label="Add to playlist"
                onClick={() => setPlaylistOpen(true)}
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 max-w-[45%]">
          <div className="flex items-center gap-6">
            <Button
              size="icon"
              variant="ghost"
              className={`hover:text-white ${
                isShuffle ? "text-emerald-500" : "text-zinc-400"
              }`}
              onClick={toggleShuffle}
              disabled={!currentSong}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={() => playPrev()}
              disabled={!currentSong}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="bg-white hover:bg-white/80 text-black rounded-full h-8 w-8"
              onClick={togglePlay}
              disabled={!currentSong}
            >
              {isBuffering ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={() => playNext()}
              disabled={!currentSong}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`hover:text-white ${
                repeatMode !== "off" ? "text-emerald-500" : "text-zinc-400"
              }`}
              onClick={cycleRepeat}
              disabled={!currentSong}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full">
            <div className="text-xs text-zinc-400">
              {formatTime(currentTime)}
            </div>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="w-full hover:cursor-grab active:cursor-grabbing"
              onValueChange={handleSeek}
            />
            <div className="text-xs text-zinc-400">{formatTime(duration)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-[180px] w-[30%] justify-end">
          <FavoritesButton compact />
          <Link to="/queue">
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
            >
              <ListMusic className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={() => setVolume(volume === 0 ? 0.75 : 0)}
            >
              {volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume1 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              className="w-24 hover:cursor-grab active:cursor-grabbing"
              onValueChange={(value) => {
                setVolume(value[0] / 100);
                if (audioRef.current) {
                  audioRef.current.volume = value[0] / 100;
                }
              }}
            />
          </div>
        </div>
      </div>

      <AddToPlaylistDialog
        track={(currentSong as PlayableTrack) || null}
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
      />
      </footer>
    </>
  );
};

export default PlaybackControls;
