/**
 * Lightweight in-memory rate limiter (no extra dependency).
 * Suitable for single-instance Render; replace with Redis for multi-instance.
 */

const buckets = new Map();

const prune = (key, windowMs) => {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry) return;
  entry.hits = entry.hits.filter((t) => now - t < windowMs);
  if (!entry.hits.length) buckets.delete(key);
};

export const createRateLimiter = ({
  windowMs = 60_000,
  max = 120,
  keyPrefix = "rl",
  message = "Too many requests — slow down and try again",
} = {}) => {
  return (req, res, next) => {
    const ip =
      req.ip ||
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    prune(key, windowMs);

    let entry = buckets.get(key);
    if (!entry) {
      entry = { hits: [] };
      buckets.set(key, entry);
    }
    entry.hits.push(now);

    const remaining = Math.max(0, max - entry.hits.length);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (entry.hits.length > max) {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message,
      });
    }
    next();
  };
};

/** Discovery/search — public and relatively expensive */
export const musicDiscoveryLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_MUSIC_MAX || 90),
  keyPrefix: "music",
  message: "Too many music requests — please wait a moment",
});

/** Auth'd library writes */
export const libraryWriteLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_LIBRARY_MAX || 60),
  keyPrefix: "library",
  message: "Too many library updates — please wait a moment",
});

/** Test helper */
export const __resetRateLimitBuckets = () => buckets.clear();
