import { Play } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  image?: string;
  to?: string;
  onPlay?: () => void;
  rounded?: "md" | "full";
  /** Fixed width for horizontal Spotify-style shelves */
  shelf?: boolean;
}

const MediaCard = ({
  title,
  subtitle,
  image,
  to,
  onPlay,
  rounded = "md",
  shelf = false,
}: Props) => {
  const content = (
    <div
      className={`bg-zinc-800/40 hover:bg-zinc-800/80 transition-colors p-3 rounded-md group cursor-pointer ${
        shelf
          ? "w-[8.75rem] sm:w-40 shrink-0 snap-start"
          : ""
      }`}
    >
      <div className="relative mb-3">
        <img
          key={image || title}
          src={image || "https://placehold.co/300x300/18181b/71717a?text=%E2%99%AA"}
          alt={title}
          className={`w-full aspect-square object-cover shadow-lg ${
            rounded === "full" ? "rounded-full" : "rounded-md"
          } bg-zinc-900`}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            if (!el.dataset.fallback) {
              el.dataset.fallback = "1";
              el.src =
                "https://placehold.co/300x300/18181b/71717a?text=%E2%99%AA";
            }
          }}
        />
        {onPlay && (
          <button
            type="button"
            aria-label={`Play ${title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay();
            }}
            className="absolute bottom-2 right-2 size-10 rounded-full bg-emerald-500 text-black flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-lg"
          >
            <Play className="size-5 fill-black" />
          </button>
        )}
      </div>
      <div className="font-medium truncate text-sm">{title}</div>
      {subtitle && (
        <div className="text-xs text-zinc-400 truncate mt-1">{subtitle}</div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className={shelf ? "shrink-0 snap-start block" : undefined}>
        {content}
      </Link>
    );
  }
  return content;
};

export default MediaCard;
