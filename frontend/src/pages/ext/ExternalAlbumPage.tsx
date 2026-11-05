import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import TrackRow from "@/components/music/TrackRow";
import {
  formatTrackDuration,
  getDisplayDurationSeconds,
} from "@/lib/playbackDisplay";
import { Pause, Play, Shuffle } from "lucide-react";

const ExternalAlbumPage = () => {
  const { provider = "apple", id = "" } = useParams();
  const { fetchAlbum, currentAlbum, isLoading, error } =
    useExternalMusicStore();
  const { playAt, currentSong, isPlaying, togglePlay, isShuffle, toggleShuffle } =
    usePlayerStore();

  useEffect(() => {
    if (provider && id) fetchAlbum(provider, id);
  }, [provider, id, fetchAlbum]);

  const tracks = currentAlbum?.tracks || [];
  const album = currentAlbum?.album;

  const totalDuration = useMemo(
    () =>
      tracks.reduce(
        (sum, t) => sum + getDisplayDurationSeconds(t),
        0,
      ),
    [tracks],
  );

  const releaseYear = album?.releaseDate
    ? String(album.releaseDate).slice(0, 4)
    : null;

  const isCurrentAlbum = tracks.some(
    (t) =>
      t._id === currentSong?._id ||
      t.id === (currentSong as { id?: string } | null)?.id,
  );

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="flex gap-6 items-end">
          <div className="w-48 h-48 sm:w-60 sm:h-60 rounded bg-zinc-800" />
          <div className="space-y-3 flex-1">
            <div className="h-4 w-16 bg-zinc-800 rounded" />
            <div className="h-12 w-2/3 bg-zinc-800 rounded" />
            <div className="h-4 w-1/3 bg-zinc-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="p-8 text-zinc-400 max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Album unavailable</h1>
        <p>
          {error ||
            "This album could not be loaded. Apple and JioSaavn album pages show real provider tracklists only."}
        </p>
        <Link to="/search" className="text-emerald-400 underline mt-4 inline-block">
          Back to search
        </Link>
      </div>
    );
  }

  const art = album.imgUrl || album.imageUrl;

  return (
    <ScrollArea className="h-[calc(100vh-180px)] md:h-[calc(100vh-100px)]">
      <div className="relative">
        <div
          className="absolute inset-x-0 top-0 h-72 opacity-40 pointer-events-none"
          style={{
            background: art
              ? `linear-gradient(180deg, rgba(24,24,27,0.2), #09090b), url(${art}) center/cover`
              : "linear-gradient(135deg, #14532d 0%, #09090b 70%)",
          }}
        />
        <div className="relative p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-end mb-8">
            <img
              src={art}
              alt={album.title}
              className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded shadow-2xl object-cover bg-zinc-900 ring-1 ring-white/10"
            />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-zinc-200">
                {(album as { type?: string }).type || "Album"}
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mt-2 mb-3 leading-tight break-words">
                {album.title}
              </h1>
              <p className="text-sm sm:text-base text-zinc-200">
                <span className="font-semibold text-white">{album.artist}</span>
                {releaseYear ? ` · ${releaseYear}` : ""}
                {tracks.length ? ` · ${tracks.length} songs` : ""}
                {totalDuration
                  ? ` · ${formatTrackDuration(totalDuration)}`
                  : ""}
              </p>
              {(album as { playbackCapability?: string }).playbackCapability ===
                "preview_only" && (
                <p className="text-xs text-amber-400/90 mt-2">
                  Apple album tracks play as ~30s previews unless a full authorized
                  match is available.
                </p>
              )}
              <div className="flex items-center gap-3 mt-6">
                <Button
                  className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-black size-12 shadow-lg"
                  size="icon"
                  aria-label={isPlaying && isCurrentAlbum ? "Pause" : "Play album"}
                  onClick={() => {
                    if (isCurrentAlbum) togglePlay();
                    else playAt(tracks, 0);
                  }}
                >
                  {isPlaying && isCurrentAlbum ? (
                    <Pause className="size-6 fill-black" />
                  ) : (
                    <Play className="size-6 fill-black ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full size-10 ${isShuffle ? "text-emerald-400" : "text-zinc-300"}`}
                  aria-label="Shuffle"
                  onClick={() => {
                    if (!isShuffle) toggleShuffle();
                    playAt(tracks, 0);
                  }}
                >
                  <Shuffle className="size-5" />
                </Button>
              </div>
            </div>
          </div>

          {tracks.length ? (
            <div className="bg-black/20 rounded-lg">
              <TrackRow tracks={tracks} showAlbum={false} />
            </div>
          ) : (
            <p className="text-zinc-400 py-8">
              No tracklist returned by the provider for this album.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

export default ExternalAlbumPage;
