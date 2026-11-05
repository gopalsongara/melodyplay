const DEFAULT_BASE_URL =
  process.env.SAYA_API_BASE_URL ||
  "https://sayamusicapi.sayaproject-mailflow.workers.dev";

const DEFAULT_TIMEOUT_MS = Number(process.env.SAYA_API_TIMEOUT_MS || 20000);
const MAX_RETRIES = Number(process.env.SAYA_API_RETRIES || 2);

const searchCache = new Map();
const CACHE_TTL_MS = Number(process.env.SAYA_SEARCH_CACHE_TTL_MS || 60_000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isUpstreamFailure = (payload) =>
  payload?.data &&
  typeof payload.data === "object" &&
  payload.data.upstreamOk === false;

export class SayaApiError extends Error {
  constructor(message, { status = 502, details = null } = {}) {
    super(message);
    this.name = "SayaApiError";
    this.status = status;
    this.details = details;
  }
}

const buildUrl = (path, params = {}) => {
  const url = new URL(path, DEFAULT_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url;
};

const getCached = (key) => {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return hit.value;
};

const setCached = (key, value) => {
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const sayaRequest = async (
  path,
  { params = {}, method = "GET", cache = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) => {
  const url = buildUrl(path, params);
  const cacheKey = `${method}:${url.toString()}`;

  if (cache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "spotify-clone-saya-client/1.0",
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        // Retry transient upstream errors
        if ([429, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw new SayaApiError(`SayaMusicAPI HTTP ${response.status}`, {
          status: response.status >= 500 ? 502 : response.status,
          details: text.slice(0, 500),
        });
      }

      const payload = await response.json();

      if (isUpstreamFailure(payload)) {
        const status = payload.data?.status || 502;
        if ([429, 502, 503, 504].includes(status) && attempt < MAX_RETRIES) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw new SayaApiError(
          payload.data?.message || "Upstream provider failure",
          {
            status: status === 429 ? 429 : 502,
            details: payload.data,
          },
        );
      }

      if (cache) setCached(cacheKey, payload);
      return payload;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (error.name === "AbortError") {
        lastError = new SayaApiError("SayaMusicAPI request timed out", {
          status: 504,
        });
      }

      if (
        lastError instanceof SayaApiError &&
        ![429, 502, 503, 504].includes(lastError.status)
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SayaApiError("SayaMusicAPI request failed");
};

export const getSayaBaseUrl = () => DEFAULT_BASE_URL;

export const clearSayaCache = () => searchCache.clear();
