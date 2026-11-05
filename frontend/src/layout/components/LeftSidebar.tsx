import PlaylistSkeleton from "@/components/skeletons/PlaylistSkeleton";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMusicStore } from "@/stores/useMusicStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { SignedIn } from "@clerk/clerk-react";
import {
  HomeIcon,
  Library,
  MessageCircle,
  Radio,
  Search,
  Heart,
  Mic2,
  ListMusic,
  UserRound,
} from "lucide-react";
import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";

const LeftSidebar = () => {
  const { albums, fetchAlbums, isLoading } = useMusicStore();
  const { playlists, fetchPlaylists, favorites, fetchFavorites } =
    useLibraryStore();

  useEffect(() => {
    fetchAlbums();
    fetchPlaylists();
    fetchFavorites();
  }, [fetchAlbums, fetchPlaylists, fetchFavorites]);

  const navLink = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          buttonVariants({
            variant: "ghost",
            className: "w-full justify-start text-white hover:bg-zinc-800",
          }),
          isActive && "bg-zinc-800 text-emerald-400",
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="rounded-lg bg-zinc-900 p-4">
        <Link to="/" className="flex items-center gap-2 px-2 mb-3">
          <img
            src="/glossy-blue-play-icon.png"
            className="size-9 rounded-lg object-cover shadow-[0_0_12px_rgba(56,189,248,0.45)]"
            alt="MelodyPlay"
          />
          <span className="font-bold tracking-tight">MelodyPlay</span>
        </Link>
        <div className="space-y-1">
          {navLink("/", <HomeIcon className="mr-2 size-5" />, "Home")}
          <button
            type="button"
            className={cn(
              buttonVariants({
                variant: "ghost",
                className: "w-full justify-start text-white hover:bg-zinc-800",
              }),
            )}
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                'input[placeholder="Search music..."]',
              );
              input?.focus();
              input?.select();
            }}
          >
            <Search className="mr-2 size-5" />
            <span>Search</span>
          </button>
          {navLink("/radio", <Radio className="mr-2 size-5" />, "Radio")}
          {navLink("/charts", <ListMusic className="mr-2 size-5" />, "Charts")}
          {navLink("/lyrics", <Mic2 className="mr-2 size-5" />, "Lyrics")}
          {navLink("/profile", <UserRound className="mr-2 size-5" />, "Profile")}
          {navLink(
            "/favorites",
            <Heart className="mr-2 size-5" />,
            "Liked Songs",
          )}
          <SignedIn>
            {navLink(
              "/library/playlists",
              <Library className="mr-2 size-5" />,
              "Your Playlists",
            )}
            {navLink(
              "/chat",
              <MessageCircle className="mr-2 size-5" />,
              "Messages",
            )}
          </SignedIn>
        </div>
      </div>

      <div className="flex-1 rounded-lg bg-zinc-900 p-4 min-h-0">
        <div className="flex items-center text-white px-2 mb-4">
          <Library className="size-5 mr-2" />
          <span>Your Library</span>
        </div>

        <ScrollArea className="h-[calc(100vh-420px)]">
          <div className="space-y-2">
            <Link
              to="/favorites"
              className="p-2 hover:bg-zinc-800 rounded-md flex items-center gap-3"
            >
              <div className="size-12 rounded-md bg-linear-to-br from-indigo-700 to-emerald-600 flex items-center justify-center shrink-0">
                <Heart className="size-5 fill-white text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">Liked Songs</p>
                <p className="text-sm text-zinc-400">
                  Playlist · {favorites.length} songs
                </p>
              </div>
            </Link>

            {playlists.map((playlist) => (
              <Link
                to={`/library/playlists/${playlist._id}`}
                key={playlist._id}
                className="p-2 hover:bg-zinc-800 rounded-md flex items-center gap-3"
              >
                <img
                  src={
                    playlist.imgUrl ||
                    "https://placehold.co/96x96/18181b/71717a?text=♪"
                  }
                  alt={playlist.title}
                  className="size-12 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{playlist.title}</p>
                  <p className="text-sm text-zinc-400 truncate">
                    Playlist · {playlist.tracks?.length || 0} songs
                  </p>
                </div>
              </Link>
            ))}

            {isLoading ? (
              <PlaylistSkeleton />
            ) : (
              albums.map((album) => (
                <Link
                  to={`/albums/${album._id}`}
                  key={album._id || album.title}
                  className="p-2 hover:bg-zinc-800 rounded-md flex items-center gap-3 group cursor-pointer"
                >
                  <img
                    src={album.imageUrl || album.imgUrl || ""}
                    alt="Album"
                    className="size-12 rounded-md shrink-0 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-sm text-zinc-400 truncate">
                      Album · {album.artist}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
export default LeftSidebar;
