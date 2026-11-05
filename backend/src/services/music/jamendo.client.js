/**
 * Jamendo API v3 — Creative Commons full-track streams (authorized).
 * Requires JAMENDO_CLIENT_ID from https://developer.jamendo.com/
 */

const DEFAULT_BASE = "https://api.jamendo.com/v3.0";
const TIMEOUT_MS = Number(process.env.JAMENDO_TIMEOUT_MS || 12000);

export const isJamendoConfigured = () =>
  Boolean(String(process.env.JAMENDO_CLIENT_ID || "").trim());

export const jamendoRequest = async (path, { params = {} } = {}) => {
  const clientId = String(process.env.JAMENDO_CLIENT_ID || "").trim();
  if (!clientId) {
    const err = new Error("Jamendo not configured (set JAMENDO_CLIENT_ID)");
    err.status = 503;
    throw err;
  }

  const url = new URL(path.replace(/^\//, ""), `${DEFAULT_BASE}/`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    const json = await res.json();
    if (json?.headers?.status === "failed") {
      const err = new Error(
        json.headers.error_message || "Jamendo request failed",
      );
      err.status = 502;
      throw err;
    }
    return json;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
};

export const jamendoSearchTracks = async (query, { limit = 20 } = {}) => {
  if (!isJamendoConfigured()) return [];
  const json = await jamendoRequest("/tracks/", {
    params: {
      namesearch: query,
      limit: Math.min(Number(limit) || 20, 50),
      include: "musicinfo",
      audioformat: "mp32",
      order: "relevance",
    },
  });
  return Array.isArray(json?.results) ? json.results : [];
};
