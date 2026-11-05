/**
 * Curated metadata graph for MelodyPlay search.
 * Used to expand queries → adjacent official songs / artist discography seeds.
 * Does NOT invent fake tracks — only suggests search terms for live providers.
 */

import { normalizeForMatch, TITLE_ALIASES } from "./queryNormalize.js";

/** Official primary artists for well-known recordings */
export const OFFICIAL_RECORDINGS = {
  qaafirana: {
    artists: ["arijit singh", "nikhita gandhi", "amit trivedi"],
    album: "Kedarnath",
    adjacent: ["pinjra", "namo namo", "slow motion angreza"],
  },
  kesariya: {
    artists: ["arijit singh", "pritam"],
    album: "Brahmastra",
    adjacent: ["deva deva", "rasiya", "channa mereya"],
  },
  "tum hi ho": {
    artists: ["arijit singh", "mithoon"],
    album: "Aashiqui 2",
    adjacent: ["sun raha hai", "meri aashiqui", "chahun main ya naa"],
  },
  "channa mereya": {
    artists: ["arijit singh", "pritam"],
    album: "Ae Dil Hai Mushkil",
    adjacent: ["ae dil hai mushkil", "bulleya", "the break up song"],
  },
  "tum hi ho bandhu": {
    artists: ["pritam", "neeraj shridhar"],
    adjacent: ["tum hi ho"],
  },
  believer: {
    artists: ["imagine dragons"],
    adjacent: ["thunder", "radioactive", "demons"],
  },
  starboy: {
    artists: ["the weeknd", "daft punk"],
    adjacent: ["the hills", "blinding lights", "save your tears"],
  },
  "sun raha hai": {
    artists: ["shreya ghoshal", "arijit singh"],
    adjacent: ["tum hi ho", "saibo"],
  },
  saibo: {
    artists: ["shreya ghoshal", "tochi raina"],
    adjacent: ["bahar", "chikni chameli"],
  },
  bahara: {
    artists: ["shreya ghoshal", "sona mohapatra"],
    adjacent: ["saibo", "tujh mein rab dikhta hai"],
  },
  "chikni chameli": {
    artists: ["shreya ghoshal"],
    adjacent: ["saibo", "bahar"],
  },
  "agar tum saath ho": {
    artists: ["arijit singh", "alka yagnik"],
    adjacent: ["gerua", "janam janam"],
  },
  gerua: {
    artists: ["arijit singh", "antara mitra"],
    adjacent: ["janam janam", "agar tum saath ho"],
  },
  "chaleya": {
    artists: ["arijit singh", "shilpa rao"],
    adjacent: ["heeriye", "satranga"],
  },
  heeriye: {
    artists: ["arijit singh", "jasleen royal"],
    adjacent: ["chaleya", "kesariya"],
  },
  "raataan lambiyan": {
    artists: ["jubin nautiyal", "asees kaur"],
    adjacent: ["rangi saari", "tum hi ho"],
  },
};

/** Popular songs to inject as extra search seeds for artist-name queries */
export const ARTIST_ADJACENT_SONGS = {
  "arijit singh": [
    "tum hi ho",
    "kesariya",
    "channa mereya",
    "qaafirana",
    "agar tum saath ho",
    "gerua",
    "chaleya",
    "heeriye",
    "satranga",
    "apna bana le",
  ],
  "shreya ghoshal": [
    "saibo",
    "bahara",
    "chikni chameli",
    "sun raha hai",
    "tujh mein rab dikhta hai",
    "manwa laage",
    "deen shana hai",
    "agar tum saath ho",
  ],
  "sonu nigam": [
    "kal ho naa ho",
    "abhi mujh mein kahin",
    "sandese aate hai",
    "suraj hua maddham",
  ],
  "kishore kumar": [
    "pal pal dil ke paas",
    "yeh shaam mastani",
    "mere sapno ki rani",
    "chingari koi bhadke",
  ],
  "lata mangeshkar": [
    "lag ja gale",
    "tujhe dekha to",
    "mere khwabon mein",
  ],
  "atif aslam": ["tere sang yaara", "jeena jeena", "tajdar e haram", "adatein"],
  "neha kakkar": ["dilbar", "mile ho tum", "coca cola"],
  "diljit dosanjh": ["lover", "proper patola", "born to shine", "naina"],
  "pritam": ["kesariya", "channa mereya", "ae dil hai mushkil"],
  "imagine dragons": ["believer", "thunder", "radioactive", "demons"],
  "the weeknd": ["starboy", "blinding lights", "the hills", "save your tears"],
};

const aliasKey = (q = "") => {
  const n = normalizeForMatch(q);
  return TITLE_ALIASES[n] || n;
};

export const lookupRecordingMeta = (query = "") => {
  const key = aliasKey(query);
  if (OFFICIAL_RECORDINGS[key]) return { key, ...OFFICIAL_RECORDINGS[key] };
  for (const [song, meta] of Object.entries(OFFICIAL_RECORDINGS)) {
    if (key === song || key.includes(song) || song.includes(key)) {
      return { key: song, ...meta };
    }
  }
  return null;
};

export const lookupArtistAdjacentSongs = (query = "") => {
  const key = normalizeForMatch(query);
  if (ARTIST_ADJACENT_SONGS[key]) return ARTIST_ADJACENT_SONGS[key];
  for (const [artist, songs] of Object.entries(ARTIST_ADJACENT_SONGS)) {
    if (key.includes(artist) || artist.includes(key)) return songs;
  }
  return [];
};

/**
 * Extra provider search terms derived from metadata (bounded).
 * Never replaces the original user query.
 */
export const buildMetadataSearchSeeds = (
  rawQuery = "",
  { artistIntent = false, maxSeeds = 4 } = {},
) => {
  const seeds = [];
  const push = (text) => {
    const t = String(text || "").trim();
    if (!t) return;
    if (seeds.some((s) => normalizeForMatch(s) === normalizeForMatch(t))) return;
    seeds.push(t);
  };

  const recording = lookupRecordingMeta(rawQuery);
  if (recording) {
    const primary = recording.artists?.[0];
    if (primary) push(`${recording.key} ${primary}`);
    for (const adj of recording.adjacent || []) push(adj);
  }

  if (artistIntent) {
    for (const song of lookupArtistAdjacentSongs(rawQuery)) push(song);
  }

  return seeds.slice(0, maxSeeds);
};

/** True if track credits match curated official artists for a known title */
export const creditsMatchOfficial = (track, query) => {
  const meta = lookupRecordingMeta(query) || lookupRecordingMeta(track?.title);
  if (!meta?.artists?.length) return null;
  const artist = normalizeForMatch(track?.artist || "");
  const hit = meta.artists.some(
    (a) => artist.includes(a) || normalizeForMatch(a).includes(artist.split(",")[0]),
  );
  return hit;
};
