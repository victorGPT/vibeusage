const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

export function getHttpTimeoutMs({ env } = {}) {
  const resolvedEnv = env ?? (typeof import.meta !== "undefined" ? import.meta.env : undefined);
  const raw = readEnvValue(resolvedEnv, [
    "VITE_VIBEUSAGE_HTTP_TIMEOUT_MS",
    "VITE_VIBESCORE_HTTP_TIMEOUT_MS",
  ]);
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
    const callerSignals = [];
    const initSignal = init.signal;
    if (initSignal) callerSignals.push(initSignal);
    const inputSignal = getInputSignal(input);
    if (inputSignal && inputSignal !== initSignal) callerSignals.push(inputSignal);
    const abortListeners = callerSignals.map((signal) => {
      const onAbort = () => controller.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) controller.abort();
      return () => signal.removeEventListener("abort", onAbort);
    });
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      const callerAborted = callerSignals.some((signal) => signal.aborted);
      if (controller.signal.aborted && !callerAborted) {
        const timeoutErr = new Error(`Client timeout after ${timeoutMs}ms`);
        timeoutErr.cause = err;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      for (const remove of abortListeners) remove();
    }
  };
}

function getInputSignal(input) {
  if (!input || typeof input !== "object") return null;
  const signal = input.signal;
  if (signal && typeof signal === "object") return signal;
  return null;
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function readEnvValue(env, keys) {
  if (!env || !keys?.length) return undefined;
  for (const key of keys) {
    const value = env?.[key];
    if (value != null && value !== "") return value;
  }
  return undefined;
}
