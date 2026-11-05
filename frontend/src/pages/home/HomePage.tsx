import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";
import MediaCard from "@/components/music/MediaCard";
import HorizontalShelf from "@/components/music/HorizontalShelf";
import FeaturedGridSkeleton from "@/components/skeletons/FeaturedGridSkeleton";
import { Link } from "react-router-dom";
import { Settings, UserRound } from "lucide-react";

/** Home personalization from played / liked music only — never search queries. */
const buildInterestSeeds = ({
  recentlyPlayed,
  history,
  favorites,
}: {
  recentlyPlayed: Array<{
    artist?: string;
    title?: string;
    album?: string | null;
  }>;
  history: Array<{ artist?: string; title?: string; album?: string | null }>;
  favorites: Array<{ artist?: string; title?: string; album?: string | null }>;
}) => {
  const seeds: string[] = [];
  const push = (value?: string | null) => {
    const v = String(value || "")
      .split(",")[0]
      .replace(/\(.*?\)/g, "")
      .replace(/from\s+".*?"/gi, "")
      .trim();
    if (v.length < 2 || v.length > 48) return;
    if (!seeds.some((s) => s.toLowerCase() === v.toLowerCase())) {
      seeds.push(v);
    }
  };

  const played = [...recentlyPlayed, ...history];
  played.forEach((track) => push(track.artist));
  favorites.forEach((track) => push(track.artist));
  played.forEach((track) =>
    push(typeof track.album === "string" ? track.album : null),
  );

  return seeds.slice(0, 6);
};

