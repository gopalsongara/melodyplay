/**
 * Central API / socket base URLs for LAN + localhost + production.
 * Priority: VITE_* env override → same hostname as the page (dev) → relative /api (prod).
 * Production Vercel→Render must set VITE_API_BASE_URL to an absolute HTTPS API.
 */
const trimSlash = (url: string) => url.replace(/\/+$/, "");

const isLocalhostUrl = (url: string) =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

export const getApiBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv?.trim()) {
    const value = trimSlash(fromEnv.trim());
    if (import.meta.env.PROD && isLocalhostUrl(value)) {
      console.error(
        "[apiConfig] VITE_API_BASE_URL must not point at localhost in production",
      );
    }
    return value;
  }

  if (import.meta.env.MODE !== "development") {
    // Same-origin only works if API is reverse-proxied; Vercel needs VITE_API_BASE_URL
    return "/api";
  }

  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `http://${host}:8080/api`;
};

/** Socket.IO server origin (no /api suffix). */
export const getSocketBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (fromEnv?.trim()) {
    const value = trimSlash(fromEnv.trim());
    if (import.meta.env.PROD && isLocalhostUrl(value)) {
      console.error(
        "[apiConfig] VITE_SOCKET_URL must not point at localhost in production",
      );
    }
    return value;
  }

  if (import.meta.env.MODE !== "development") {
    return "/";
  }

  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `http://${host}:8080`;
};
