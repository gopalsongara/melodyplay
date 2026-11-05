/**
 * Resolve allowed browser origins for Express CORS + Socket.IO.
 * Uses CORS_ORIGIN (comma-separated) plus safe localhost / private-LAN defaults.
 */
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://10.252.52.85:3000",
];

/** Private LAN / loopback origins for local device testing (any port). */
const LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export const getAllowedOrigins = () => {
  const fromEnv = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const single =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.VERCEL_FRONTEND_URL ||
    "";

  const extras = [single, ...fromEnv]
    .flatMap((o) => String(o).split(","))
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ORIGINS, ...extras]));
};

export const isOriginAllowed = (origin) => {
  if (!origin) return true; // non-browser / same-origin tools
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  // Dev convenience: any private LAN IP hitting Vite on any port
  if (process.env.NODE_ENV !== "production" && LAN_ORIGIN_RE.test(origin)) {
    return true;
  }
  return false;
};

export const corsOriginCallback = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    console.warn(`[CORS] blocked origin: ${origin}`);
    callback(null, false);
  }
};
