/**
 * Query normalization + bounded typo / alias expansion for MelodyPlay search.
 * Always preserves the original query for display/diagnostics.
 */

const ARTIST_ALIASES = {
  arjit: "arijit",
  "arjit singh": "arijit singh",
  "arijith singh": "arijit singh",
  ghosal: "ghoshal",
  "shreya ghosal": "shreya ghoshal",
  "atif aslam": "atif aslam",
  "neha khakar": "neha kakkar",
  "diljeet": "diljit",
  "diljeet dosanjh": "diljit dosanjh",
};

export const TITLE_ALIASES = {
  keseeriya: "kesariya",
  keseriya: "kesariya",
  "tumhi ho": "tum hi ho",
  "tumhiho": "tum hi ho",
  "tum hi ho": "tum hi ho",
  "channa mereya": "channa mereya",
  "channa meriya": "channa mereya",
  "raeas": "raees",
  "beliver": "believer",
  "star boy": "starboy",
  believer: "believer",
  starboy: "starboy",
  kesariya: "kesariya",
  qaafirana: "qaafirana",
  kafirana: "qaafirana",
  qafirana: "qaafirana",
};

const KNOWN_SONG_TITLES = new Set([
  ...Object.keys(TITLE_ALIASES),
  ...Object.values(TITLE_ALIASES),
]);

/**
 * Official / primary artist credits for well-known titles.
 * Used to rank genuine recordings above covers and name-collisions.
 */
export const OFFICIAL_SONG_ARTISTS = {
  qaafirana: ["arijit singh", "nikhita gandhi", "amit trivedi"],
  kesariya: ["arijit singh", "pritam"],
  "tum hi ho": ["arijit singh"],
  "channa mereya": ["arijit singh", "pritam"],
  believer: ["imagine dragons"],
  starboy: ["the weeknd", "daft punk"],
};

export const lookupOfficialArtists = (titleOrQuery = "") => {
  const key = normalizeForMatch(
    TITLE_ALIASES[normalizeForMatch(titleOrQuery)] || titleOrQuery,
  );
  // Match exact known titles or titles that start with the known key
  if (OFFICIAL_SONG_ARTISTS[key]) return OFFICIAL_SONG_ARTISTS[key];
  for (const [song, artists] of Object.entries(OFFICIAL_SONG_ARTISTS)) {
    if (key === song || key.startsWith(`${song} `) || key.includes(song)) {
      return artists;
    }
  }
  return null;
};

const GENRE_MOOD_HINTS = [
  "romantic",
  "sad",
  "party",
  "bollywood",
  "hindi",
  "punjabi",
  "lofi",
  "workout",
  "chill",
  "latest",
  "devotional",
];

export const normalizeUnicode = (value = "") =>
  String(value)
    .normalize("NFKC")
    .replace(/\u200b/g, "");

export const normalizeWhitespace = (value = "") =>
  normalizeUnicode(value).replace(/\s+/g, " ").trim();

export const stripPunctuation = (value = "") =>
  normalizeWhitespace(value)
    .replace(/[“”‘’]/g, '"')
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeForMatch = (value = "") =>
  stripPunctuation(value).toLowerCase();

/** Bounded Levenshtein — returns Infinity if either string is empty or lengths diverge too far. */
export const editDistance = (a = "", b = "", max = 3) => {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length || !t.length) return Math.max(s.length, t.length);
  if (Math.abs(s.length - t.length) > max) return Infinity;

  const rows = s.length + 1;
  const cols = t.length + 1;
  const prev = new Array(cols);
  const curr = new Array(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;

  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return Infinity;
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[t.length];
};

export const titleCaseWords = (value = "") =>
  normalizeWhitespace(value)
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/**
 * Expand a user query into provider search variants without mutating display text.
 */
export const buildSearchVariants = (rawQuery = "") => {
  const original = String(rawQuery || "");
  const trimmed = normalizeWhitespace(original);
  const lower = normalizeForMatch(trimmed);
  const variants = [];

  const push = (text, reason) => {
    const v = normalizeWhitespace(text);
    if (!v) return;
    if (variants.some((x) => normalizeForMatch(x.text) === normalizeForMatch(v)))
      return;
    variants.push({ text: v, reason });
  };

  push(trimmed, "original");
  push(lower, "lowercase");

  if (ARTIST_ALIASES[lower]) {
    push(ARTIST_ALIASES[lower], "artist_alias");
  }
  if (TITLE_ALIASES[lower]) {
    push(TITLE_ALIASES[lower], "title_alias");
  }

  // Token-level alias fixes (e.g. "Arjit Singh songs")
  const tokens = lower.split(" ").filter(Boolean);
  const fixedTokens = tokens.map((t) => ARTIST_ALIASES[t] || TITLE_ALIASES[t] || t);
  if (fixedTokens.join(" ") !== lower) {
    push(fixedTokens.join(" "), "token_alias");
  }

  // Common concatenation: tumhiho → tum hi ho
  if (lower === "tumhiho" || lower === "tumhi ho") {
    push("tum hi ho", "spacing");
  }

  // Title-cased display form for providers that prefer it
  push(titleCaseWords(variants[0]?.text || trimmed), "title_case");

  return {
    original,
    normalized: lower,
    variants: variants.slice(0, 5),
    primary: variants.find((v) => v.reason === "artist_alias" || v.reason === "title_alias" || v.reason === "token_alias")?.text
      || variants[0]?.text
      || trimmed,
  };
};

