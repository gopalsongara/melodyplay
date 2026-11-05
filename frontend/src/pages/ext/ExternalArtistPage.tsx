import { useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import TrackRow from "@/components/music/TrackRow";
import MediaCard from "@/components/music/MediaCard";
import HorizontalShelf from "@/components/music/HorizontalShelf";
import { Play } from "lucide-react";

const ExternalArtistPage = () => {
  const { provider = "apple", id = "" } = useParams();
  const { fetchArtist, currentArtist, isLoading, error } =
    useExternalMusicStore();
  const playAt = usePlayerStore((s) => s.playAt);

  useEffect(() => {
    if (provider && id) fetchArtist(provider, id);
  }, [provider, id, fetchArtist]);

  const albums = currentArtist?.albums || [];
  const singles = useMemo(
    () =>
      (currentArtist?.singles || albums.filter((a) => /single|ep/i.test(a.title || ""))),
    [currentArtist?.singles, albums],
  );
  const fullAlbums = useMemo(
    () => albums.filter((a) => !/single|ep/i.test(a.title || "")),
    [albums],
  );

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-56 rounded-xl bg-zinc-800" />
        <div className="h-6 w-48 bg-zinc-800 rounded" />
      </div>
    );
  }

  if (error || !currentArtist) {
    return (
      <div className="p-8 text-zinc-400">
        {error || "Artist details unavailable for this provider"}
      </div>
    );
  }

  const { artist, topTracks } = currentArtist;
  const heroArt = artist.imgUrl;

  return (
    <ScrollArea className="h-[calc(100vh-180px)] md:h-[calc(100vh-100px)]">
      <div className="relative">
        <div
          className="h-56 sm:h-72 w-full relative overflow-hidden"
          style={{
            background: heroArt
              ? `linear-gradient(180deg, rgba(9,9,11,0.15), #09090b), url(${heroArt}) center/cover`
              : "linear-gradient(135deg, #064e3b, #09090b)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          <div className="absolute bottom-6 left-4 sm:left-8 right-4 flex flex-col sm:flex-row gap-5 items-end">
            <img
              src={heroArt}
              alt={artist.name || artist.title}
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover shadow-2xl ring-2 ring-white/10 bg-zinc-800"
            />
            <div className="pb-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
                Artist
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mt-1 mb-2 break-words">
                {artist.name || artist.title}
              </h1>
              <p className="text-zinc-300 text-sm">
                {artist.fans ? `${artist.fans.toLocaleString()} followers` : ""}
                {topTracks.length ? ` · ${topTracks.length} popular tracks` : ""}
              </p>
              {topTracks.length > 0 && (
                <Button
                  className="mt-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black"
                  onClick={() => playAt(topTracks, 0)}
                >
                  <Play className="size-4 mr-2 fill-black" /> Play
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-8 space-y-10">
          {topTracks.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Popular</h2>
              <TrackRow tracks={topTracks.slice(0, 10)} showAlbum />
            </section>
          )}

          {fullAlbums.length > 0 && (
            <HorizontalShelf title="Albums">
              {fullAlbums.map((album) => (
                <MediaCard
                  key={album.id}
                  title={album.title}
                  subtitle={String(album.releaseDate || "").slice(0, 4)}
                  image={album.imgUrl || album.imageUrl}
                  to={`/ext/albums/${album.provider}/${album.providerId}`}
                />
              ))}
            </HorizontalShelf>
          )}

          {singles.length > 0 && (
            <section>
              <h2 className="text-xl font-bold mb-4">Singles & EPs</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {singles.slice(0, 12).map((album) => (
                  <MediaCard
                    key={`s-${album.id}`}
                    title={album.title}
                    subtitle={String(album.releaseDate || "").slice(0, 4)}
                    image={album.imgUrl || album.imageUrl}
                    to={`/ext/albums/${album.provider}/${album.providerId}`}
                  />
                ))}
              </div>
            </section>
          )}

          <Link to="/search" className="text-sm text-zinc-400 hover:text-white">
            Back to search
          </Link>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ExternalArtistPage;
