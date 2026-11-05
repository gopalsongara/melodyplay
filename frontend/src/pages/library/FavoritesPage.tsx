import { useEffect } from "react";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import SignInOAuthButton from "@/components/SignInOAuthButton";
import { Button } from "@/components/ui/button";
import { Heart, Play } from "lucide-react";

const FavoritesPage = () => {
  const { favorites, fetchFavorites } = useLibraryStore();
  const playAt = usePlayerStore((s) => s.playAt);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return (
    <ScrollArea className="h-[calc(100vh-160px)] md:h-[calc(100vh-180px)]">
      <div className="pb-24 md:pb-8">
        <div className="bg-linear-to-b from-indigo-800 via-indigo-900/80 to-zinc-900 px-4 sm:px-8 pt-10 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="size-40 sm:size-52 rounded-md bg-linear-to-br from-indigo-500 to-emerald-600 shadow-2xl flex items-center justify-center">
              <Heart className="size-16 sm:size-20 fill-white text-white" />
            </div>
            <div className="text-center sm:text-left space-y-2">
              <p className="text-xs uppercase tracking-widest font-semibold text-zinc-200">
                Playlist
              </p>
              <h1 className="text-4xl sm:text-6xl font-black">Liked Songs</h1>
              <p className="text-zinc-300 text-sm">
                {favorites.length} {favorites.length === 1 ? "song" : "songs"}
              </p>
              {favorites.length > 0 && (
                <Button
                  className="mt-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6"
                  onClick={() => playAt(favorites, 0)}
                >
                  <Play className="size-4 fill-black mr-1" />
                  Play
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <SignedOut>
            <div className="text-zinc-400 text-sm bg-zinc-800/50 rounded-md p-3">
              Likes are saved on this device.{" "}
              <span className="inline-flex align-middle ml-1">
                <SignInOAuthButton />
              </span>{" "}
              to sync across devices.
            </div>
          </SignedOut>
          <SignedIn>
            <div className="text-zinc-500 text-sm">Synced to your account</div>
          </SignedIn>

          {favorites.length ? (
            <TrackRow tracks={favorites} showAlbum />
          ) : (
            <div className="text-zinc-400 py-8">
              Tap the heart on any song to add it here.
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

export default FavoritesPage;
