import { usePlayerStore } from "@/stores/usePlayerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import TrackRow from "@/components/music/TrackRow";
import { Button } from "@/components/ui/button";
import type { PlayableTrack } from "@/types";

const QueuePage = () => {
  const {
    queue,
    currentSong,
    currentIndex,
    clearQueue,
    recentlyPlayed,
    playAt,
  } = usePlayerStore();

  const nextUp = queue.slice(Math.max(0, currentIndex + 1)) as PlayableTrack[];

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-4 sm:p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Queue</h1>
          <Button
            variant="outline"
            onClick={clearQueue}
            disabled={!queue.length}
          >
            Clear
          </Button>
        </div>

        {currentSong && (
          <section>
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-2">
              Now Playing
            </h2>
            <TrackRow tracks={[currentSong as PlayableTrack]} showAlbum />
          </section>
        )}

        <section>
          <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-2">
            Next Up
          </h2>
          {nextUp.length ? (
            <TrackRow
              tracks={nextUp}
              showAlbum
              indexOffset={currentIndex + 1}
              onPlayTrack={(_track, index) => {
                void playAt(queue, currentIndex + 1 + index);
              }}
            />
          ) : (
            <div className="text-zinc-400 text-sm">
              No songs queued next. Use{" "}
              <span className="text-zinc-200">⋯ → Play next</span> on any track.
            </div>
          )}
        </section>

        {recentlyPlayed.length > 0 && (
          <section>
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-2">
              Recently Played
            </h2>
            <TrackRow tracks={recentlyPlayed as PlayableTrack[]} showAlbum />
          </section>
        )}
      </div>
    </ScrollArea>
  );
};

export default QueuePage;
