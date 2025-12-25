const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

export function getHttpTimeoutMs({ env } = {}) {
  const resolvedEnv = env ?? (typeof import.meta !== "undefined" ? import.meta.env : undefined);
  const raw = resolvedEnv?.VITE_VIBESCORE_HTTP_TIMEOUT_MS;
  if (raw == null || raw === "") return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_TIMEOUT_MS;
  if (n <= 0) return 0;
  return clampInt(n, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
}

export function createTimeoutFetch(baseFetch, { env } = {}) {
  if (!baseFetch) return baseFetch;
  return async (input, init = {}) => {
    const timeoutMs = getHttpTimeoutMs({ env });
    if (!timeoutMs) return baseFetch(input, init);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const signal = init.signal;
    let removeAbortListener = null;
    if (signal) {
      const onAbort = () => controller.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener("abort", onAbort);
      if (signal.aborted) controller.abort();
    }
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted && !(signal && signal.aborted)) {
        const timeoutErr = new Error(`Client timeout after ${timeoutMs}ms`);
        timeoutErr.cause = err;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (removeAbortListener) removeAbortListener();
    }
  };
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
