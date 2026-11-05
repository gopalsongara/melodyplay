import type { PlayableTrack } from "@/types";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Pause, Play, Heart } from "lucide-react";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { Button } from "@/components/ui/button";
import TrackActions from "@/components/music/TrackActions";
import {
  formatTrackDuration,
  getDisplayDurationSeconds,
  getPlaybackLabel,
  preferFullSibling,
} from "@/lib/playbackDisplay";

interface Props {
  tracks: PlayableTrack[];
  showAlbum?: boolean;
  /** Override default play-at behavior (e.g. queue page absolute index) */
  onPlayTrack?: (track: PlayableTrack, index: number) => void;
  /** Display index offset (0-based position of first row) */
  indexOffset?: number;
}

const TrackRow = ({
  tracks,
  showAlbum = false,
  onPlayTrack,
  indexOffset = 0,
}: Props) => {
  const { currentSong, isPlaying, playAt, togglePlay } = usePlayerStore();
  const { toggleFavorite, isFavorite } = useLibraryStore();

  return (
    <div className="space-y-1">
      {tracks.map((track, index) => {
        const id = track._id || track.id || "";
        const isCurrent =
          (currentSong?._id || currentSong?.id || "") === id && Boolean(id);
        return (
          <div
            key={`${id}-${index}`}
            className="grid grid-cols-[40px_1fr_auto_auto] sm:grid-cols-[40px_1fr_1fr_auto_auto_auto] gap-2 sm:gap-3 items-center px-3 py-2 rounded-md hover:bg-white/5 group cursor-pointer"
            onClick={() => {
              if (isCurrent) togglePlay();
              else if (onPlayTrack) onPlayTrack(track, index);
              else {
                const preferred = preferFullSibling(tracks, index);
                void playAt(tracks, preferred.index);
              }
            }}
          >
            <div className="text-zinc-400 text-sm flex items-center justify-center">
              {isCurrent && isPlaying ? (
                <Pause className="size-4 text-emerald-500" />
              ) : (
                <>
                  <span className="group-hover:hidden">
                    {indexOffset + index + 1}
                  </span>
                  <Play className="size-4 hidden group-hover:block" />
                </>
              )}
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <img
                src={track.imgUrl}
                alt={track.title}
                className="size-10 rounded object-cover bg-zinc-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/80x80/18181b/71717a?text=♪";
                }}
              />
              <div className="min-w-0">
                <div
                  className={`truncate font-medium ${
                    isCurrent ? "text-emerald-400" : "text-white"
                  }`}
                >
                  {track.title}
                </div>
                <div className="text-sm text-zinc-400 truncate">
                  {track.artist}
                  {getPlaybackLabel(track)
                    ? ` · ${getPlaybackLabel(track)}`
                    : ""}
                </div>
              </div>
            </div>

            {showAlbum && (
              <div className="hidden sm:block text-sm text-zinc-400 truncate">
                {track.album || "—"}
              </div>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="text-zinc-400 hover:text-white opacity-100"
              aria-label={isFavorite(id) ? "Unlike song" : "Like song"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleFavorite(track);
              }}
            >
              <Heart
                className={`size-4 ${
                  isFavorite(id) ? "fill-emerald-500 text-emerald-500" : ""
                }`}
              />
            </Button>

            <div onClick={(e) => e.stopPropagation()}>
              <TrackActions track={track} />
            </div>

            <div className="text-sm text-zinc-400 tabular-nums hidden sm:block">
              {formatTrackDuration(getDisplayDurationSeconds(track))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrackRow;
