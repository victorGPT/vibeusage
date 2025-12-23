'use strict';

const { createInsforgeClient } = require('./insforge-client');

async function signInWithPassword({ baseUrl, email, password }) {
  const client = createInsforgeClient({ baseUrl });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw normalizeSdkError(error, 'Sign-in failed');

  const accessToken = data?.accessToken;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Sign-in failed: missing accessToken');
  }

  return accessToken;
}

async function issueDeviceToken({ baseUrl, accessToken, deviceName, platform = 'macos' }) {
  const data = await invokeFunction({
    baseUrl,
    accessToken,
    slug: 'vibescore-device-token-issue',
    method: 'POST',
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

async function ingestHourly({ baseUrl, deviceToken, hourly }) {
  const data = await invokeFunctionWithRetry({
    baseUrl,
    accessToken: deviceToken,
    slug: 'vibescore-ingest',
    method: 'POST',
    body: { hourly },
    errorPrefix: 'Ingest failed',
    retry: { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 }
  });

  return {
    inserted: Number(data?.inserted || 0),
    skipped: Number(data?.skipped || 0)
  };
}

async function syncHeartbeat({ baseUrl, deviceToken }) {
  const data = await invokeFunction({
    baseUrl,
    accessToken: deviceToken,
    slug: 'vibescore-sync-ping',
    method: 'POST',
    body: {},
    errorPrefix: 'Sync heartbeat failed'
  });

  return {
    updated: Boolean(data?.updated),
    last_sync_at: typeof data?.last_sync_at === 'string' ? data.last_sync_at : null,
    min_interval_minutes: Number(data?.min_interval_minutes || 0)
  };
}

module.exports = {
  signInWithPassword,
  issueDeviceToken,
  ingestHourly,
  syncHeartbeat
};

async function invokeFunction({ baseUrl, accessToken, slug, method, body, errorPrefix }) {
  const client = createInsforgeClient({ baseUrl, accessToken });
  const { data, error } = await client.functions.invoke(slug, { method, body });
  if (error) throw normalizeSdkError(error, errorPrefix);
  return data;
}

async function invokeFunctionWithRetry({ baseUrl, accessToken, slug, method, body, errorPrefix, retry }) {
  const retryOptions = normalizeRetryOptions(retry);
  let attempt = 0;

  while (true) {
    try {
      return await invokeFunction({ baseUrl, accessToken, slug, method, body, errorPrefix });
    } catch (e) {
      if (!shouldRetry({ err: e, attempt, retryOptions })) throw e;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt, err: e });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function normalizeSdkError(error, errorPrefix) {
  const raw = extractSdkErrorMessage(error);
  const msg = normalizeBackendErrorMessage(raw);
  const err = new Error(errorPrefix ? `${errorPrefix}: ${msg}` : msg);
  const status = error?.statusCode ?? error?.status;
  const code = typeof error?.error === 'string' ? error.error.trim() : '';
  if (typeof status === 'number') err.status = status;
  if (code) err.code = code;
  err.retryable = isRetryableStatus(status) || isRetryableMessage(raw);
  if (msg !== raw) err.originalMessage = raw;
  if (error?.nextActions) err.nextActions = error.nextActions;
  return err;
}

function extractSdkErrorMessage(error) {
  if (!error) return 'Unknown error';
  const message = typeof error.message === 'string' ? error.message.trim() : '';
  const code = typeof error.error === 'string' ? error.error.trim() : '';
  if (message && message !== 'InsForgeError') return message;
  if (code && code !== 'REQUEST_FAILED') return code;
  if (message) return message;
  if (code) return code;
  return String(error);
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
  return status === 429 || status === 502 || status === 503 || status === 504;
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
