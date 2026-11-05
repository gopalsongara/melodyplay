import { sayaRequest, SayaApiError } from "./saya.client.js";
import {
  jiosaavnRequest,
  pickBestDownloadUrl,
  extractArtistNames,
  extractImageUrl,
} from "./jiosaavn.client.js";
import {
  mapJioSaavnFullSong,
  mapAudiusTrack,
  mapTracks,
  normalizePlayableTrack,
} from "./music.mapper.js";
import { getTrackDetails } from "./musicDetails.service.js";
import { canAttemptJioSaavnFullPlayback } from "./providerCapabilities.js";
import { assertProviderAllowed, isProviderAllowed } from "./providerRegistry.js";
import { withHonestPlaybackDuration } from "../../lib/playbackHonesty.js";
import { isUntrustedCatalogueTrack } from "./legacyTrackPolicy.js";

const normalizeTitle = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const primaryArtist = (value = "") =>
  String(value).split(",")[0].split("&")[0].trim().toLowerCase();

const scoreFullMatch = (seed, candidate) => {
  const seedTitle = normalizeTitle(seed.title);
  const candTitle = normalizeTitle(candidate.title);
  if (!seedTitle || !candTitle) return 0;

  let score = 0;
  if (seedTitle === candTitle) score += 100;
  else if (candTitle.includes(seedTitle) || seedTitle.includes(candTitle))
    score += 70;
  else {
    const seedWords = seedTitle.split(" ").filter((w) => w.length > 2);
    const hits = seedWords.filter((w) => candTitle.includes(w)).length;
    if (!hits) return 0;
    score += Math.round((hits / seedWords.length) * 40);
  }

  const seedArtist = primaryArtist(seed.artist);
  const candArtist = primaryArtist(candidate.artist);
  if (seedArtist && candArtist) {
    if (seedArtist === candArtist) score += 40;
    else if (
      candArtist.includes(seedArtist) ||
      seedArtist.includes(candArtist)
    )
      score += 25;
  }

  if (!candidate.isPreview && candidate.audioUrl) score += 15;
  if ((candidate.duration || 0) > 45) score += 10;
  return score;
};

const artistsOverlap = (a = "", b = "") => {
  const left = primaryArtist(a);
  const right = primaryArtist(b);
  if (!left || !right) return true; // can't verify — allow title-based match
  return left === right || left.includes(right) || right.includes(left);
};

const pickBestFullMatch = (seed, candidates, minScore = 70) => {
  // Prefer candidates that share the seed artist to avoid fingerstyle/cover traps
  const ranked = [...candidates].sort(
    (a, b) => scoreFullMatch(seed, b) - scoreFullMatch(seed, a),
  );

  for (const candidate of ranked) {
    const score = scoreFullMatch(seed, candidate);
    if (score < minScore) continue;
    if (!artistsOverlap(seed.artist, candidate.artist)) {
      // Exact title alone is not enough when artists clearly differ
      continue;
    }
    return candidate;
  }
  return null;
};

/**
 * Try JioSaavn sidecar for a full match (only when operator allows attempts).
 */
const upgradeViaJioSaavn = async (track) => {
  if (!canAttemptJioSaavnFullPlayback()) return null;

  const artistHint = primaryArtist(track.artist);
  const query = `${track.title} ${artistHint}`.trim();

  const res = await jiosaavnRequest("/api/search/songs", {
    params: { query, limit: 10 },
    cacheEnabled: true,
  });

  const candidates = mapTracks(res?.data?.results || [], (item) =>
    mapJioSaavnFullSong(item, {
      pickBestDownloadUrl,
      extractArtistNames,
      extractImageUrl,
    }),
  )
    .map(normalizePlayableTrack)
    .filter((t) => t?.audioUrl && !t.isPreview);

  return pickBestFullMatch(track, candidates, 70);
};

/**
 * Authorized open-platform fallback: match a full Audius track via Saya.
 * Used when Apple only exposes ~30s previews and JioSaavn is unavailable.
 */
