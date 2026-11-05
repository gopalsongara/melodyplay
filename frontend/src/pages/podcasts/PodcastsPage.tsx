import { useEffect, useState } from "react";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";
import { axiosInstance } from "@/lib/axios";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import MediaCard from "@/components/music/MediaCard";
import type { Podcast } from "@/types";
import { Button } from "@/components/ui/button";

const PodcastsPage = () => {
  const { homePodcasts, fetchHome } = useExternalMusicStore();
  const [q, setQ] = useState("music");
  const [results, setResults] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!homePodcasts.length) fetchHome();
  }, [homePodcasts.length, fetchHome]);

  const search = async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/music/search/podcasts", {
        params: { q, limit: 24 },
      });
      setResults(data.data.podcasts || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = results.length ? results : homePodcasts;

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-4 sm:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Podcasts</h1>
        <div className="flex gap-3 max-w-xl">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-zinc-800 border-zinc-700"
            placeholder="Search podcasts"
          />
          <Button
            onClick={search}
            className="bg-emerald-500 hover:bg-emerald-400 text-black"
          >
            Search
          </Button>
        </div>
        {loading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {list.map((podcast) => (
              <MediaCard
                key={podcast.id}
                title={podcast.title}
                subtitle="Podcast"
                image={podcast.imgUrl}
                to={`/podcasts/${podcast.providerId}`}
              />
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Podcast episode streaming depends on provider availability. Metadata and
          official links are shown when full episode audio is not exposed.
        </p>
      </div>
    </ScrollArea>
  );
};

export default PodcastsPage;
