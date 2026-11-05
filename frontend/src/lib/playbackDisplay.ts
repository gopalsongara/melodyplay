import type { PlayableTrack } from "@/types";

/** Preview clips must never display full catalog duration. */
export const getDisplayDurationSeconds = (
  track: Pick<PlayableTrack, "duration" | "isPreview" | "previewDuration">,
): number => {
  if (track.isPreview) {
    return Number(track.previewDuration) || 30;
  }
  return Number(track.duration) || 0;
};

export const formatTrackDuration = (seconds: number): string => {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

export const getPlaybackLabel = (
  track: Pick<PlayableTrack, "isPreview" | "provider">,
): string => {
  // Never label as Deezer — that provider is removed. Apple clips are ~30s.
  if (track.isPreview || track.provider === "apple") return "Apple · 30s";
  if (track.provider === "jiosaavn") return "Full";
  if (track.provider === "audius") return "Full";
  return "";
};

const normalizeTitleKey = (title?: string) =>
  String(title || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * If the user taps a preview row but the same result list already has a
 * non-preview sibling with the same title, prefer that full source.
 */
export const preferFullSibling = <T extends PlayableTrack>(
  tracks: T[],
  index: number,
): { track: T; index: number } => {
  const clicked = tracks[index];
  if (!clicked?.isPreview) return { track: clicked, index };

  const key = normalizeTitleKey(clicked.title);
  if (!key) return { track: clicked, index };

  const fullIndex = tracks.findIndex(
    (t, i) =>
      i !== index &&
      !t.isPreview &&
      normalizeTitleKey(t.title) === key &&
      Boolean(t.audioUrl || t.needsStreamResolve || t.playable),
  );
  if (fullIndex < 0) return { track: clicked, index };
  return { track: tracks[fullIndex], index: fullIndex };
};
