/**
 * Public iTunes Search API client (Apple metadata + preview artwork).
 * Authorized public catalog search — preview playback only for songs.
 */

const BASE = "https://itunes.apple.com/search";
const DEFAULT_TIMEOUT_MS = Number(process.env.ITUNES_TIMEOUT_MS || 8000);

export const itunesSearch = async ({
  term,
  entity = "song",
  limit = 20,
  country = "IN",
} = {}) => {
  if (!term || !String(term).trim()) return { results: [], resultCount: 0 };

  const url = new URL(BASE);
  url.searchParams.set("term", String(term).trim());
  url.searchParams.set("entity", entity);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", country);
  url.searchParams.set("media", "music");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`iTunes Search HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};
