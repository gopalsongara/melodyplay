/**
 * Live catalog popularity oracle (iTunes + Saya/Jio metadata).
 * Used to rank ANY query like Spotify — not hardcoded song lists.
 * Never returns preview clips as playable tracks; only title/artist seeds.
 */

import { itunesSearch } from "./itunes.client.js";
import { sayaRequest } from "./saya.client.js";
import { normalizeForMatch, stringSimilarity } from "./queryNormalize.js";

const stripParen = (title = "") =>
  String(title)
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const pushHit = (hits, hit) => {
  if (!hit?.title) return;
  const key = `${normalizeForMatch(hit.title)}|${normalizeForMatch(
    String(hit.artist || "").split(",")[0],
  )}`;
  if (hits.some((h) => h.key === key)) return;
  hits.push({ ...hit, key });
};

/** How closely a catalog title matches the user query (0 = unrelated noise). */
const titleRelevanceTier = (hitTitle, query) => {
  const q = normalizeForMatch(query);
  const ht = normalizeForMatch(stripParen(hitTitle || ""));
  if (!q || !ht) return 0;
  if (ht === q) return 4;
  if (ht.startsWith(`${q} `) || ht.startsWith(`${q}-`)) return 3;
  const sim = stringSimilarity(q, ht);
  if (sim >= 0.92) return 3;
  if (sim >= 0.82) return 2;
  const tokens = ht.split(/\s+/).filter(Boolean);
  if (tokens.some((t) => t === q || stringSimilarity(t, q) >= 0.9)) return 2;
  // Prefix / stem: "alfaz" → alfazon / alfaazo (not random unrelated titles)
  if (
    q.length >= 4 &&
    tokens.some(
      (t) =>
        t.startsWith(q) ||
        (t.length >= 4 && q.startsWith(t)) ||
        stringSimilarity(t, q) >= 0.78,
    )
  ) {
    return 1;
  }
  // Multi-word query: all tokens present
  const qTokens = q.split(/\s+/).filter((t) => t.length > 1);
  if (
    qTokens.length > 1 &&
    qTokens.every((qt) => tokens.some((t) => stringSimilarity(t, qt) >= 0.88))
  ) {
    return 3;
  }
  return 0;
};

/**
 * @returns {Promise<{ hits: Array<{title,artist,playCount?,rank,source}>, seeds: string[] }>}
 */
