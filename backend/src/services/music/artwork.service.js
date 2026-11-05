/**
 * Artwork helpers + optional MusicBrainz / Cover Art Archive enrichment.
 * Never attaches unrelated covers — requires strong title+artist match.
 */

import { normalizeForMatch, stringSimilarity } from "./queryNormalize.js";

const MB_UA =
  process.env.MUSICBRAINZ_USER_AGENT ||
  "MelodyPlay/1.0 (https://localhost; music-metadata)";

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect fill="#18181b" width="300" height="300"/><text x="150" y="158" fill="#71717a" font-family="sans-serif" font-size="48" text-anchor="middle">♪</text></svg>`,
  );

export const NEUTRAL_ARTWORK_PLACEHOLDER = PLACEHOLDER;

export const isPlaceholderArt = (url = "") =>
  !url ||
  /placehold\.co|default-cover|data:image\/svg\+xml/i.test(String(url));

export const preferLargerAppleArt = (url = "") =>
  String(url || "")
    .replace("100x100bb", "600x600bb")
    .replace("100x100", "600x600");

/**
 * Cover Art Archive front image for a MusicBrainz release MBID.
 */
export const fetchCoverArtArchive = async (mbid) => {
  if (!mbid) return null;
  try {
    const res = await fetch(
      `https://coverartarchive.org/release/${mbid}/front-500`,
      {
        redirect: "follow",
        headers: { Accept: "image/*", "User-Agent": MB_UA },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    // CAA redirects to actual image URL
    return res.url || null;
  } catch {
    return null;
  }
};

/**
 * Resolve a MusicBrainz release MBID only on strong title+artist match.
 */
export const findMusicBrainzRelease = async ({ title, artist }) => {
  const t = normalizeForMatch(title);
  const a = normalizeForMatch(String(artist || "").split(",")[0]);
  if (!t || t.length < 2) return null;

  const query = a
    ? `release:"${title}" AND artist:"${String(artist).split(",")[0].trim()}"`
    : `release:"${title}"`;

  try {
    const url = new URL("https://musicbrainz.org/ws/2/release/");
    url.searchParams.set("query", query);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", "5");

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": MB_UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const releases = data?.releases || [];

    for (const rel of releases) {
      const relTitle = rel.title || "";
      const relArtist =
        rel["artist-credit"]?.map((c) => c.name || c.artist?.name).join(", ") ||
        "";
      const titleScore = stringSimilarity(t, relTitle);
      const artistScore = a ? stringSimilarity(a, relArtist) : 1;
      // Strong match only — avoid wrong covers
      if (titleScore >= 0.88 && artistScore >= 0.75) {
        return { mbid: rel.id, title: relTitle, artist: relArtist, titleScore, artistScore };
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Enrich an album/track with CAA art when local art is missing.
 */
export const enrichArtworkIfMissing = async (entity = {}) => {
  if (!entity || !isPlaceholderArt(entity.imgUrl)) return entity;
  if (!entity.title && !entity.name) return entity;

  const match = await findMusicBrainzRelease({
    title: entity.title || entity.name,
    artist: entity.artist || entity.name,
  });
  if (!match?.mbid) return { ...entity, artworkSource: "placeholder" };

  const cover = await fetchCoverArtArchive(match.mbid);
  if (!cover) return { ...entity, artworkSource: "placeholder" };

  return {
    ...entity,
    imgUrl: cover,
    artworkSource: "cover-art-archive",
    musicBrainzId: match.mbid,
  };
};
