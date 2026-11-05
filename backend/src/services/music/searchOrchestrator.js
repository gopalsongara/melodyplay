/**
 * Parallel provider search orchestration with timeout, cache, isolation,
 * retryable backoff, and a simple circuit breaker.
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.SEARCH_PROVIDER_TIMEOUT_MS || 8000);
const CACHE_TTL_MS = Number(process.env.SEARCH_QUERY_CACHE_TTL_MS || 45_000);
const MAX_RETRIES = Number(process.env.SEARCH_PROVIDER_RETRIES || 1);
const CIRCUIT_FAIL_THRESHOLD = Number(process.env.SEARCH_CIRCUIT_FAILS || 4);
const CIRCUIT_COOLDOWN_MS = Number(process.env.SEARCH_CIRCUIT_COOLDOWN_MS || 60_000);

const cache = new Map();
const inflight = new Map();
/** @type {Map<string, { failures: number, openUntil: number }>} */
const circuits = new Map();

export const getCachedSearch = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

export const setCachedSearch = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const clearSearchCache = () => {
  cache.clear();
  inflight.clear();
};

export const resetCircuits = () => circuits.clear();

export const getProviderHealth = () => {
  const now = Date.now();
  return Object.fromEntries(
    [...circuits.entries()].map(([name, state]) => [
      name,
      {
        failures: state.failures,
        open: state.openUntil > now,
        openUntil: state.openUntil || null,
      },
    ]),
  );
};

const isCircuitOpen = (name) => {
  const state = circuits.get(name);
  if (!state) return false;
  if (state.openUntil && Date.now() < state.openUntil) return true;
  if (state.openUntil && Date.now() >= state.openUntil) {
    // half-open: allow one attempt
    state.openUntil = 0;
    state.failures = Math.max(0, state.failures - 1);
  }
  return false;
};

const recordSuccess = (name) => {
  circuits.set(name, { failures: 0, openUntil: 0 });
};

const recordFailure = (name) => {
  const prev = circuits.get(name) || { failures: 0, openUntil: 0 };
  const failures = prev.failures + 1;
  const openUntil =
    failures >= CIRCUIT_FAIL_THRESHOLD ? Date.now() + CIRCUIT_COOLDOWN_MS : 0;
  circuits.set(name, { failures, openUntil });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRetryable = (error) => {
  const status = error?.status || error?.statusCode;
  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("fetch failed") || msg.includes("econnreset");
};

const withTimeout = async (promise, timeoutMs, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`${label} timed out after ${timeoutMs}ms`);
          err.status = 504;
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const runWithRetry = async (task, timeoutMs) => {
  const name = task.name || "provider";
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await withTimeout(
        Promise.resolve().then(task.run),
        timeoutMs,
        name,
      );
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

/**
 * Run independent provider tasks in parallel.
 * A single failure never rejects the whole batch.
 */
export const runProviderTasks = async (
  tasks = [],
  { timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) => {
  const settled = await Promise.all(
    tasks.map(async (task) => {
      const name = task.name || "provider";
      const started = Date.now();

      if (isCircuitOpen(name)) {
        return {
          provider: name,
          ok: false,
          ms: 0,
          error: `circuit open for ${name}`,
          status: 503,
          circuitOpen: true,
        };
      }

      try {
        const data = await runWithRetry(task, timeoutMs);
        recordSuccess(name);
        return {
          provider: name,
          ok: true,
          ms: Date.now() - started,
          data,
        };
      } catch (error) {
        recordFailure(name);
        return {
          provider: name,
          ok: false,
          ms: Date.now() - started,
          error: error.message || String(error),
          status: error.status || 502,
        };
      }
    }),
  );

  return {
    results: settled.filter((s) => s.ok),
    errors: settled.filter((s) => !s.ok),
    timing: Object.fromEntries(settled.map((s) => [s.provider, s.ms])),
    providerStatus: Object.fromEntries(
      settled.map((s) => [
        s.provider,
        s.ok
          ? { ok: true, ms: s.ms }
          : {
              ok: false,
              ms: s.ms,
              error: s.error,
              status: s.status,
              circuitOpen: Boolean(s.circuitOpen),
            },
      ]),
    ),
  };
};

/**
 * Deduplicate identical concurrent search requests.
 */
export const dedupeInflight = async (key, factory) => {
  const cached = getCachedSearch(key);
  if (cached) return { ...cached, cacheHit: true };

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const pending = Promise.resolve()
    .then(factory)
    .then((value) => {
      setCachedSearch(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, pending);
  return pending;
};
