/**
 * Legacy / blocked track policy for MelodyPlay.
 *
 * - Deezer is permanently blocked (discovery + playback).
 * - Songs.PK-labelled Audius/Archive uploads are not advertised as
 *   authorized MelodyPlay catalogue (piracy rip naming convention).
 * - Persisted queues / history may still contain old references;
 *   callers must sanitize before restore or playback.
 */

import { BLOCKED_PROVIDERS, isProviderAllowed } from "./providerRegistry.js";

/** Title / artist patterns that indicate untrusted rip / bootleg catalogue */
const UNTRUSTED_CATALOGUE_PATTERNS = [
  /\[?\s*songs\.?\s*pk\s*\]?/i,
  /\bsongs\.pk\b/i,
  /djmaza/i,
  /mp3hungama/i,
  /pagalworld/i,
  /masstamilan/i,
];

/** Soft noise uploads we demote / exclude from auto-queue related */
const LOW_QUALITY_UPLOAD_PATTERNS = [
  /whatsapp\s*status/i,
  /\b30\s*sec\b/i,
  /\bringtone\b/i,
  /bass\s*boosted/i,
  /8d\s*audio/i,
  /piano\s*instrumentals?/i,
  /\binstrumentals?\b/i,
  /karaoke/i,
];

export const isBlockedProviderName = (provider) => !isProviderAllowed(provider);

export const isUntrustedCatalogueTrack = (track = {}) => {
  const provider = String(track.provider || "").toLowerCase();
  if (isBlockedProviderName(provider)) return true;
  if (provider.startsWith("deezer")) return true;

  const haystack = [
    track.title,
    track.artist,
    track.album,
    track.name,
  ]
    .filter(Boolean)
    .join(" ");

  return UNTRUSTED_CATALOGUE_PATTERNS.some((re) => re.test(haystack));
};

export const isLowQualityUpload = (track = {}) => {
  const haystack = [track.title, track.artist].filter(Boolean).join(" ");
  return LOW_QUALITY_UPLOAD_PATTERNS.some((re) => re.test(haystack));
};

/** Safe for discovery / search results */
export const isDiscoverableTrack = (track = {}) => {
  if (!track) return false;
  if (isUntrustedCatalogueTrack(track)) return false;
  return isProviderAllowed(track.provider);
};

/** Safe to attempt playback (may still fail upstream) */
export const isPlayableCandidate = (track = {}) => {
  if (!isDiscoverableTrack(track)) return false;
  if (isLowQualityUpload(track) && track.provider === "audius") return false;
  return true;
};

export const filterDiscoverableTracks = (items = []) =>
  (Array.isArray(items) ? items : []).filter(isDiscoverableTrack);

export const filterPlayableCandidates = (items = []) =>
  (Array.isArray(items) ? items : []).filter(isPlayableCandidate);

/**
 * Sanitize a persisted player / library track snapshot.
 * Returns null when the reference must not be restored into the active queue.
 * Library rows are kept in DB but marked unavailable at read time.
 */
export const sanitizePersistedTrack = (track) => {
  if (!track) return null;
  if (isUntrustedCatalogueTrack(track)) return null;

  // Strip stale Deezer CDN / preview URLs even if provider field was mutated
  const audio = String(track.audioUrl || track.streamUrl || "");
  if (/dzcdn\.net|deezer\.com/i.test(audio)) return null;

  return track;
};

export const sanitizeTrackList = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map(sanitizePersistedTrack)
    .filter(Boolean);

export const assertTrackPlayable = (track) => {
  if (!track) {
    const err = new Error("Track is required");
    err.status = 400;
    throw err;
  }
  if (isBlockedProviderName(track.provider) || String(track.provider || "").toLowerCase().startsWith("deezer")) {
    const err = new Error(
      `Provider "${track.provider}" is not available in MelodyPlay`,
    );
    err.status = 410;
    throw err;
  }
  if (isUntrustedCatalogueTrack(track)) {
    const err = new Error(
      "This track comes from an unverified legacy source and cannot be played in MelodyPlay",
    );
    err.status = 403;
    throw err;
  }
};

export const LEGACY_POLICY_NOTES = {
  deezer:
    "Deezer is permanently blocked. Old queue/history entries are sanitized on restore; stream/preview return 410.",
  songsPk:
    "Songs.PK-labelled uploads (typically via Audius) are filtered from search/related and rejected for playback advertising. They are not a MelodyPlay provider.",
  archive:
    "Internet Archive remains capability-listed but streams that return 404/502 are not advertised as working full tracks.",
  blockedProviders: [...BLOCKED_PROVIDERS],
};
