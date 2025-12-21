'use strict';

const { createClient } = require('@insforge/sdk');

function getAnonKey() {
  return process.env.VIBESCORE_INSFORGE_ANON_KEY || process.env.INSFORGE_ANON_KEY || '';
}

function getHttpTimeoutMs() {
  const raw = process.env.VIBESCORE_HTTP_TIMEOUT_MS;
  if (raw == null || raw === '') return 20_000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20_000;
  if (n <= 0) return 0;
  return clampInt(n, 1000, 120_000);
}

function createTimeoutFetch(baseFetch) {
  if (!baseFetch) return baseFetch;
  return async (input, init = {}) => {
    const timeoutMs = getHttpTimeoutMs();
    if (!timeoutMs) return baseFetch(input, init);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        const timeoutErr = new Error(`Request timeout after ${timeoutMs}ms`);
        timeoutErr.cause = err;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function createInsforgeClient({ baseUrl, accessToken } = {}) {
  if (!baseUrl) throw new Error('Missing baseUrl');
  const anonKey = getAnonKey();
  return createClient({
    baseUrl,
    anonKey: anonKey || undefined,
    edgeFunctionToken: accessToken || undefined,
    fetch: createTimeoutFetch(globalThis.fetch)
  });
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

module.exports = {
  createInsforgeClient
};
