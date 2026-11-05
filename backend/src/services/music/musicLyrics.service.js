import { SayaApiError } from "./saya.client.js";

/**
 * SayaMusicAPI currently has no dedicated lyrics / synchronized-lyrics endpoints
 * in the live /v1/endpoints registry (verified Phase 1).
 * JioSaavn search items expose hasLyrics boolean but not lyric text.
 */
export const getLyrics = async ({ provider, id, artist, title }) => {
  if (!provider && !artist && !title) {
    throw new SayaApiError("provider+id or artist+title required", {
      status: 400,
    });
  }

  return {
    available: false,
    synchronized: false,
    provider: provider || null,
    providerId: id || null,
    artist: artist || null,
    title: title || null,
    lyrics: null,
    lines: [],
    message:
      "Lyrics are not provided by SayaMusicAPI. No lyric endpoints are registered in /v1/endpoints.",
  };
};
