import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import SignInOAuthButton from "@/components/SignInOAuthButton";
import MediaCard from "@/components/music/MediaCard";
import { Heart } from "lucide-react";

const UserPlaylistsPage = () => {
  const { playlists, favorites, fetchPlaylists, fetchFavorites, createPlaylist } =
    useLibraryStore();
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetchPlaylists();
    fetchFavorites();
  }, [fetchPlaylists, fetchFavorites]);

  return (
    <ScrollArea className="h-[calc(100vh-160px)] md:h-[calc(100vh-180px)]">
      <div className="p-4 sm:p-6 space-y-6 pb-24 md:pb-6">
        <h1 className="text-2xl font-bold">Your Library</h1>

        <Link
          to="/favorites"
          className="flex items-center gap-4 rounded-md bg-zinc-800/60 hover:bg-zinc-800 p-3 transition-colors max-w-xl"
        >
          <div className="size-16 rounded-md bg-linear-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shrink-0">
            <Heart className="size-7 fill-white text-white" />
          </div>
          <div>
            <div className="font-semibold text-lg">Liked Songs</div>
            <div className="text-sm text-zinc-400">
              {favorites.length} {favorites.length === 1 ? "song" : "songs"}
            </div>
          </div>
        </Link>

        <SignedOut>
          <div className="text-zinc-400 space-y-3">
            <p>Sign in to create and manage playlists.</p>
            <SignInOAuthButton />
          </div>
        </SignedOut>
        <SignedIn>
          <div>
            <h2 className="text-lg font-semibold mb-3">Playlists</h2>
            <div className="flex gap-3 max-w-md mb-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="New playlist name"
                className="bg-zinc-800 border-zinc-700"
              />
              <Button
                className="bg-emerald-500 hover:bg-emerald-400 text-black"
                onClick={async () => {
                  if (!title.trim()) return;
                  await createPlaylist(title.trim());
                  setTitle("");
                }}
              >
                Create
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {playlists.map((playlist) => (
                <MediaCard
                  key={playlist._id}
                  title={playlist.title}
                  subtitle={`${playlist.tracks?.length || 0} songs`}
                  image={playlist.imgUrl}
                  to={`/library/playlists/${playlist._id}`}
                />
              ))}
            </div>
            {!playlists.length && (
              <div className="text-zinc-400">No playlists yet</div>
            )}
          </div>
        </SignedIn>
      </div>
    </ScrollArea>
  );
};

export default UserPlaylistsPage;
