/**
 * Central provider eligibility for MelodyPlay discovery + playback.
 * Deezer is fully removed from the active ecosystem (preview-only / no longer used).
 */

export const BLOCKED_PROVIDERS = new Set(["deezer"]);

/**
 * Default providers for track search — FULL streams only.
 * Apple is intentionally excluded here (30s previews are not shown as songs).
 */
export const DEFAULT_TRACK_PROVIDERS = "jiosaavn,audius,jamendo";

/** Albums / artists / playlists catalog search (Apple metadata OK) */
export const DEFAULT_CATALOG_PROVIDERS = "jiosaavn,apple,jamendo";

export const isProviderAllowed = (provider) => {
  const key = String(provider || "")
    .toLowerCase()
    .trim();
  if (!key) return false;
  if (BLOCKED_PROVIDERS.has(key)) return false;
  if (key.startsWith("deezer")) return false;
  return true;
};

export const parseProviderList = (raw, fallback = DEFAULT_TRACK_PROVIDERS) => {
  const source = raw && String(raw).trim() ? String(raw) : fallback;
  return source
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .filter(isProviderAllowed);
};

export const assertProviderAllowed = (provider) => {
  if (!isProviderAllowed(provider)) {
    const err = new Error(
      `Provider "${provider}" is not available in MelodyPlay`,
    );
    err.status = 410;
    throw err;
  }
};

export const filterAllowedEntities = (items = []) =>
  (Array.isArray(items) ? items : []).filter((item) =>
    isProviderAllowed(item?.provider),
  );

/**
 * Stronger filter used by search / related / home — also strips Songs.PK
 * and other untrusted catalogue labels (see legacyTrackPolicy.js).
 */
export const filterDiscoverableEntities = (items = []) => {
  // Lazy import avoided: keep registry free of circular deps by inlining
  // the Songs.PK check here as well as in legacyTrackPolicy.
  const UNTRUSTED =
    /\[?\s*songs\.?\s*pk\s*\]?|\bsongs\.pk\b|pagalworld|mp3hungama|djmaza|masstamilan/i;
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!isProviderAllowed(item?.provider)) return false;
    const hay = `${item?.title || ""} ${item?.artist || ""} ${item?.name || ""}`;
    if (UNTRUSTED.test(hay)) return false;
    return true;
  });
};

export const ACTIVE_PROVIDER_NAMES = [
  "jiosaavn",
  "audius",
  "jamendo",
  "apple",
  "musicbrainz",
  "radio-browser",
  "archive",
];