const upgradeViaAudius = async (track) => {
  const artistHint = primaryArtist(track.artist);
  const query = `${track.title} ${artistHint}`.trim();

  const res = await sayaRequest("/v1/audius/search/tracks", {
    params: { q: query, limit: 10 },
    cache: true,
  });

  const candidates = mapTracks(res?.data?.data || res?.data || [], mapAudiusTrack)
    .map(normalizePlayableTrack)
    .filter((t) => t && !t.isPreview && (t.audioUrl || t.needsStreamResolve));

  const best = pickBestFullMatch(track, candidates, 70);
  if (!best) return null;

  // Resolve stream URL so mobile HTML5 audio has a direct playable src
  if (best.needsStreamResolve || !best.audioUrl) {
    try {
      const res = await sayaRequest("/v1/media/stream", {
        params: { source: "audius", id: best.providerId },
        cache: false,
      });
      const audioUrl = res?.data?.streamUrl || res?.data?.audioUrl || null;
      if (!audioUrl) return null;
      return normalizePlayableTrack({
        ...best,
        audioUrl,
        streamUrl: audioUrl,
        duration: best.duration || res?.data?.duration || 0,
        isPreview: false,
        needsStreamResolve: false,
        playable: true,
      });
    } catch {
      return null;
    }
  }
  return best;
};

/**
 * Upgrade a preview/clip to a full authorized track when possible.
 * Order: existing full JioSaavn → JioSaavn sidecar (if allowed) → Audius (Saya).
 */
export const upgradeToFullTrack = async (track = {}) => {
  if (!track?.title) return null;

  // Already a full JioSaavn track
  if (
    track.provider === "jiosaavn" &&
    track.audioUrl &&
    !track.isPreview &&
    (track.duration || 0) > 45
  ) {
    return normalizePlayableTrack(track);
  }

  try {
    const viaJio = await upgradeViaJioSaavn(track);
    if (viaJio) return viaJio;
  } catch {
    /* sidecar down — try Audius */
  }

  try {
    const viaAudius = await upgradeViaAudius(track);
    if (viaAudius) return viaAudius;
  } catch {
    /* no audius match */
  }

  return null;
};

const SUPPORTED_STREAM_SOURCES = new Set([
  "apple",
  "audius",
  "archive",
  "radio-browser",
  "jiosaavn",
  "jamendo",
]);

export const getMediaQuality = async ({ source, id, uuid }) => {
  const params = {};
  if (source) params.source = source;
  if (id) params.id = id;
  if (uuid) params.uuid = uuid;

  assertProviderAllowed(source);
  const res = await sayaRequest("/v1/media/quality", { params, cache: true });
  return res?.data || res;
};

export const resolvePreview = async ({ source, id }) => {
  if (!source || !id) {
    throw new SayaApiError("source and id are required", { status: 400 });
  }

  assertProviderAllowed(source);

  if (source === "jiosaavn") {
    const stream = await resolveStream({ source: "jiosaavn", id });
    return {
      source,
      id: String(id),
      previewUrl: null,
      streamUrl: stream.streamUrl,
      playable: stream.playable,
      quality: stream.quality,
      mimeType: stream.mimeType,
      isPreview: false,
      track: stream.track,
    };
  }

  const res = await sayaRequest("/v1/media/preview", {
    params: { source, id },
    cache: false,
  });

  return {
    source,
    id: String(id),
    previewUrl: res?.data?.previewUrl || null,
    playable: Boolean(res?.data?.previewUrl),
    message: res?.data?.message || null,
    raw: res?.data,
  };
};

