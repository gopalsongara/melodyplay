import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import TrackRow from "@/components/music/TrackRow";
import { Play } from "lucide-react";

const ExternalPlaylistPage = () => {
  const { provider = "jiosaavn", id = "" } = useParams();
  const { fetchPlaylist, currentPlaylist, isLoading, error } =
    useExternalMusicStore();
  const playAt = usePlayerStore((s) => s.playAt);

  useEffect(() => {
    if (provider && id) fetchPlaylist(provider, id);
  }, [provider, id, fetchPlaylist]);

  if (isLoading) return <div className="p-8 text-zinc-400">Loading playlist...</div>;
  if (error || !currentPlaylist) {
    return (
      <div className="p-8 text-zinc-400">
        {error || "Playlist details unavailable for this provider"}
      </div>
    );
  }

  const { playlist, tracks } = currentPlaylist;

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-end mb-8">
          <img
            src={playlist.imgUrl}
            alt={playlist.title}
            className="w-48 h-48 rounded object-cover shadow-xl bg-zinc-800"
          />
          <div>
            <p className="text-sm">Playlist</p>
            <h1 className="text-4xl font-bold mt-2 mb-2">{playlist.title}</h1>
            <p className="text-zinc-400">{playlist.artist}</p>
            <Button
              className="mt-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black"
              onClick={() => playAt(tracks, 0)}
              disabled={!tracks.length}
            >
              <Play className="size-4 mr-2" /> Play
            </Button>
          </div>
        </div>
        <TrackRow tracks={tracks} showAlbum />
      </div>
    </ScrollArea>
  );
};

export default ExternalPlaylistPage;
