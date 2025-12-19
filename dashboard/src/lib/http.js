const BACKEND_RUNTIME_UNAVAILABLE =
  "Backend runtime unavailable (InsForge). Please retry later.";

export async function fetchJson(url, { method, headers, retry } = {}) {
  return fetchJsonWithRetry({ url, method, headers, retry });
}

async function fetchJsonWithRetry({ url, method, headers, retry }) {
  const retryOptions = normalizeRetryOptions(retry, method);
  let attempt = 0;

  // attempt = 0 is the first retry delay after the initial failure.
  while (true) {
    try {
      return await fetchJsonOnce({ url, method, headers });
    } catch (e) {
      if (!shouldRetry({ err: e, attempt, retryOptions })) throw e;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

async function fetchJsonOnce({ url, method, headers }) {
  let res;
  try {
    res = await fetch(url, {
      method: method || "GET",
      headers: {
        ...(headers || {}),
      },
    });
  } catch (e) {
    const raw = e?.message || String(e);
    const msg = normalizeBackendErrorMessage(raw);
    const err = new Error(msg);
    err.cause = e;
    err.retryable = isRetryableMessage(raw);
    if (msg !== raw) err.originalMessage = raw;
    throw err;
  }

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_e) {}

  if (!res.ok) {
    const raw = data?.error || data?.message || `HTTP ${res.status}`;
    const msg = normalizeBackendErrorMessage(raw);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    err.retryable = isRetryableStatus(res.status) || isRetryableMessage(raw);
    if (msg !== raw) err.originalMessage = raw;
    throw err;
  }

  return data;
}

function normalizeBackendErrorMessage(message) {
  if (!isBackendRuntimeDownMessage(message)) return String(message || "Unknown error");
  return BACKEND_RUNTIME_UNAVAILABLE;
}

function isBackendRuntimeDownMessage(message) {
  const s = String(message || "").toLowerCase();
  if (!s) return false;
  if (s.includes("deno:") || s.includes("deno")) return true;
  if (s.includes("econnreset") || s.includes("econnrefused")) return true;
  if (s.includes("etimedout")) return true;
  if (s.includes("timeout") && s.includes("request")) return true;
  if (s.includes("upstream") && (s.includes("deno") || s.includes("connect")))
    return true;
  return false;
}

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableMessage(message) {
  const s = String(message || "").toLowerCase();
  if (!s) return false;
  if (isBackendRuntimeDownMessage(s)) return true;
  if (s.includes("econnreset") || s.includes("econnrefused")) return true;
  if (s.includes("etimedout") || s.includes("timeout")) return true;
  if (s.includes("networkerror") || s.includes("failed to fetch")) return true;
  if (s.includes("socket hang up") || s.includes("connection reset")) return true;
  return false;
}

function normalizeRetryOptions(retry, method) {
  const upperMethod = (method || "GET").toUpperCase();
  const defaultRetry =
    upperMethod === "GET"
      ? { maxRetries: 2, baseDelayMs: 300, maxDelayMs: 1500, jitterRatio: 0.2 }
      : { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0.0 };

  if (retry == null) return defaultRetry;
  if (retry === false) return { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0.0 };

  const maxRetries = clampInt(retry.maxRetries ?? defaultRetry.maxRetries, 0, 10);
  const baseDelayMs = clampInt(retry.baseDelayMs ?? defaultRetry.baseDelayMs, 50, 60_000);
  const maxDelayMs = clampInt(
    retry.maxDelayMs ?? defaultRetry.maxDelayMs,
    baseDelayMs,
    120_000
  );
  const jitterRatio =
    typeof retry.jitterRatio === "number"
      ? Math.max(0, Math.min(0.5, retry.jitterRatio))
      : defaultRetry.jitterRatio;
  return { maxRetries, baseDelayMs, maxDelayMs, jitterRatio };
}

function shouldRetry({ err, attempt, retryOptions }) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return false;
  if (attempt >= retryOptions.maxRetries) return false;
  return Boolean(err && err.retryable);
}

function computeRetryDelayMs({ retryOptions, attempt }) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return 0;
  const exp = retryOptions.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(retryOptions.maxDelayMs, exp);
  const jitter = capped * retryOptions.jitterRatio * Math.random();
  return Math.round(capped + jitter);
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
