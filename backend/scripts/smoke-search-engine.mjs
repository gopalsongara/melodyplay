/**
 * Live search smoke suite — measures relevance, providers, latency.
 * Run: node scripts/smoke-search-engine.mjs
 * Does not fail the process on soft quality warnings (prints JSON summary).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  searchTracks,
  searchAlbums,
  searchArtists,
} from "../src/services/music/musicSearch.service.js";
import {
  buildSearchVariants,
  normalizeForMatch,
  stringSimilarity,
} from "../src/services/music/queryNormalize.js";
import { clearSearchCache, resetCircuits } from "../src/services/music/searchOrchestrator.js";

const QUERIES = [
  { q: "Shreya Ghoshal", kind: "artist" },
  { q: "Shreya Ghoshal songs", kind: "artist" },
  { q: "Shreya Ghoshal albums", kind: "albums" },
  { q: "Arijit Singh", kind: "artist" },
  { q: "Arjit Singh", kind: "artist" },
  { q: "Sonu Nigam", kind: "artist" },
  { q: "Kishore Kumar", kind: "artist" },
  { q: "Lata Mangeshkar", kind: "artist" },
  { q: "Udit Narayan", kind: "artist" },
  { q: "Sunidhi Chauhan", kind: "artist" },
  { q: "Kesariya", kind: "song" },
  { q: "Tum Hi Ho", kind: "song" },
  { q: "Channa Mereya", kind: "song" },
  { q: "Believer", kind: "song" },
  { q: "Starboy", kind: "song" },
  { q: "Hindi Sad Songs", kind: "mood" },
  { q: "Bollywood Romantic Songs", kind: "mood" },
];

const artistCore = (q) => {
  const stripped = String(q || "")
    .replace(/\b(songs?|albums?|artist|singer)\b/gi, " ")
    .trim();
  const { primary } = buildSearchVariants(stripped || q);
  return normalizeForMatch(primary);
};

const isRelevantTrack = (track, q, kind) => {
  const core = artistCore(q);
  const title = normalizeForMatch(track.title || "");
  const artist = normalizeForMatch(track.artist || "");
  if (kind === "artist") {
    return (
      stringSimilarity(core, artist.split(",")[0]) >= 0.7 ||
      artist.includes(core) ||
      core.split(" ").every((t) => t.length < 2 || artist.includes(t))
    );
  }
  if (kind === "song") {
    return stringSimilarity(core, title) >= 0.55 || title.includes(core);
  }
  return true;
};

const isRelevantAlbum = (album, q) => {
  const core = artistCore(q);
  const artist = normalizeForMatch(album.artist || "");
  return (
    stringSimilarity(core, artist.split(",")[0]) >= 0.65 ||
    artist.includes(core)
  );
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runOne = async ({ q, kind }) => {
  const started = Date.now();
  if (kind === "albums") {
    const res = await searchAlbums({ q, limit: 20 });
    const albums = res.albums || [];
    const relevant = albums.filter((a) => isRelevantAlbum(a, q));
    return {
      query: q,
      kind,
      detectedIntent: res.detectedIntent,
      total: albums.length,
      relevant: relevant.length,
      unrelatedPct:
        albums.length === 0
          ? 0
          : Math.round(((albums.length - relevant.length) / albums.length) * 100),
      byProvider: res.providerSources || {},
      providerStatus: res.providerStatus || {},
      latencyMs: Date.now() - started,
      sample: albums.slice(0, 5).map((a) => ({
        title: a.title,
        artist: a.artist,
        provider: a.provider,
        artwork: Boolean(a.imgUrl && !String(a.imgUrl).includes("svg+xml")),
      })),
    };
  }

  const [tracksRes, artistsRes] = await Promise.all([
    searchTracks({ q, limit: 20 }),
    kind === "artist" ? searchArtists({ q: artistCore(q), limit: 5 }) : Promise.resolve({ artists: [] }),
  ]);
  const tracks = tracksRes.tracks || [];
  const relevant = tracks.filter((t) => isRelevantTrack(t, q, kind));
  const providers = new Set(tracks.map((t) => t.provider));
  return {
    query: q,
    kind,
    detectedIntent: tracksRes.detectedIntent,
    total: tracks.length,
    relevant: relevant.length,
    uniqueRecordings: tracks.length,
    unrelatedPct:
      tracks.length === 0
        ? 100
        : Math.round(((tracks.length - relevant.length) / tracks.length) * 100),
    correctArtists: (artistsRes.artists || []).length,
    byProvider: tracksRes.providerSources || tracksRes.byProvider || {},
    providerStatus: tracksRes.providerStatus || {},
    latencyMs: tracksRes.searchLatencyMs || Date.now() - started,
    sample: tracks.slice(0, 5).map((t) => ({
      title: t.title,
      artist: t.artist,
      provider: t.provider,
      playbackType: t.playbackType,
      isPreview: t.isPreview,
    })),
    providerDiversity: [...providers],
  };
};

const main = async () => {
  resetCircuits();
  clearSearchCache();
  const rows = [];
  for (const item of QUERIES) {
    try {
      const row = await runOne(item);
      rows.push(row);
      console.log(
        JSON.stringify({
          ok: true,
          q: row.query,
          intent: row.detectedIntent,
          total: row.total,
          relevant: row.relevant,
          unrelatedPct: row.unrelatedPct,
          ms: row.latencyMs,
          providers: row.byProvider,
        }),
      );
    } catch (error) {
      rows.push({ query: item.q, kind: item.kind, error: error.message });
      console.log(JSON.stringify({ ok: false, q: item.q, error: error.message }));
    }
    await sleep(350);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    queryCount: rows.length,
    avgLatencyMs: Math.round(
      rows.filter((r) => r.latencyMs).reduce((s, r) => s + r.latencyMs, 0) /
        Math.max(1, rows.filter((r) => r.latencyMs).length),
    ),
    artistQueriesWithResults: rows.filter(
      (r) => r.kind === "artist" && (r.relevant || 0) >= 3,
    ).length,
    rows,
  };

  const outDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../_provider_eval",
  );
  const outPath = path.join(outDir, "final-search-smoke.json");
  try {
    writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`Wrote ${outPath}`);
  } catch {
    writeFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "final-search-smoke.json"),
      JSON.stringify(summary, null, 2),
    );
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