export const fetchCatalogHits = async (query, { limit = 8 } = {}) => {
  const q = String(query || "").trim();
  if (!q) return { hits: [], seeds: [] };

  const hits = [];

  const [itunesRes, sayaRes] = await Promise.allSettled([
    itunesSearch({ term: q, entity: "song", limit: Math.max(limit, 10), country: "IN" }),
    sayaRequest("/v1/jiosaavn/search/songs", {
      params: { q },
      cache: true,
    }),
  ]);

  if (itunesRes.status === "fulfilled") {
    const rows = itunesRes.value?.results || [];
    rows.forEach((row, i) => {
      pushHit(hits, {
        title: stripParen(row.trackName || ""),
        artist: row.artistName || "",
        playCount: null,
        duration: row.trackTimeMillis
          ? Math.round(row.trackTimeMillis / 1000)
          : null,
        rank: i,
        source: "itunes",
      });
    });
  }

  if (sayaRes.status === "fulfilled") {
    const rows =
      sayaRes.value?.data?.results ||
      sayaRes.value?.data?.data ||
      sayaRes.value?.results ||
      [];
    const sorted = [...(Array.isArray(rows) ? rows : [])].sort(
      (a, b) => Number(b.playCount || 0) - Number(a.playCount || 0),
    );
    sorted.slice(0, limit * 2).forEach((row, i) => {
      pushHit(hits, {
        title: stripParen(row.title || row.name || ""),
        artist: row.artist || row.primaryArtists || row.singers || "",
        playCount: Number(row.playCount || 0) || null,
        duration: Number(row.durationSeconds || row.duration || 0) || null,
        rank: i,
        source: "jiosaavn_meta",
      });
    });
  }

  // Drop unrelated mega-hits (e.g. "perfect" → Zara Sa).
  const relevant = hits
    .map((h) => ({ ...h, tier: titleRelevanceTier(h.title, q) }))
    .filter((h) => h.tier > 0);

  const hitScore = (h) => {
    // Tier dominates. iTunes rank is a strong global popularity prior.
    // Jio playCount wins only when it is clearly huge (trending in IN).
    let score = h.tier * 1e12;
    if (h.source === "itunes") {
      score += (50 - Math.min(h.rank, 49)) * 1e9;
    }
    const plays = Number(h.playCount || 0);
    if (plays >= 1_000_000) score += Math.min(plays, 5e8);
    else if (plays >= 100_000) score += plays * 0.5;
    else score += plays;
    return score;
  };

  relevant.sort((a, b) => hitScore(b) - hitScore(a));

  // Keep exact titles, but always reserve room for mega near-matches
  // (e.g. query "alfaz" → "Alfazon Ki Tarah" / "Alfaazo" with millions of plays).
  const exact = relevant.filter((h) => h.tier >= 3);
  const nearMega = relevant
    .filter(
      (h) => h.tier > 0 && h.tier < 3 && Number(h.playCount || 0) >= 500_000,
    )
    .sort(
      (a, b) => Number(b.playCount || 0) - Number(a.playCount || 0),
    );
  const merged = [];
  const seen = new Set();
  const pushMerged = (h) => {
    if (!h || seen.has(h.key)) return;
    seen.add(h.key);
    merged.push(h);
  };
  // If exact titles lack play-count signal (iTunes-only), surface mega
  // stem hits first ("alfaz" → Alfazon Ki Tarah). Otherwise exact wins
  // ("tum hi ho" stays above Tum Hi Aana).
  const exactHasPlays = exact.some((h) => Number(h.playCount || 0) >= 50_000);
  const head = exactHasPlays
    ? [...exact, ...nearMega]
    : [...nearMega.slice(0, 2), ...exact];
  for (const h of head) {
    if (merged.length >= limit) break;
    pushMerged(h);
  }
  for (const h of relevant) {
    if (merged.length >= limit) break;
    pushMerged(h);
  }

  const top = merged;
  const seeds = [];
  for (const h of top.slice(0, 5)) {
    const primaryArtist = String(h.artist || "")
      .split(/,|&/)[0]
      .trim();
    if (h.title && primaryArtist) seeds.push(`${h.title} ${primaryArtist}`);
    if (h.title) seeds.push(h.title);
  }

  return {
    hits: top,
    seeds: [...new Set(seeds.map((s) => s.trim()).filter(Boolean))],
  };
};

/** Boost a full-stream track when it matches a catalog popularity hit. */
export const catalogMatchBoost = (track, hits = []) => {
  if (!hits.length || !track) return 0;
  const title = normalizeForMatch(stripParen(track.title || ""));
  const artist = normalizeForMatch(track.artist || "");
  const primaryArtist = artist.split(",")[0].trim();
  let best = 0;

  hits.forEach((hit, index) => {
    const ht = normalizeForMatch(hit.title || "");
    const ha = normalizeForMatch(String(hit.artist || "").split(/,|&/)[0]);
    if (!ht) return;

    const titleSim = stringSimilarity(title, ht);
    const artistSim = Math.max(
      stringSimilarity(primaryArtist, ha),
      ha && artist.includes(ha) ? 0.92 : 0,
    );

    // Require real title match to the popular recording
    if (titleSim < 0.78 && !(title.includes(ht) || ht.includes(title))) return;

    const playCount = Number(hit.playCount || 0);
    let boost = Math.round((1 - index / Math.max(hits.length, 1)) * 60);
    boost += Math.round(titleSim * 90);

    // Artist credit must land for mega-hits — prevents random "Alfaz" stubs
    // from stealing the slot of Alfazon Ki Tarah / Alfaazo / etc.
    if (artistSim >= 0.55) {
      boost += Math.round(artistSim * 80);
      if (playCount > 1_000_000) boost += 120;
      else if (playCount > 100_000) boost += 70;
      else if (playCount > 10_000) boost += 30;
    } else if (titleSim >= 0.95 && playCount > 1_000_000) {
      boost += 50; // exact title of a mega-hit even if artist string messy
    } else {
      boost = Math.min(boost, 40); // weak artist → tiny boost only
    }

    best = Math.max(best, boost);
  });

  return best;
};
