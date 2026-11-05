import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";

const GenrePage = () => {
  const { genre = "" } = useParams();
  const { fetchGenre, fetchGenres, genreTracks, genres, isLoading } =
    useExternalMusicStore();

  useEffect(() => {
    fetchGenres();
    if (genre) fetchGenre(decodeURIComponent(genre));
  }, [genre, fetchGenre, fetchGenres]);

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold capitalize">
          {decodeURIComponent(genre || "Genre")}
        </h1>

        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <Link
              key={g.id}
              to={`/genres/${encodeURIComponent(g.query)}`}
              className={`px-3 py-1 rounded-full text-sm ${
                g.query === decodeURIComponent(genre)
                  ? "bg-emerald-500 text-black"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {g.title}
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : genreTracks.length ? (
          <TrackRow tracks={genreTracks} showAlbum />
        ) : (
          <div className="text-zinc-400">No tracks found for this mood</div>
        )}
      </div>
    </ScrollArea>
  );
};

export default GenrePage;
