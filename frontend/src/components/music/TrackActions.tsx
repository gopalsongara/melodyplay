import { useEffect, useRef, useState } from "react";
import type { PlayableTrack } from "@/types";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Button } from "@/components/ui/button";
import AddToPlaylistDialog from "@/components/music/AddToPlaylistDialog";
import {
  ListEnd,
  ListPlus,
  MoreHorizontal,
  SkipForward,
} from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  track: PlayableTrack;
}

const TrackActions = ({ track }: Props) => {
  const { playNextInQueue, addToQueue } = usePlayerStore();
  const [open, setOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          size="icon"
          variant="ghost"
          className="text-zinc-400 hover:text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[open=true]:opacity-100"
          data-open={open}
          aria-label="More options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <MoreHorizontal className="size-4" />
        </Button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 bottom-full z-50 mb-1 w-48 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              onClick={() => {
                playNextInQueue(track);
                toast.success("Playing next");
                setOpen(false);
              }}
            >
              <SkipForward className="size-4 shrink-0" />
              Play next
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              onClick={() => {
                addToQueue(track);
                toast.success("Added to queue");
                setOpen(false);
              }}
            >
              <ListEnd className="size-4 shrink-0" />
              Add to queue
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
              onClick={() => {
                setOpen(false);
                setPlaylistOpen(true);
              }}
            >
              <ListPlus className="size-4 shrink-0" />
              Add to playlist
            </button>
          </div>
        )}
      </div>

      <AddToPlaylistDialog
        track={track}
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
      />
    </>
  );
};

export default TrackActions;
