import { useEffect } from "react";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlayableTrack } from "@/types";

const LyricsPage = () => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const { fetchLyrics, lyrics } = useExternalMusicStore();

  useEffect(() => {
    if (!currentSong) return;
    const track = currentSong as PlayableTrack;
    fetchLyrics({
      provider: track.provider,
      id: track.providerId,
      artist: track.artist,
      title: track.title,
    });
  }, [currentSong, fetchLyrics]);

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-bold">Lyrics</h1>
        {!currentSong ? (
          <p className="text-zinc-400">Play a song to view lyrics.</p>
        ) : (
          <>
            <div>
              <div className="text-xl font-semibold">{currentSong.title}</div>
              <div className="text-zinc-400">{currentSong.artist}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-8 text-zinc-300 leading-relaxed">
              {lyrics?.available && lyrics.lyrics
                ? lyrics.lyrics
                : lyrics?.message ||
                  "Lyrics are not available from SayaMusicAPI for this track."}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default LyricsPage;
