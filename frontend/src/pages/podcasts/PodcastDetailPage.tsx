import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { axiosInstance } from "@/lib/axios";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Podcast } from "@/types";

const PodcastDetailPage = () => {
  const { id = "" } = useParams();
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axiosInstance.get(`/music/podcasts/${id}`);
        setPodcast(data.data.podcast);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Podcast not found");
      }
    };
    if (id) load();
  }, [id]);

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="p-6">
        {error && <div className="text-zinc-400">{error}</div>}
        {podcast && (
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <img
              src={podcast.imgUrl}
              alt={podcast.title}
              className="w-48 h-48 rounded object-cover bg-zinc-800"
            />
            <div>
              <p className="text-sm text-zinc-400">Podcast</p>
              <h1 className="text-3xl font-bold mt-2 mb-3">{podcast.title}</h1>
              <p className="text-zinc-300 max-w-2xl whitespace-pre-wrap">
                {podcast.description || "No description available."}
              </p>
              {podcast.externalUrl && (
                <a
                  href={podcast.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-4 text-emerald-400 hover:underline"
                >
                  Open externally
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default PodcastDetailPage;
