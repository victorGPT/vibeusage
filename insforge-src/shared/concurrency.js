'use strict';

const LIMITERS = new Map();

function createConcurrencyGuard({
  name,
  envKey,
  defaultMax = 0,
  retryAfterEnvKey,
  defaultRetryAfterMs = 1000
}) {
  const maxInflight = readEnvInt(envKey, defaultMax);
  if (!Number.isFinite(maxInflight) || maxInflight <= 0) return null;
  const retryAfterMs = readEnvInt(retryAfterEnvKey, defaultRetryAfterMs);
  return getLimiter({ name, maxInflight, retryAfterMs });
}

function getLimiter({ name, maxInflight, retryAfterMs }) {
  const key = name || 'default';
  const existing = LIMITERS.get(key);
  if (existing && existing.maxInflight === maxInflight && existing.retryAfterMs === retryAfterMs) return existing;
  const limiter = createLimiter({ maxInflight, retryAfterMs });
  LIMITERS.set(key, limiter);
  return limiter;
}

function createLimiter({ maxInflight, retryAfterMs }) {
  let inflight = 0;

  function acquire() {
    if (inflight >= maxInflight) {
      const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(0, retryAfterMs) / 1000));
      return {
        ok: false,
        retryAfterMs,
        headers: {
          'Retry-After': String(retryAfterSeconds)
        }
      };
    }
    inflight += 1;
    return {
      ok: true,
      release() {
        inflight = Math.max(0, inflight - 1);
      }
    };
  }

  return {
    maxInflight,
    retryAfterMs,
    acquire
  };
}

function readEnvInt(key, fallback) {
  if (!key) return fallback;
  const raw = readEnvValue(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function readEnvValue(key) {
  try {
    if (typeof Deno !== 'undefined' && Deno?.env?.get) {
      const value = Deno.env.get(key);
      if (value !== undefined) return value;
    }
  } catch (_e) {}
  try {
    if (typeof process !== 'undefined' && process?.env) {
      return process.env[key];
    }
  } catch (_e) {}
  return null;
}

module.exports = {
  createConcurrencyGuard
};
