'use strict';

function createRequestId() {
  if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorCodeFromStatus(status) {
  if (typeof status !== 'number') return 'UNKNOWN_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  if (status >= 400) return 'CLIENT_ERROR';
  return null;
}

function createLogger({ functionName }) {
  const requestId = createRequestId();
  const startMs = Date.now();
  let upstreamStatus = null;
  let upstreamLatencyMs = null;

  function recordUpstream(status, latencyMs) {
    upstreamStatus = typeof status === 'number' ? status : null;
    upstreamLatencyMs = typeof latencyMs === 'number' ? latencyMs : null;
  }

  async function fetchWithUpstream(url, init) {
    const upstreamStart = Date.now();
    try {
      const res = await fetch(url, init);
      recordUpstream(res.status, Date.now() - upstreamStart);
      return res;
    } catch (err) {
      recordUpstream(null, Date.now() - upstreamStart);
      throw err;
    }
  }

  function log({ stage, status, errorCode, ...extra }) {
    const payload = {
      ...(extra || {}),
      request_id: requestId,
      function: functionName,
      stage: stage || 'response',
      status: typeof status === 'number' ? status : null,
      latency_ms: Date.now() - startMs,
      error_code: errorCode ?? errorCodeFromStatus(status),
      upstream_status: upstreamStatus ?? null,
      upstream_latency_ms: upstreamLatencyMs ?? null
    };
    console.log(JSON.stringify(payload));
  }

  return {
    requestId,
    log,
    fetch: fetchWithUpstream
  };
}

function getResponseStatus(response) {
  if (response && typeof response.status === 'number') return response.status;
  return null;
}

function withRequestLogging(functionName, handler) {
  return async function (request) {
    const logger = createLogger({ functionName });
    try {
      const response = await handler(request, logger);
      const status = getResponseStatus(response);
      logger.log({ stage: 'response', status });
      return response;
    } catch (err) {
      logger.log({ stage: 'exception', status: 500, errorCode: 'UNHANDLED_EXCEPTION' });
      throw err;
    }
  };
}

module.exports = {
  withRequestLogging,
  logSlowQuery
};

function logSlowQuery(logger, fields) {
  if (!logger || typeof logger.log !== 'function') return;
  const durationMs = Number(fields?.duration_ms ?? fields?.durationMs);
  if (!Number.isFinite(durationMs)) return;
  const thresholdMs = getSlowQueryThresholdMs();
  if (durationMs < thresholdMs) return;
  logger.log({
    stage: 'slow_query',
    status: 200,
    ...(fields || {}),
    duration_ms: Math.round(durationMs)
  });
}

function getSlowQueryThresholdMs() {
  const raw = readEnvValue('VIBESCORE_SLOW_QUERY_MS');
  if (raw == null || raw === '') return 2000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2000;
  if (n <= 0) return 0;
  return clampInt(n, 1, 60000);
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

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
