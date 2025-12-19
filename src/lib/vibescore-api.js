'use strict';

const { parseRetryAfterMs } = require('./upload-throttle');

async function signInWithPassword({ baseUrl, email, password }) {
  const url = new URL('/api/auth/sessions', baseUrl).toString();
  const { data } = await requestJson({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email, password },
    errorPrefix: 'Sign-in failed'
  });

  const accessToken = data?.accessToken;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Sign-in failed: missing accessToken');
  }

  return accessToken;
}

async function issueDeviceToken({ baseUrl, accessToken, deviceName, platform = 'macos' }) {
  const url = new URL('/functions/vibescore-device-token-issue', baseUrl).toString();
  const { data } = await requestJson({
    url,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: { device_name: deviceName, platform },
    errorPrefix: 'Device token issue failed'
  });

  const token = data?.token;
  const deviceId = data?.device_id;
  if (typeof token !== 'string' || token.length === 0) throw new Error('Device token issue failed: missing token');
  if (typeof deviceId !== 'string' || deviceId.length === 0) {
    throw new Error('Device token issue failed: missing device_id');
  }

  return { token, deviceId };
}

async function ingestEvents({ baseUrl, deviceToken, events }) {
  const url = new URL('/functions/vibescore-ingest', baseUrl).toString();
  const { data } = await requestJson({
    url,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      'Content-Type': 'application/json'
    },
    body: { events },
    errorPrefix: 'Ingest failed',
    retry: { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 }
  });

  return {
    inserted: Number(data?.inserted || 0),
    skipped: Number(data?.skipped || 0)
  };
}

module.exports = {
  signInWithPassword,
  issueDeviceToken,
  ingestEvents
};

async function requestJson({ url, method, headers, body, errorPrefix, retry }) {
  return requestJsonWithRetry({ url, method, headers, body, errorPrefix, retry });
}

async function requestJsonWithRetry({ url, method, headers, body, errorPrefix, retry }) {
  const retryOptions = normalizeRetryOptions(retry);
  let attempt = 0;

  // attempt = 0 is the first retry delay after the initial failure.
  // maxRetries=0 means "no retries" and behaves like a single attempt.
  while (true) {
    try {
      return await requestJsonOnce({ url, method, headers, body, errorPrefix });
    } catch (e) {
      if (!shouldRetry({ err: e, attempt, retryOptions })) throw e;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt, err: e });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

async function requestJsonOnce({ url, method, headers, body, errorPrefix }) {
  let res;
  try {
    res = await fetch(url, {
      method: method || 'GET',
      headers: {
        ...(headers || {})
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
  } catch (e) {
    const raw = e?.message || String(e);
    const msg = normalizeBackendErrorMessage(raw);
    const err = new Error(errorPrefix ? `${errorPrefix}: ${msg}` : msg);
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
    const err = new Error(errorPrefix ? `${errorPrefix}: ${msg}` : msg);
    err.status = res.status;
    err.data = data;
    err.retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'));
    err.retryable = isRetryableStatus(res.status) || isRetryableMessage(raw);
    if (msg !== raw) err.originalMessage = raw;
    throw err;
  }

  return { res, data };
}

function normalizeBackendErrorMessage(message) {
  if (!isBackendRuntimeDownMessage(message)) return String(message || 'Unknown error');
  return 'Backend runtime unavailable (InsForge). Please retry later.';
}

function isBackendRuntimeDownMessage(message) {
  const s = String(message || '').toLowerCase();
  if (!s) return false;
  if (s.includes('deno:') || s.includes('deno')) return true;
  if (s.includes('econnreset') || s.includes('econnrefused')) return true;
  if (s.includes('etimedout')) return true;
  if (s.includes('timeout') && s.includes('request')) return true;
  if (s.includes('upstream') && (s.includes('deno') || s.includes('connect'))) return true;
  return false;
}

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableMessage(message) {
  const s = String(message || '').toLowerCase();
  if (!s) return false;
  if (isBackendRuntimeDownMessage(s)) return true;
  if (s.includes('econnreset') || s.includes('econnrefused')) return true;
  if (s.includes('etimedout') || s.includes('timeout')) return true;
  if (s.includes('networkerror') || s.includes('failed to fetch')) return true;
  if (s.includes('socket hang up') || s.includes('connection reset')) return true;
  return false;
}

function normalizeRetryOptions(retry) {
  if (!retry) {
    return { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0.0 };
  }
  const maxRetries = clampInt(retry.maxRetries, 0, 10);
  const baseDelayMs = clampInt(retry.baseDelayMs ?? 300, 50, 60_000);
  const maxDelayMs = clampInt(retry.maxDelayMs ?? baseDelayMs * 4, baseDelayMs, 120_000);
  const jitterRatio = typeof retry.jitterRatio === 'number' ? Math.max(0, Math.min(0.5, retry.jitterRatio)) : 0.2;
  return { maxRetries, baseDelayMs, maxDelayMs, jitterRatio };
}

function shouldRetry({ err, attempt, retryOptions }) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return false;
  if (attempt >= retryOptions.maxRetries) return false;
  return Boolean(err && err.retryable);
}

function computeRetryDelayMs({ retryOptions, attempt, err }) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return 0;
  const exp = retryOptions.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(retryOptions.maxDelayMs, exp);
  const jitter = capped * retryOptions.jitterRatio * Math.random();
  const backoff = Math.round(capped + jitter);
  const retryAfter = typeof err?.retryAfterMs === 'number' ? err.retryAfterMs : 0;
  return Math.max(backoff, retryAfter || 0);
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
