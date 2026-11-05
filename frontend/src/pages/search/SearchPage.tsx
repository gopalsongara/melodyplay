import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { useSearchStore } from "@/stores/useSearchStore";
import { useDebounce } from "@/hooks/useDebounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";
import MediaCard from "@/components/music/MediaCard";
import { Loader2 } from "lucide-react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { PlayableTrack } from "@/types";
import { cn } from "@/lib/utils";

type SearchFilter = "all" | "songs" | "artists" | "albums" | "playlists";

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get("q") || "";
  const [filter, setFilter] = useState<SearchFilter>("all");

  const {
    search,
    autocomplete,
    searchResults,
    suggestions,
    isLoading,
    clearSearch,
    searchQuery,
    setSearchQuery,
    genres,
    fetchGenres,
    error,
  } = useExternalMusicStore();
  const { addToHistory, searchHistory } = useSearchStore();
  const playAt = usePlayerStore((s) => s.playAt);
  const debounced = useDebounce(searchQuery, 350);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length >= 2) {
      search(trimmed);
      autocomplete(trimmed);
      if (urlQuery !== trimmed) {
        setParams({ q: trimmed }, { replace: true });
      }
      if (trimmed.length >= 3) addToHistory(trimmed);
      return;
    }

    clearSearch();
    if (urlQuery) {
      setParams({}, { replace: true });
    }
  }, [
    debounced,
    search,
    autocomplete,
    clearSearch,
    setParams,
    addToHistory,
    urlQuery,
  ]);

  const trimmedQuery = searchQuery.trim();
  const activeQuery = trimmedQuery.length >= 2;

  const {
    tracks,
    albums,
    artists,
    playlists,
    podcasts,
    recommended,
    recommendSeed,
    topResult,
  } = searchResults;
  const hasResults =
    tracks.length ||
    albums.length ||
    artists.length ||
    playlists.length ||
    podcasts.length ||
    (recommended?.length || 0);

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

  const topTrack =
    topResult && (topResult as PlayableTrack).type === "track"
      ? (topResult as PlayableTrack)
      : tracks[0];

  return (
    <main className="h-full min-h-0 min-w-0 w-full rounded-lg bg-zinc-900">
      <ScrollArea className="h-full w-full min-w-0">
        <div className="p-4 sm:p-6 space-y-6 pb-28 md:pb-8 w-full min-w-0 max-w-full overflow-x-hidden">
          <div>
            <h1 className="text-2xl font-bold">Search</h1>
            <p className="text-sm text-zinc-500 mt-1 md:hidden">
              Songs, artists, albums &amp; playlists
            </p>
          </div>

          {!activeQuery && searchHistory.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Recent searches</h2>
              <div className="flex flex-wrap gap-2">
                {searchHistory.slice(0, 10).map((item) => (
                  <button
                    key={item.query}
                    type="button"
                    className="text-sm px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[36px]"
                    onClick={() => setSearchQuery(item.query)}
                  >
                    {item.query}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!activeQuery && genres.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Browse all</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {genres.map((genre, i) => (
                  <Link
                    key={genre.id}
                    to={`/genres/${encodeURIComponent(genre.query)}`}
                    className="relative h-24 rounded-lg overflow-hidden p-3 font-bold text-white shadow-md hover:brightness-110 transition"
                    style={{
                      background: `linear-gradient(135deg, ${accents[i % accents.length]}, #18181b)`,
                    }}
                  >
                    {genre.title}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeQuery && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 8).map((s) => (
                <button
                  key={s.text}
                  type="button"
                  className="text-xs px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 min-h-[32px]"
                  onClick={() => {
                    if (s.track) playAt([s.track], 0);
                    else setSearchQuery(s.text);
                  }}
                >
                  {s.text}
                </button>
              ))}
            </div>
          )}

          {activeQuery && isLoading && !hasResults && (
            <div className="space-y-4" aria-busy="true">
              <div className="flex items-center gap-4">
                <div className="size-24 sm:size-32 rounded-md bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-6 w-48 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex justify-center py-6">
                <Loader2 className="size-7 animate-spin text-emerald-500" />
              </div>
            </div>
          )}

          {activeQuery && error && (
            <div className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
              {error}
            </div>
          )}

          {activeQuery && hasResults && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  ["all", "All"],
                  ["songs", "Songs"],
                  ["artists", "Artists"],
                  ["albums", "Albums"],
                  ["playlists", "Playlists"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-sm min-h-[36px] transition-colors",
                    filter === key
                      ? "bg-white text-black font-semibold"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {activeQuery && !isLoading && !hasResults && (
            <div className="text-zinc-400 py-12 text-center space-y-2">
              <p>No results for “{searchQuery}”</p>
              <p className="text-sm text-zinc-500">
                Try a song title, artist name, or a shorter spelling.
              </p>
            </div>
          )}

          {activeQuery && topTrack && filter === "all" && (
            <section>
              <h2 className="text-lg font-semibold mb-3 text-zinc-300">
                Top result
              </h2>
              <button
                type="button"
                className="w-full sm:max-w-md flex items-center gap-4 p-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-left transition-colors"
                onClick={() => {
                  const idx = Math.max(
                    0,
                    tracks.findIndex(
                      (t) =>
                        (t.id || t._id) === (topTrack.id || topTrack._id),
                    ),
                  );
                  playAt(tracks.length ? tracks : [topTrack], idx >= 0 ? idx : 0);
                }}
              >
                <img
                  key={topTrack.imgUrl || topTrack.id}
                  src={
                    topTrack.imgUrl ||
                    "https://placehold.co/300x300/18181b/71717a?text=%E2%99%AA"
                  }
                  alt=""
                  className="size-24 sm:size-28 rounded object-cover bg-zinc-900 shrink-0"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/300x300/18181b/71717a?text=%E2%99%AA";
                  }}
                />
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Song
                  </div>
                  <div className="text-xl font-bold truncate mt-1">
                    {topTrack.title}
                  </div>
                  <div className="text-sm text-zinc-400 truncate mt-1">
                    {topTrack.artist}
                  </div>
                </div>
              </button>
            </section>
          )}

          {activeQuery && tracks.length > 0 && (filter === "all" || filter === "songs") && (
            <section>
              <h2 className="text-xl font-bold mb-3">Songs</h2>
              <TrackRow tracks={tracks} showAlbum />
            </section>
          )}

          {activeQuery && artists.length > 0 && (filter === "all" || filter === "artists") && (
            <section>
              <h2 className="text-xl font-bold mb-3">Artists</h2>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {artists.map((artist) => (
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
              </div>
            </section>
          )}

          {activeQuery && albums.length > 0 && (filter === "all" || filter === "albums") && (
            <section>
              <h2 className="text-xl font-bold mb-3">Albums</h2>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {albums.map((album) => (
                  <MediaCard
                    key={album.id}
                    shelf
                    title={album.title}
                    subtitle={album.artist}
                    image={album.imgUrl || album.imageUrl}
                    to={`/ext/albums/${album.provider}/${album.providerId}`}
                  />
                ))}
              </div>
            </section>
          )}

          {activeQuery && playlists.length > 0 && (filter === "all" || filter === "playlists") && (
            <section>
              <h2 className="text-xl font-bold mb-3">Playlists</h2>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {playlists.map((playlist) => (
                  <MediaCard
                    key={playlist.id}
                    shelf
                    title={playlist.title}
                    subtitle={playlist.artist || "Playlist"}
                    image={playlist.imgUrl}
                    to={`/ext/playlists/${playlist.provider}/${playlist.providerId}`}
                  />
                ))}
              </div>
            </section>
          )}

          {activeQuery && !!recommended?.length && (
            <section>
              <h2 className="text-xl font-bold mb-1">More like this</h2>
              <p className="text-sm text-zinc-400 mb-3">
                {recommendSeed?.artist
                  ? `Recommended from ${recommendSeed.artist}`
                  : "Similar songs you might like"}
              </p>
              <TrackRow tracks={recommended} showAlbum />
            </section>
          )}
        </div>
      </ScrollArea>
    </main>
  );
};

export default SearchPage;