/**
 * Detect search intent and the entity-focused query (suffixes stripped).
 * Intents: SONG | ARTIST | ALBUM | PLAYLIST | GENRE | MOOD | GENERAL
 * (plus artist_songs for "<artist> songs")
 */
export const detectSearchIntent = (rawQuery = "") => {
  const original = String(rawQuery || "").trim();
  const q = normalizeForMatch(original);
  if (!q) {
    return { intent: "GENERAL", confidence: 0, entityQuery: "", artistIntent: false };
  }

  const moodHit = GENRE_MOOD_HINTS.some((h) => q.includes(h));

  const stripSuffix = (pattern) =>
    normalizeWhitespace(original.replace(pattern, " "));

  if (/\balbums?\b/i.test(q)) {
    return {
      intent: "ALBUM",
      confidence: 0.9,
      entityQuery: stripSuffix(/\balbums?\b/gi) || original,
      artistIntent: true,
    };
  }
  if (/\bplaylist\b|\bmixes?\b/i.test(q)) {
    return {
      intent: "PLAYLIST",
      confidence: 0.85,
      entityQuery: stripSuffix(/\b(playlist|mixes?)\b/gi) || original,
      artistIntent: false,
    };
  }
  if (/\bsongs?\b/i.test(q) && !moodHit) {
    const entity = stripSuffix(/\bsongs?\b/gi);
    const words = normalizeForMatch(entity).split(" ").filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      return {
        intent: "ARTIST",
        confidence: 0.88,
        entityQuery: entity || original,
        artistIntent: true,
        wantSongs: true,
      };
    }
    return {
      intent: "SONG",
      confidence: 0.7,
      entityQuery: entity || original,
      artistIntent: false,
    };
  }
  if (/\bartist\b|\bsinger\b/i.test(q)) {
    return {
      intent: "ARTIST",
      confidence: 0.9,
      entityQuery: stripSuffix(/\b(artist|singer)\b/gi) || original,
      artistIntent: true,
    };
  }

  if (moodHit && (q.includes("song") || q.includes("hit") || q.includes("mix"))) {
    return {
      intent: "MOOD",
      confidence: 0.75,
      entityQuery: original,
      artistIntent: false,
    };
  }
  if (moodHit) {
    return {
      intent: "GENRE",
      confidence: 0.6,
      entityQuery: original,
      artistIntent: false,
    };
  }

  const words = q.split(" ").filter(Boolean);

  // Known song titles must not be treated as artist identity searches
  if (KNOWN_SONG_TITLES.has(q)) {
    return {
      intent: "SONG",
      confidence: 0.85,
      entityQuery: original,
      artistIntent: false,
    };
  }

  // Typical "First Last" artist query (2 tokens). Three+ tokens without
  // explicit artist/songs/albums suffixes are more often song titles
  // (e.g. "Tum Hi Ho").
  if (words.length === 2) {
    return {
      intent: "ARTIST",
      confidence: 0.7,
      entityQuery: original,
      artistIntent: true,
    };
  }
  if (words.length === 1) {
    return {
      intent: "SONG",
      confidence: 0.55,
      entityQuery: original,
      artistIntent: false,
    };
  }
  return {
    intent: "SONG",
    confidence: 0.45,
    entityQuery: original,
    artistIntent: false,
  };
};

/**
 * Similarity in [0,1] using exact / prefix / token / bounded edit distance.
 */
export const stringSimilarity = (a = "", b = "") => {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.startsWith(left) || left.startsWith(right)) return 0.9;

  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  let fuzzyTokenHits = 0;
  for (const lt of leftTokens) {
    if (rightTokens.some((rt) => rt === lt || editDistance(lt, rt, 2) <= 1)) {
      fuzzyTokenHits += 1;
    }
  }
  const tokenScore =
    fuzzyTokenHits / Math.max(leftTokens.length, rightTokens.length, 1);

  const dist = editDistance(left, right, 4);
  const editScore =
    dist === Infinity
      ? 0
      : Math.max(0, 1 - dist / Math.max(left.length, right.length, 1));

  return Math.max(tokenScore * 0.9, editScore * 0.95);
};
