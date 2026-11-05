import { normalizeForMatch } from "./queryNormalize.js";

const primaryArtist = (value = "") =>
  normalizeForMatch(String(value).split(",")[0].split("&")[0]);

const normalizeTitleKey = (value = "") =>
  normalizeForMatch(value).replace(/\b(from|movie|ost|official|video|audio)\b/g, "").replace(/\s+/g, " ").trim();

/**
 * Safe track fingerprint — never merge on title alone.
 * Prefer ISRC; else title + primary artist (+ duration bucket when available).
 */
export const trackFingerprint = (track = {}) => {
  if (track.isrc) return `isrc:${String(track.isrc).toUpperCase()}`;
  const title = normalizeTitleKey(track.title || "");
  const artist = primaryArtist(track.artist || track.artists || "");
  if (!title || !artist) return null;
  return `ta:${title}|${artist}`;
};

/** True when durations are compatible enough to treat as the same recording. */
export const durationsCompatible = (a = 0, b = 0) => {
  const left = Number(a) || 0;
  const right = Number(b) || 0;
  if (!left || !right) return true;
  // Preview clips (~30s) may share title/artist with a full track
  if (left <= 40 || right <= 40) return true;
  return Math.abs(left - right) <= 25;
};

const playbackRank = (track = {}) => {
  let score = 0;
  if (!track.isPreview && (track.duration || 0) > 45) score += 50;
  if (track.audioUrl || track.playable || track.needsStreamResolve) score += 20;
  if (track.provider === "jiosaavn") score += 15;
  if (track.provider === "audius") score += 12;
  if (track.provider === "apple") score += 5;
  if (track.imgUrl && !/placehold|default-cover/i.test(track.imgUrl)) score += 5;
  return score;
};

/**
 * Collapse duplicates across providers while preserving the best playback source.
 * Attaches `alternateSources` when a strong match exists.
 */
export const dedupeTracks = (tracks = []) => {
  const groups = new Map();

  for (const track of tracks) {
    if (!track) continue;
    const fp = trackFingerprint(track);
    const idKey = `${track.provider}:${track.providerId}`;
    const key = fp || `id:${idKey}`;

    if (!fp) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(track);
      continue;
    }

    // Same title+artist: merge only when duration is compatible (or preview)
    let placed = false;
    for (const [existingKey, list] of groups.entries()) {
      if (!String(existingKey).startsWith(`${key}`)) continue;
      const seed = list[0];
      if (durationsCompatible(seed?.duration, track.duration)) {
        list.push(track);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Distinct recording with same title/artist but incompatible duration
      const uniqueKey = groups.has(key)
        ? `${key}|d:${Number(track.duration) || "x"}|${idKey}`
        : key;
      groups.set(uniqueKey, [track]);
    }
  }

  const out = [];
  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => playbackRank(b) - playbackRank(a));
    const full = ranked.find((t) => !t.isPreview && (t.duration || 0) > 45);
    const chosen = full || ranked[0];
    const primary = { ...chosen };
    if (ranked.length > 1) {
      primary.alternateSources = ranked
        .filter((t) => t !== chosen)
        .map((t) => ({
          provider: t.provider,
          providerId: t.providerId,
          id: t.id,
          isPreview: Boolean(t.isPreview),
          playable: Boolean(t.playable || t.audioUrl || t.needsStreamResolve),
        }));
    }
    out.push(primary);
  }
  return out;
};

export const dedupeById = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item?.id || `${item?.provider}:${item?.providerId}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};
