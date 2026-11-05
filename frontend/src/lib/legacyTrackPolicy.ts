/**
 * Client-side mirror of backend legacyTrackPolicy.
 * Blocks Deezer restore + Songs.PK-labelled uploads from active playback UI.
 */

const BLOCKED_PROVIDERS = new Set(["deezer"]);

const UNTRUSTED_CATALOGUE =
  /\[?\s*songs\.?\s*pk\s*\]?|\bsongs\.pk\b|djmaza|pagalworld\.?rip|mp3hungama\.?rip/i;

const LOW_QUALITY_UPLOAD =
  /whatsapp\s*status|\b30\s*sec\b|\bringtone\b|bass\s*boosted|8d\s*audio/i;

export type LegacyTrackLike = {
  provider?: string | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  name?: string | null;
  audioUrl?: string | null;
  streamUrl?: string | null;
  id?: string | null;
  _id?: string | null;
};

export const isBlockedProvider = (provider?: string | null) => {
  const key = String(provider || "")
    .toLowerCase()
    .trim();
  if (!key) return false;
  if (BLOCKED_PROVIDERS.has(key)) return true;
  return key.startsWith("deezer");
};

export const isUntrustedCatalogueTrack = (track?: LegacyTrackLike | null) => {
  if (!track) return true;
  if (isBlockedProvider(track.provider)) return true;
  const hay = `${track.title || ""} ${track.artist || ""} ${track.album || ""} ${track.name || ""}`;
  if (UNTRUSTED_CATALOGUE.test(hay)) return true;
  const audio = String(track.audioUrl || track.streamUrl || "");
  if (/dzcdn\.net|deezer\.com/i.test(audio)) return true;
  return false;
};

export const isLowQualityUpload = (track?: LegacyTrackLike | null) => {
  if (!track) return false;
  return LOW_QUALITY_UPLOAD.test(
    `${track.title || ""} ${track.artist || ""}`,
  );
};

export const sanitizePersistedTrack = <T extends LegacyTrackLike>(
  track: T | null | undefined,
): T | null => {
  if (!track) return null;
  if (isUntrustedCatalogueTrack(track)) return null;
  return track;
};

export const sanitizeTrackList = <T extends LegacyTrackLike>(
  items: T[] | null | undefined,
): T[] =>
  (Array.isArray(items) ? items : [])
    .map((t) => sanitizePersistedTrack(t))
    .filter(Boolean) as T[];

export const playbackBlockedReason = (
  track?: LegacyTrackLike | null,
): string | null => {
  if (!track) return "No track selected";
  if (isBlockedProvider(track.provider)) {
    return `Provider "${track.provider}" is not available in MelodyPlay`;
  }
  if (isUntrustedCatalogueTrack(track)) {
    return "This track comes from an unverified legacy source and cannot be played";
  }
  return null;
};
