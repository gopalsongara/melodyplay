/** Public cloud default — survives laptop restart / Airtel Cloud / Render. */
export const JIOSAAVN_CLOUD_DEFAULT =
  "https://shnwazdev-jiosaavn-apii.vercel.app";

const isLocalUrl = (url = "") =>
  /localhost|127\.0\.0\.1/i.test(String(url));

/**
 * Read at call-time so dotenv / host env wins over import-time defaults.
 * In production, localhost is rejected — always use a public HTTPS sidecar.
 */
export const getJioSaavnBaseUrl = () => {
  const raw = String(process.env.JIOSAAVN_API_BASE_URL || "").trim();
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  if (isProd) {
    if (!raw || isLocalUrl(raw)) return JIOSAAVN_CLOUD_DEFAULT;
    return raw.replace(/\/$/, "");
  }

  if (!raw) return "http://localhost:3099";
  return raw.replace(/\/$/, "");
};

/** Serverless cold starts need longer budgets in production. */
const getTimeoutMs = () => {
  const fallback =
    String(process.env.NODE_ENV || "").toLowerCase() === "production"
      ? 35000
      : 20000;
  return Number(process.env.JIOSAAVN_API_TIMEOUT_MS || fallback);
};
const getMaxRetries = () => {
  const fallback =
    String(process.env.NODE_ENV || "").toLowerCase() === "production" ? 3 : 2;
  return Number(process.env.JIOSAAVN_API_RETRIES || fallback);
};
const getCacheTtlMs = () => Number(process.env.JIOSAAVN_CACHE_TTL_MS || 60_000);

const cache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class JioSaavnApiError extends Error {
  constructor(message, { status = 502, details = null } = {}) {
    super(message);
    this.name = "JioSaavnApiError";
    this.status = status;
    this.details = details;
  }
}

const buildUrl = (path, params = {}) => {
  const url = new URL(path, getJioSaavnBaseUrl());
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url;
};

const getCached = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + getCacheTtlMs() });
};

export const jiosaavnRequest = async (
  path,
  { params = {}, cacheEnabled = false, timeoutMs = getTimeoutMs() } = {},
) => {
  const url = buildUrl(path, params);
  const cacheKey = `GET:${url.toString()}`;
  const maxRetries = getMaxRetries();

  if (cacheEnabled) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "spotify-clone-jiosaavn-client/1.0",
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        if ([429, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        throw new JioSaavnApiError(`JioSaavn API HTTP ${response.status}`, {
          status: response.status >= 500 ? 502 : response.status,
          details: text.slice(0, 400),
        });
      }

      const payload = await response.json();

      if (payload?.success === false) {
        throw new JioSaavnApiError(payload.message || "JioSaavn API error", {
          status: 502,
          details: payload,
        });
      }

      if (cacheEnabled) setCached(cacheKey, payload);
      return payload;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;

      if (error.name === "AbortError") {
        lastError = new JioSaavnApiError("JioSaavn API request timed out", {
          status: 504,
        });
      }

      if (
        lastError instanceof JioSaavnApiError &&
        ![429, 502, 503, 504].includes(lastError.status)
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new JioSaavnApiError("JioSaavn API request failed");
};

/** Pick best available download URL (prefer 320kbps). */
export const pickBestDownloadUrl = (downloadUrl = []) => {
  if (!Array.isArray(downloadUrl) || !downloadUrl.length) {
    return { url: null, quality: null };
  }

  const preferred = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];
  for (const quality of preferred) {
    const hit = downloadUrl.find((d) => d?.quality === quality && d?.url);
    if (hit) return { url: hit.url, quality: hit.quality };
  }

  const first = downloadUrl.find((d) => d?.url);
  return { url: first?.url || null, quality: first?.quality || null };
};

export const extractArtistNames = (artists) => {
  if (!artists) return "Unknown Artist";
  if (typeof artists === "string" && artists.trim()) return artists.trim();

  const collect = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((a) => (typeof a === "string" ? a : a?.name))
      .filter(Boolean);
  };

  const names = [
    ...collect(artists.primary),
    ...collect(artists.featured),
    ...collect(artists.all),
  ];

  const unique = [...new Set(names)];
  return unique.length ? unique.join(", ") : "Unknown Artist";
};

export const extractImageUrl = (image) => {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (!Array.isArray(image)) return image?.url || null;

  const preferred = ["500x500", "150x150", "50x50"];
  for (const quality of preferred) {
    const hit = image.find((i) => i?.quality === quality && i?.url);
    if (hit) return hit.url;
  }
  return image.find((i) => i?.url)?.url || null;
};
