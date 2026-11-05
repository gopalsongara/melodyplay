import { useEffect, useRef, useState } from "react";
import { Heart, Play, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
}

const FavoritesButton = ({ className, compact = false }: Props) => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { favorites, fetchFavorites, toggleFavorite, isFavorite } =
    useLibraryStore();
  const playAt = usePlayerStore((s) => s.playAt);
  const currentSong = usePlayerStore((s) => s.currentSong);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={panelRef}>
      <Button
        size={compact ? "icon" : "default"}
        variant="ghost"
        className={cn(
          "hover:text-white text-zinc-300 gap-2",
          favorites.length > 0 && "text-emerald-400",
        )}
        aria-label="Liked Songs"
        onClick={() => setOpen((v) => !v)}
      >
        <Heart
          className={cn(
            "size-4",
            favorites.length > 0 && "fill-emerald-500 text-emerald-500",
          )}
        />
        {!compact && (
          <span className="hidden sm:inline text-sm">
            Liked{favorites.length ? ` · ${favorites.length}` : ""}
          </span>
        )}
        {compact && favorites.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center">
            {favorites.length > 99 ? "99+" : favorites.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute bottom-full mb-3 right-0 w-[min(92vw,22rem)] max-h-[24rem] rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-indigo-900/60 to-zinc-900">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-8 rounded bg-linear-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shrink-0">
                <Heart className="size-4 fill-white text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">Liked Songs</div>
                <div className="text-xs text-zinc-400">
                  {favorites.length} {favorites.length === 1 ? "song" : "songs"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {favorites.length > 0 && (
                <Button
                  size="icon"
                  className="rounded-full size-8 bg-emerald-500 hover:bg-emerald-400 text-black"
                  onClick={() => {
                    playAt(favorites, 0);
                    setOpen(false);
                  }}
                >
                  <Play className="size-4 fill-black" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-zinc-400"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[18rem]">
            {!favorites.length ? (
              <div className="p-4 text-sm text-zinc-400">
                Heart any song to see it here.
              </div>
            ) : (
              favorites.map((track, index) => {
                const id = track._id || track.id || "";
                const active =
                  (currentSong?._id || currentSong?.id || "") === id;
                return (
                  <div
                    key={`${id}-${index}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer",
                      active && "bg-white/5",
                    )}
                    onClick={() => {
                      playAt(favorites, index);
                      setOpen(false);
                    }}
                  >
                    <img
                      src={track.imgUrl}
                      alt=""
                      className="size-10 rounded object-cover bg-zinc-800 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/80x80/18181b/71717a?text=♪";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm font-medium truncate",
                          active && "text-emerald-400",
                        )}
                      >
                        {track.title}
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {track.artist}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-2 text-emerald-500 hover:text-emerald-400"
                      aria-label="Unlike"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(track);
                      }}
                    >
                      <Heart
                        className={cn(
                          "size-4",
                          isFavorite(id) && "fill-emerald-500",
                        )}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-800 px-3 py-2">
            <Link
              to="/favorites"
              className="text-xs text-zinc-400 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Open Liked Songs page →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoritesButton;
