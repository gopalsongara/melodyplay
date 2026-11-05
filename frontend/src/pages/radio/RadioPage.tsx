import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MediaCard from "@/components/music/MediaCard";

const RadioPage = () => {
  const { fetchRadio, radioStations, isLoading } = useExternalMusicStore();
  const playAt = usePlayerStore((s) => s.playAt);

  useEffect(() => {
    fetchRadio();
  }, [fetchRadio]);

  return (
    <main className="rounded-lg overflow-hidden h-full bg-linear-to-b from-zinc-800 to-zinc-900">
      <ScrollArea className="h-full">
        <div className="p-4 sm:p-6 space-y-8 pb-28 md:pb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Radio</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Live stations from Radio Browser
            </p>
          </div>

          {isLoading && !radioStations.length ? (
            <p className="text-zinc-400 text-sm">Loading stations…</p>
          ) : radioStations.length === 0 ? (
            <p className="text-zinc-400 text-sm">No radio stations available.</p>
          ) : (
            <section>
              <h2 className="text-xl font-bold mb-4">Top stations</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {radioStations.map((station) => (
                  <MediaCard
                    key={station.id || station.providerId}
                    title={station.title}
                    subtitle={station.artist || "Live radio"}
                    image={station.imgUrl}
                    onPlay={() => playAt([station], 0)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </main>
  );
};

export default RadioPage;
