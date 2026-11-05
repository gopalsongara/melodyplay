import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  useUser,
  UserButton,
} from "@clerk/clerk-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import TrackRow from "@/components/music/TrackRow";
import SignInOAuthButton from "@/components/SignInOAuthButton";
import { Heart, ListMusic, Clock3 } from "lucide-react";

const ProfilePage = () => {
  const { user } = useUser();
  const {
    favorites,
    playlists,
    history,
    fetchFavorites,
    fetchPlaylists,
    fetchHistory,
  } = useLibraryStore();
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);

  useEffect(() => {
    fetchFavorites();
    fetchPlaylists();
    fetchHistory();
  }, [fetchFavorites, fetchPlaylists, fetchHistory]);

  const recent = (history.length ? history : recentlyPlayed).slice(0, 8);
  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Listener";

  return (
    <ScrollArea className="h-[calc(100vh-160px)] md:h-[calc(100vh-180px)]">
      <div className="pb-24 md:pb-8">
        <div className="bg-linear-to-b from-emerald-800/80 via-zinc-800 to-zinc-900 px-4 sm:px-8 pt-10 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <SignedIn>
              <div className="size-28 sm:size-40 rounded-full overflow-hidden shadow-2xl ring-4 ring-black/20 bg-zinc-700">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={displayName}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center text-4xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </SignedIn>
            <SignedOut>
              <div className="size-28 sm:size-40 rounded-full bg-zinc-700 shadow-2xl flex items-center justify-center text-5xl font-bold text-zinc-300">
                ?
              </div>
            </SignedOut>

            <div className="text-center sm:text-left space-y-2 min-w-0">
              <p className="text-xs uppercase tracking-widest text-zinc-200/80 font-semibold">
                Profile
              </p>
              <SignedIn>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black truncate">
                  {displayName}
                </h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-sm text-zinc-300">
                  <span>{playlists.length} Playlists</span>
                  <span className="text-zinc-500">•</span>
                  <span>{favorites.length} Liked Songs</span>
                </div>
                <div className="pt-2 flex justify-center sm:justify-start">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
              <SignedOut>
                <h1 className="text-3xl sm:text-5xl font-black">Guest</h1>
                <p className="text-zinc-300 max-w-md">
                  Sign in to sync Liked Songs, playlists, and listening history.
                </p>
                <div className="pt-2 flex justify-center sm:justify-start">
                  <SignInOAuthButton />
                </div>
              </SignedOut>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-8 pt-6 space-y-8">
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/favorites"
              className="flex items-center gap-3 rounded-md bg-zinc-800/70 hover:bg-zinc-800 p-4 transition-colors"
            >
              <div className="size-12 rounded-md bg-linear-to-br from-indigo-600 to-emerald-500 flex items-center justify-center">
                <Heart className="size-5 fill-white text-white" />
              </div>
              <div>
                <div className="font-semibold">Liked Songs</div>
                <div className="text-sm text-zinc-400">
                  {favorites.length} songs
                </div>
              </div>
            </Link>
            <Link
              to="/library/playlists"
              className="flex items-center gap-3 rounded-md bg-zinc-800/70 hover:bg-zinc-800 p-4 transition-colors"
            >
              <div className="size-12 rounded-md bg-zinc-700 flex items-center justify-center">
                <ListMusic className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Your Playlists</div>
                <div className="text-sm text-zinc-400">
                  {playlists.length} playlists
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3 rounded-md bg-zinc-800/70 p-4">
              <div className="size-12 rounded-md bg-zinc-700 flex items-center justify-center">
                <Clock3 className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Recently Played</div>
                <div className="text-sm text-zinc-400">{recent.length} tracks</div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">Liked Songs</h2>
              <Link
                to="/favorites"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Show all
              </Link>
            </div>
            {favorites.length ? (
              <TrackRow tracks={favorites.slice(0, 5)} showAlbum />
            ) : (
              <p className="text-zinc-400 text-sm">
                Songs you like will appear here.
              </p>
            )}
          </section>

          {playlists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">Your Playlists</h2>
                <Link
                  to="/library/playlists"
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Show all
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {playlists.slice(0, 8).map((playlist) => (
                  <Link
                    key={playlist._id}
                    to={`/library/playlists/${playlist._id}`}
                    className="rounded-md bg-zinc-800/50 hover:bg-zinc-800 p-3 transition-colors"
                  >
                    <img
                      src={
                        playlist.imgUrl ||
                        "https://placehold.co/200x200/18181b/71717a?text=♪"
                      }
                      alt={playlist.title}
                      className="aspect-square w-full rounded object-cover mb-3"
                    />
                    <div className="font-medium truncate">{playlist.title}</div>
                    <div className="text-xs text-zinc-400">
                      {playlist.tracks?.length || 0} songs
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-3">Recently played</h2>
              <TrackRow tracks={recent} showAlbum />
            </section>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

export default ProfilePage;