export const resolveStream = async ({ source, id, uuid }) => {
  const provider = String(source || "").toLowerCase();

  if (!provider) {
    throw new SayaApiError("source is required", { status: 400 });
  }

  if (!isProviderAllowed(provider)) {
    throw new SayaApiError(
      `Provider "${provider}" is not available in MelodyPlay`,
      { status: 410 },
    );
  }

  // Refuse archive streams that are commonly broken / untrusted catalogue
  if (provider === "archive") {
    // Still allow, but surface clearer errors when Saya has no playable file
  }

  if (provider === "jamendo") {
    if (!String(process.env.JAMENDO_CLIENT_ID || "").trim()) {
      throw new SayaApiError("Jamendo is not configured", { status: 503 });
    }
    const { jamendoRequest } = await import("./jamendo.client.js");
    const { mapJamendoTrack, normalizePlayableTrack } = await import(
      "./music.mapper.js"
    );
    const json = await jamendoRequest("/tracks/", {
      params: { id: String(id), audioformat: "mp32" },
    });
    const raw = Array.isArray(json?.results) ? json.results[0] : null;
    const mapped = normalizePlayableTrack(mapJamendoTrack(raw));
    if (!mapped?.audioUrl) {
      throw new SayaApiError("Jamendo stream unavailable", { status: 404 });
    }
    return {
      source: "jamendo",
      id: String(id),
      streamUrl: mapped.audioUrl,
      audioUrl: mapped.audioUrl,
      quality: "Jamendo Creative Commons full track",
      isPreview: false,
      previewDuration: null,
      mimeType: "audio/mpeg",
      playable: true,
      duration: mapped.duration,
      track: mapped,
    };
  }

  if (provider === "jiosaavn") {
    const res = await jiosaavnRequest(`/api/songs/${id}`, {
      cacheEnabled: true,
    });
    const raw = Array.isArray(res?.data) ? res.data[0] : res?.data;
    const mapped = normalizePlayableTrack(
      mapJioSaavnFullSong(raw, {
        pickBestDownloadUrl,
        extractArtistNames,
        extractImageUrl,
      }),
    );

    if (!mapped?.audioUrl) {
      throw new SayaApiError("No playable JioSaavn stream URL available", {
        status: 404,
      });
    }

    return {
      source: "jiosaavn",
      id: String(id),
      streamUrl: mapped.audioUrl,
      audioUrl: mapped.audioUrl,
      quality: mapped.quality || "JioSaavn full track (up to 320kbps)",
      isPreview: false,
      previewDuration: null,
      mimeType: "audio/mp4",
      playable: true,
      duration: mapped.duration,
      track: mapped,
    };
  }

  if (provider === "gaana") {
    throw new SayaApiError(
      "Gaana endpoints only provide official search links, not playable streams.",
      { status: 403 },
    );
  }

  if (!SUPPORTED_STREAM_SOURCES.has(provider)) {
    throw new SayaApiError(`Unsupported stream source: ${provider}`, {
      status: 400,
    });
  }

  if (provider === "apple") {
    const { track } = await getTrackDetails({ provider: "apple", id });
    try {
      const upgraded = await upgradeToFullTrack(track);
      if (upgraded?.audioUrl && !upgraded.isPreview) {
        return {
          source: "jiosaavn",
          id: upgraded.providerId,
          streamUrl: upgraded.audioUrl,
          audioUrl: upgraded.audioUrl,
          quality: "Full track via JioSaavn (upgraded from Apple preview)",
          isPreview: false,
          previewDuration: null,
          mimeType: "audio/mp4",
          playable: true,
          duration: upgraded.duration,
          track: upgraded,
          upgradedFrom: "apple",
        };
      }
    } catch {
      // fall through
    }

    if (!track?.audioUrl) {
      throw new SayaApiError("No Apple preview available", { status: 404 });
    }
    const previewTrack = withHonestPlaybackDuration(
      { ...track, audioUrl: track.audioUrl },
      { isPreview: true, previewDuration: 30 },
    );
    return {
      source: "apple",
      id: String(id),
      streamUrl: track.audioUrl,
      audioUrl: track.audioUrl,
      quality: "Apple/iTunes 30-second preview",
      isPreview: true,
      previewDuration: 30,
      duration: 30,
      mimeType: "audio/mpeg",
      playable: true,
      track: previewTrack,
    };
  }

  if (provider === "radio-browser") {
    const stationUuid = uuid || id;
    if (!stationUuid) {
      throw new SayaApiError("uuid is required for radio-browser", {
        status: 400,
      });
    }

    // Prefer direct station metadata stream URL when available via by-uuid
    try {
      const stationRes = await sayaRequest(
        "/v1/radio-browser/stations/by-uuid",
        { params: { uuids: stationUuid }, cache: true },
      );
      const station = Array.isArray(stationRes?.data)
        ? stationRes.data[0]
        : stationRes?.data?.[0] || stationRes?.data;
      const direct = station?.url_resolved || station?.url;
      if (direct) {
        return {
          source: "radio-browser",
          id: String(stationUuid),
          streamUrl: direct,
          audioUrl: direct,
          quality: station?.codec
            ? `Live radio (${station.codec} ${station.bitrate || ""}kbps)`
            : "Live radio stream",
          isPreview: false,
          isLive: true,
          mimeType: null,
          playable: true,
          title: station?.name,
        };
      }
    } catch {
      // fall through to media/stream
    }

    const res = await sayaRequest("/v1/media/stream", {
      params: { source: "radio-browser", uuid: stationUuid },
      cache: false,
    });

    const streamUrl = res?.data?.streamUrl || res?.data?.url || null;
    if (!streamUrl) {
      throw new SayaApiError("Radio stream not available", { status: 404 });
    }

    return {
      source: "radio-browser",
      id: String(stationUuid),
      streamUrl,
      audioUrl: streamUrl,
      quality: res?.data?.quality || "Live radio stream",
      isPreview: false,
      isLive: true,
      playable: true,
    };
  }

  // audius / archive via unified media/stream
  const params = { source: provider };
  if (id) params.id = id;
  if (uuid) params.uuid = uuid;

  // Pre-check Audius metadata so Songs.PK / untrusted rips are not advertised
  if (provider === "audius" && id) {
    try {
      const meta = await sayaRequest(`/v1/audius/tracks/${id}`, {
        cache: true,
      });
      const raw = meta?.data?.data || meta?.data || {};
      const probe = {
        provider: "audius",
        title: raw.title || raw.name,
        artist: raw.user?.name || raw.artist,
      };
      if (isUntrustedCatalogueTrack(probe)) {
        throw new SayaApiError(
          "This Audius upload uses an unverified legacy catalogue label (e.g. Songs.PK) and is blocked from MelodyPlay playback",
          { status: 403 },
        );
      }
    } catch (error) {
      if (error instanceof SayaApiError && error.status === 403) throw error;
      // Metadata miss — continue; stream endpoint remains source of truth
    }
  }

  let res;
  try {
    res = await sayaRequest("/v1/media/stream", {
      params,
      cache: false,
    });
  } catch (error) {
    const status = error?.status || 502;
    const message =
      provider === "archive"
        ? "Internet Archive stream unavailable (upstream error). MelodyPlay will not advertise this as a working full track."
        : error?.message || "Stream unavailable from provider";
    throw new SayaApiError(message, {
      status: status >= 500 ? 502 : status,
      details: error?.details || null,
    });
  }

  const streamUrl = res?.data?.streamUrl || null;
  const title = res?.data?.title || null;
  const artist = res?.data?.artist || null;

  if (
    isUntrustedCatalogueTrack({
      provider,
      title,
      artist,
    })
  ) {
    throw new SayaApiError(
      "Unverified legacy catalogue source blocked from MelodyPlay playback",
      { status: 403 },
    );
  }

  if (!streamUrl) {
    throw new SayaApiError(
      res?.data?.message ||
        (provider === "archive"
          ? "No playable file was found in this Internet Archive item."
          : "No legal open stream available"),
      { status: 404 },
    );
  }

  return {
    source: provider,
    id: String(id || uuid),
    streamUrl,
    audioUrl: streamUrl,
    quality: res?.data?.quality || null,
    title,
    artist,
    isPreview: false,
    playable: true,
    mimeType: provider === "audius" ? "audio/mpeg" : null,
  };
};

export const resolveArtwork = async ({ source, id, releaseId }) => {
  const params = {};
  if (source) params.source = source;
  if (id) params.id = id;
  if (releaseId) params.release = releaseId;

  const res = await sayaRequest("/v1/media/artwork", {
    params,
    cache: true,
  });
  return res?.data || res;
};