const greetingForHour = (hour = new Date().getHours()) => {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const HomePage = () => {
  const {
    fetchHome,
    fetchGenres,
    homeFeatured,
    charts,
    trendingAlbums,
    trendingArtists,
    mixPlaylists,
    playlistShelves,
    throwbackTracks,
    genres,
    isLoading,
    error,
    albumReasons,
    interestSeeds,
    isPersonalized,
  } = useExternalMusicStore();

  const { recentlyPlayed } = usePlayerStore();
  const { history, fetchHistory, favorites, fetchFavorites, playlists, fetchPlaylists } =
    useLibraryStore();
  const playAt = usePlayerStore((s) => s.playAt);

  const seeds = useMemo(
    () =>
      buildInterestSeeds({
        recentlyPlayed,
        history,
        favorites,
      }),
    [recentlyPlayed, history, favorites],
  );

  const seedsKey = seeds.join("|");
  const greeting = useMemo(() => greetingForHour(), []);

  useEffect(() => {
    fetchHome(seeds);
    fetchGenres();
    fetchHistory();
    fetchFavorites();
    fetchPlaylists();
  }, [seedsKey, fetchHome, fetchGenres, fetchHistory, fetchFavorites, fetchPlaylists]);

  const recent = (history.length ? history : recentlyPlayed).slice(0, 8);
  const quickAccess = useMemo(() => {
    const items: Array<{
      key: string;
      title: string;
      image?: string;
      onPlay?: () => void;
      to?: string;
    }> = [];

    homeFeatured.slice(0, 4).forEach((track, idx) => {
      items.push({
        key: `feat-${track._id || track.id}`,
        title: track.title,
        image: track.imgUrl,
        onPlay: () => playAt(homeFeatured, idx),
      });
    });

    (playlists || []).slice(0, 2).forEach((pl) => {
      items.push({
        key: `pl-${pl._id}`,
        title: pl.title || "Playlist",
        image: pl.imgUrl,
        to: `/library/playlists/${pl._id}`,
      });
    });

    if (favorites.length) {
      items.push({
        key: "liked",
        title: "Liked Songs",
        image: favorites[0]?.imgUrl,
        to: "/favorites",
      });
    }

    return items.slice(0, 6);
  }, [homeFeatured, playlists, favorites, playAt]);

  const albumSectionTitle = isPersonalized ? "Popular albums" : "Top albums";
  const albumSectionSubtitle = isPersonalized
    ? `Based on ${interestSeeds
        .slice(0, 3)
        .map((s) => `“${s}”`)
        .join(", ")}`
    : "Trending right now";

  return (
    <main className="rounded-lg overflow-hidden h-full min-h-0 min-w-0 w-full bg-linear-to-b from-zinc-800 to-zinc-900">
      <ScrollArea className="h-full w-full min-w-0">
        <div className="p-3 sm:p-6 space-y-6 sm:space-y-8 pb-28 md:pb-8 w-full min-w-0 max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 md:hidden">
                MelodyPlay
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{greeting}</h1>
              {isPersonalized && (
                <p className="text-sm text-zinc-400 mt-1 truncate">
                  Picks from your listening history
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex gap-3 text-sm">
                <Link className="text-zinc-300 hover:text-white" to="/charts">
                  Charts
                </Link>
                <Link className="text-zinc-300 hover:text-white" to="/radio">
                  Radio
                </Link>
              </div>
              <Link
                to="/profile"
                className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                aria-label="Profile"
              >
                <UserRound className="size-4" />
              </Link>
              <Link
                to="/profile"
                className="md:hidden inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                aria-label="Settings"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {error}
            </div>
          )}

          {isLoading && !homeFeatured.length && !quickAccess.length ? (
            <FeaturedGridSkeleton />
          ) : quickAccess.length > 0 ? (
            <section className="md:hidden">
              <div className="grid grid-cols-2 gap-2">
                {quickAccess.map((item) => {
                  const content = (
                    <>
                      <img
                        src={
                          item.image ||
                          "https://placehold.co/96x96/18181b/71717a?text=♪"
                        }
                        alt=""
                        className="size-12 object-cover shrink-0 bg-zinc-900"
                        loading="lazy"
                      />
                      <span className="px-2 text-sm font-semibold truncate">
                        {item.title}
                      </span>
                    </>
                  );
                  const className =
                    "flex items-center min-h-[52px] bg-white/10 hover:bg-white/15 active:bg-white/20 rounded overflow-hidden text-left transition-colors";
                  if (item.to) {
                    return (
                      <Link key={item.key} to={item.to} className={className}>
                        {content}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={className}
                      onClick={item.onPlay}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {isLoading && !homeFeatured.length ? null : homeFeatured.length > 0 ? (
            <section className="hidden md:block">
              <h2 className="text-xl font-bold mb-4">
                {isPersonalized ? "Jump back in" : "Trending songs"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {homeFeatured.slice(0, 6).map((track, idx) => (
                  <button
                    key={track._id || track.id}
                    type="button"
                    className="flex items-center bg-zinc-800/50 hover:bg-zinc-700/50 rounded-md overflow-hidden text-left transition-colors"
                    onClick={() => playAt(homeFeatured, idx)}
                  >
                    <img
                      src={track.imgUrl}
                      alt={track.title}
                      className="w-16 h-16 object-cover shrink-0"
                      loading="lazy"
                    />
                    <div className="p-3 min-w-0">
                      <div className="font-medium truncate">{track.title}</div>
                      <div className="text-sm text-zinc-400 truncate">
                        {track.artist}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {recent.length > 0 && (
            <section>
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                Recently played
              </h2>
              <TrackRow tracks={recent} showAlbum />
            </section>
          )}

          {trendingArtists.length > 0 && (
            <HorizontalShelf
              title={isPersonalized ? "Popular artists" : "Top artists"}
              subtitle={
                isPersonalized ? "Artists you keep coming back to" : undefined
              }
            >
              {trendingArtists.slice(0, 12).map((artist) => (
                <MediaCard
                  key={artist.id}
                  shelf
                  title={artist.name || artist.title || "Artist"}
                  subtitle="Artist"
                  image={artist.imgUrl}
                  rounded="full"
                  to={`/ext/artists/${artist.provider}/${artist.providerId}`}
                />
              ))}
            </HorizontalShelf>
          )}

          {trendingAlbums.length > 0 && (
            <HorizontalShelf
              title={albumSectionTitle}
              subtitle={albumSectionSubtitle}
            >
              {trendingAlbums.slice(0, 12).map((album) => (
                <div key={album.id || album._id} className="shrink-0 space-y-1">
                  <MediaCard
                    shelf
                    title={album.title}
                    subtitle={album.artist}
                    image={album.imgUrl || album.imageUrl}
                    to={`/ext/albums/${album.provider}/${album.providerId}`}
                  />
                  {albumReasons[album.id || ""] && (
                    <p className="text-[11px] text-zinc-500 px-1 truncate w-40">
                      {albumReasons[album.id || ""]}
                    </p>
                  )}
                </div>
              ))}
            </HorizontalShelf>
          )}

          {(mixPlaylists.length > 0 ||
            playlistShelves.some((s) => s.id === "for-you")) && (
            <HorizontalShelf
              title="Made for you"
              subtitle="Mixes tailored to your vibe"
            >
              {(
                playlistShelves.find((s) => s.id === "for-you")?.playlists ||
                mixPlaylists
              )
                .slice(0, 12)
                .map((playlist) => (
                  <MediaCard
                    key={playlist.id}
                    shelf
                    title={playlist.title}
                    subtitle={playlist.artist || "Playlist"}
                    image={playlist.imgUrl}
                    to={`/ext/playlists/${playlist.provider}/${playlist.providerId}`}
                  />
                ))}
            </HorizontalShelf>
          )}

          {playlistShelves
            .filter((s) => s.id !== "for-you")
            .map((shelf) => (
              <HorizontalShelf
                key={shelf.id}
                title={shelf.title}
                subtitle={shelf.subtitle}
                to={
                  shelf.query
                    ? `/genres/${encodeURIComponent(shelf.query)}`
                    : undefined
                }
              >
                {shelf.playlists.map((playlist) => (
                  <MediaCard
                    key={`${shelf.id}-${playlist.id}`}
                    shelf
                    title={playlist.title}
                    subtitle={playlist.artist || "Playlist"}
                    image={playlist.imgUrl}
                    to={`/ext/playlists/${playlist.provider}/${playlist.providerId}`}
                  />
                ))}
              </HorizontalShelf>
            ))}

          {charts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold">
                  {isPersonalized ? "Recommended songs" : "Charts"}
                </h2>
                <Link
                  to="/charts"
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Show all
                </Link>
              </div>
              <TrackRow tracks={charts.slice(0, 8)} showAlbum />
            </section>
          )}

          {throwbackTracks.length > 0 && (
            <section>
              <h2 className="text-lg sm:text-xl font-bold mb-1">
                Throwback classics
              </h2>
              <p className="text-sm text-zinc-400 mb-3 sm:mb-4">
                90s, 2000s &amp; old Bollywood favourites
              </p>
              <TrackRow tracks={throwbackTracks.slice(0, 10)} showAlbum />
            </section>
          )}

          {favorites.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Liked songs</h2>
                <Link
                  to="/favorites"
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Show all
                </Link>
              </div>
              <TrackRow tracks={favorites.slice(0, 5)} showAlbum />
            </section>
          )}

          {genres.length > 0 && (
            <section>
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                Browse moods &amp; genres
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {genres.map((genre, i) => {
                  const accents = [
                    "#8B5A2B",
                    "#C45C26",
                    "#9B2C5A",
                    "#1B6CA8",
                    "#2F6F4E",
                    "#B45309",
                    "#4C1D95",
                    "#0F766E",
                  ];
                  return (
                    <Link
                      key={genre.id}
                      to={`/genres/${encodeURIComponent(genre.query)}`}
                      className="relative h-20 sm:h-24 rounded-lg overflow-hidden p-3 font-bold text-white shadow-md hover:brightness-110 transition"
                      style={{
                        background: `linear-gradient(135deg, ${accents[i % accents.length]}, #18181b)`,
                      }}
                    >
                      <span className="relative z-10 text-sm sm:text-lg">
                        {genre.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </main>
  );
};

export default HomePage;
