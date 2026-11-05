import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { axiosInstance } from "@/lib/axios";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import TrackRow from "@/components/music/TrackRow";
import type { PlayableTrack, UserPlaylist } from "@/types";
import { Play } from "lucide-react";

const UserPlaylistDetailPage = () => {
  const { id = "" } = useParams();
  const [playlist, setPlaylist] = useState<UserPlaylist | null>(null);
  const playAt = usePlayerStore((s) => s.playAt);

  useEffect(() => {
    const load = async () => {
      const { data } = await axiosInstance.get(`/library/playlists/${id}`);
      setPlaylist(data.data);
    };
    if (id) load().catch(() => setPlaylist(null));
  }, [id]);

  if (!playlist) {
    return <div className="p-8 text-zinc-400">Playlist not found</div>;
  }

  const tracks = (playlist.tracks || []) as PlayableTrack[];

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-6">
        <div className="flex gap-6 items-end mb-8">
          <img
            src={
              playlist.imgUrl ||
              "https://placehold.co/240x240/18181b/71717a?text=♪"
            }
            alt={playlist.title}
            className="w-40 h-40 rounded object-cover bg-zinc-800"
          />
          <div>
            <p className="text-sm">Playlist</p>
            <h1 className="text-4xl font-bold mt-2 mb-2">{playlist.title}</h1>
            <p className="text-zinc-400">{tracks.length} songs</p>
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

export default UserPlaylistDetailPage;
