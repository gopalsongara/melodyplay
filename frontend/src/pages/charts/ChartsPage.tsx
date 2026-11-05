import { useEffect } from "react";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";
import MediaCard from "@/components/music/MediaCard";

const ChartsPage = () => {
  const {
    fetchCharts,
    charts,
    trendingAlbums,
    trendingArtists,
    trendingPlaylists,
    isLoading,
  } = useExternalMusicStore();

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-4 sm:p-6 space-y-8">
        <h1 className="text-2xl font-bold">Charts</h1>
        {isLoading && !charts.length ? (
          <div className="text-zinc-400">Loading charts...</div>
        ) : (
          <>
            <section>
              <h2 className="text-xl font-bold mb-3">Top Tracks</h2>
              <TrackRow tracks={charts} showAlbum />
            </section>
            <section>
              <h2 className="text-xl font-bold mb-3">Top Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trendingAlbums.map((album) => (
                  <MediaCard
                    key={album.id}
                    title={album.title}
                    subtitle={album.artist}
                    image={album.imgUrl || album.imageUrl}
                    to={`/ext/albums/${album.provider}/${album.providerId}`}
                  />
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xl font-bold mb-3">Top Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trendingArtists.map((artist) => (
                  <MediaCard
                    key={artist.id}
                    title={artist.name}
                    subtitle="Artist"
                    image={artist.imgUrl}
                    rounded="full"
                    to={`/ext/artists/${artist.provider}/${artist.providerId}`}
                  />
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xl font-bold mb-3">Top Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trendingPlaylists.map((playlist) => (
                  <MediaCard
                    key={playlist.id}
                    title={playlist.title}
                    subtitle={playlist.artist}
                    image={playlist.imgUrl}
                    to={`/ext/playlists/${playlist.provider}/${playlist.providerId}`}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default ChartsPage;
