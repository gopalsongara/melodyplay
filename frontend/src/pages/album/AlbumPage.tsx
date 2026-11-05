import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMusicStore } from "@/stores/useMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Clock, Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60);
  const remainingduration = duration % 60;
  return `${minutes}:${remainingduration.toString().padStart(2, "0")}`;
};

const AlbumPage = () => {
  const { albumId } = useParams();
  const { fetchAlbumById, currentAlbum, isLoading } = useMusicStore();
  const { currentSong, isPlaying, playAt, togglePlay } = usePlayerStore();
  useEffect(() => {
    fetchAlbumById(albumId!);
  }, [fetchAlbumById, albumId]);

  if (isLoading) return null;

  const songs = currentAlbum?.songs || [];

  const handlePlayAlbum = () => {
    if (!currentAlbum || !songs.length) return;
    const isCurrentAlbumPlaying = songs.some(
      (song) => song._id === currentSong?._id,
    );
    if (isCurrentAlbumPlaying) {
      togglePlay();
    } else {
      playAt(songs, 0);
    }
  };

  const handlePlaySong = (index: number) => {
    if (!songs.length) return;
    playAt(songs, index);
  };
  return (
    <div className="h-full ">
      <ScrollArea className="h-full rounded-lg">
        <div className="relative min-h-full">
          <div
            className="absolute inset-0 bg-linear-to-b from-[#5038a0]/80 via-zinc-900/80 to-zinc-900 pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative z-5">
            <div className="flex p-6 gap-6 pb-8">
              <img
                src={currentAlbum?.imageUrl}
                alt={currentAlbum?.title}
                className="w-60 h-60 shadow-xl rounded"
              />
              <div className="flex flex-col justify-end">
                <p className="text-sm font-medium"> Album</p>
                <h2 className="text-7xl font-bold my-4">
                  {currentAlbum?.title}
                </h2>
                <div className="flex items-center gap-2 text-sm text-zinc-100">
                  <span className="font-medium text-white">
                    {currentAlbum?.artist}
                  </span>
                  <span>{songs.length} songs</span>
                  <span>• {currentAlbum?.artist}</span>
                  <span>• {currentAlbum?.releaseDate}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 flex items-center gap-6">
              <Button
                onClick={handlePlayAlbum}
                size="icon"
                className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all"
              >
                {isPlaying &&
                songs.some((song) => song._id === currentSong?._id) ? (
                  <Pause className="h-7 w-7 text-black" />
                ) : (
                  <Play className="h-7 w-7 text-black" />
                )}
              </Button>
            </div>

            <div className="bg-black/20 backdrop-blur-sm">
              <div
                className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-10 py-2 text-sm 
            text-zinc-400 border-b border-white/5"
              >
                <div>#</div>
                <div>Title</div>
                <div>Released Year</div>
                <div>
                  <Clock className="h-4 w-4" />
                </div>
              </div>

              <div className="px-6">
                <div className="space-y-2 py-4">
                  {songs.map((song, index) => {
                    const isCurrentSong = currentSong?._id === song._id;
                    return (
                      <div
                        key={song._id}
                        onClick={() => handlePlaySong(index)}
                        className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 rounded-md group cursor-pointer"
                      >
                        <div className="flex items-center justify-center">
                          {isCurrentSong && isPlaying ? (
                            <div className="size-4 text-green-500">🎵</div>
                          ) : (
                            <span className="group-hover:hidden">
                              {index + 1}
                            </span>
                          )}
                          {!currentSong && (
                            <Play className="h-4 w-4 hidden group-hover:block" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 ">
                          <img
                            src={song.imgUrl}
                            alt={song.title}
                            className="size-10"
                          />
                          <div>
                            <div className=" font-medium text-white">
                              {song.title}
                            </div>
                            <div>{song.artist}</div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {song.createdAt?.split("T")[0] || "—"}
                        </div>
                        <div className="flex items-center">
                          {formatDuration(song.duration)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AlbumPage;
