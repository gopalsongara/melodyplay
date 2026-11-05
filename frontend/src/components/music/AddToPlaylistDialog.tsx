import { useEffect, useState } from "react";
import type { PlayableTrack } from "@/types";
import { useLibraryStore } from "@/stores/useLibraryStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListMusic, Plus } from "lucide-react";

interface Props {
  track: PlayableTrack | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddToPlaylistDialog = ({ track, open, onOpenChange }: Props) => {
  const { playlists, fetchPlaylists, createPlaylist, addToPlaylist } =
    useLibraryStore();
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      void fetchPlaylists();
      setNewTitle("");
    }
  }, [open, fetchPlaylists]);

  const handleAdd = async (playlistId: string) => {
    if (!track || busy) return;
    setBusy(true);
    try {
      await addToPlaylist(playlistId, track);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAdd = async () => {
    const title = newTitle.trim();
    if (!title || !track || busy) return;
    setBusy(true);
    try {
      const created = await createPlaylist(title);
      if (created?._id) {
        await addToPlaylist(created._id, track);
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {track
              ? `Choose a playlist for “${track.title}”`
              : "Choose a playlist"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New playlist name"
            className="bg-zinc-950 border-zinc-700"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreateAndAdd();
            }}
          />
          <Button
            type="button"
            disabled={!newTitle.trim() || busy}
            onClick={() => void handleCreateAndAdd()}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-black"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
          {!playlists.length ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              No playlists yet — create one above
            </p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl._id}
                type="button"
                disabled={busy}
                onClick={() => void handleAdd(pl._id)}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-white/10 disabled:opacity-50"
              >
                <div className="size-10 rounded bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {pl.imgUrl ? (
                    <img
                      src={pl.imgUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ListMusic className="size-4 text-zinc-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{pl.title}</div>
                  <div className="text-xs text-zinc-400">
                    {pl.tracks?.length || 0} songs
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToPlaylistDialog;
