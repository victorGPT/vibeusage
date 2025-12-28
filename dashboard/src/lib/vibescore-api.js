import { createInsforgeClient } from "./insforge-client.js";
import { formatDateLocal } from "./date-range.js";
import {
  getMockUsageDaily,
  getMockUsageHourly,
  getMockUsageHeatmap,
  getMockUsageMonthly,
  getMockUsageModelBreakdown,
  getMockUsageSummary,
  isMockEnabled,
} from "./mock-data.js";

const BACKEND_RUNTIME_UNAVAILABLE =
  "Backend runtime unavailable (InsForge). Please retry later.";

const PATHS = {
  usageSummary: "vibescore-usage-summary",
  usageDaily: "vibescore-usage-daily",
  usageHourly: "vibescore-usage-hourly",
  usageMonthly: "vibescore-usage-monthly",
  usageHeatmap: "vibescore-usage-heatmap",
  usageModelBreakdown: "vibescore-usage-model-breakdown",
  linkCodeInit: "vibescore-link-code-init",
};

const FUNCTION_PREFIX = "/functions";
const LEGACY_FUNCTION_PREFIX = "/api/functions";

export async function probeBackend({ baseUrl, accessToken, signal } = {}) {
  const today = formatDateLocal(new Date());
  await requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageSummary,
    params: { from: today, to: today },
    fetchOptions: { cache: "no-store", signal },
    retry: false,
  });
  return { status: 200 };
}

export async function getUsageSummary({
  baseUrl,
  accessToken,
  from,
  to,
  source,
  model,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageSummary({ from, to, seed: accessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageSummary,
    params: { from, to, ...filterParams, ...tzParams },
  });
}

export async function getUsageModelBreakdown({
  baseUrl,
  accessToken,
  from,
  to,
  source,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageModelBreakdown({ from, to, seed: accessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageModelBreakdown,
    params: { from, to, ...filterParams, ...tzParams },
  });
}

export async function getUsageDaily({
  baseUrl,
  accessToken,
  from,
  to,
  source,
  model,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageDaily({ from, to, seed: accessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageDaily,
    params: { from, to, ...filterParams, ...tzParams },
  });
}

export async function getUsageHourly({
  baseUrl,
  accessToken,
  day,
  source,
  model,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageHourly({ day, seed: accessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageHourly,
    params: day ? { day, ...filterParams, ...tzParams } : { ...filterParams, ...tzParams },
  });
}

export async function getUsageMonthly({
  baseUrl,
  accessToken,
  months,
  to,
  source,
  model,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageMonthly({ months, to, seed: accessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageMonthly,
    params: {
      ...(months ? { months: String(months) } : {}),
      ...(to ? { to } : {}),
      ...filterParams,
      ...tzParams,
    },
  });
}

export async function getUsageHeatmap({
  baseUrl,
  accessToken,
  weeks,
  to,
  weekStartsOn,
  source,
  model,
  timeZone,
  tzOffsetMinutes,
}) {
  if (isMockEnabled()) {
    return getMockUsageHeatmap({
      weeks,
      to,
      weekStartsOn,
      seed: accessToken,
    });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken,
    slug: PATHS.usageHeatmap,
    params: {
      weeks: String(weeks),
      to,
      week_starts_on: weekStartsOn,
      ...filterParams,
      ...tzParams,
    },
  });
}

export async function requestInstallLinkCode({ baseUrl, accessToken } = {}) {
  if (isMockEnabled()) {
    return {
      link_code: "mock_link_code",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }
  return requestPostJson({
    baseUrl,
    accessToken,
    slug: PATHS.linkCodeInit,
    body: {},
  });
}

function buildTimeZoneParams({ timeZone, tzOffsetMinutes } = {}) {
  const params = {};
  const tz = typeof timeZone === "string" ? timeZone.trim() : "";
  if (tz) params.tz = tz;
  if (Number.isFinite(tzOffsetMinutes)) {
    params.tz_offset_minutes = String(Math.trunc(tzOffsetMinutes));
  }
  return params;
}

function buildFilterParams({ source, model } = {}) {
  const params = {};
  const normalizedSource = typeof source === "string" ? source.trim().toLowerCase() : "";
  if (normalizedSource) params.source = normalizedSource;
  const normalizedModel = typeof model === "string" ? model.trim() : "";
  if (normalizedModel) params.model = normalizedModel;
  return params;
}

async function requestJson({
  baseUrl,
  accessToken,
  slug,
  params,
  fetchOptions,
  errorPrefix,
  retry,
}) {
  const client = createInsforgeClient({ baseUrl, accessToken });
  const http = client.getHttpClient();
  const retryOptions = normalizeRetryOptions(retry, "GET");
  let attempt = 0;
  const { primaryPath, fallbackPath } = buildFunctionPaths(slug);

  while (true) {
    try {
      return await requestWithFallback({
        http,
        primaryPath,
        fallbackPath,
        params,
        fetchOptions,
      });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      const err = normalizeSdkError(e, errorPrefix);
      if (!shouldRetry({ err, attempt, retryOptions })) throw err;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

async function requestPostJson({
  baseUrl,
  accessToken,
  slug,
  body,
  fetchOptions,
  errorPrefix,
  retry,
}) {
  const client = createInsforgeClient({ baseUrl, accessToken });
  const http = client.getHttpClient();
  const retryOptions = normalizeRetryOptions(retry, "POST");
  let attempt = 0;
  const { primaryPath, fallbackPath } = buildFunctionPaths(slug);

  while (true) {
    try {
      return await requestWithFallbackPost({
        http,
        primaryPath,
        fallbackPath,
        body,
        fetchOptions,
      });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      const err = normalizeSdkError(e, errorPrefix);
      if (!shouldRetry({ err, attempt, retryOptions })) throw err;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function buildFunctionPaths(slug) {
  const normalized = normalizeFunctionSlug(slug);
  const primaryPath = `${normalizePrefix(FUNCTION_PREFIX)}/${normalized}`;
  const fallbackPath = `${normalizePrefix(LEGACY_FUNCTION_PREFIX)}/${normalized}`;
  return { primaryPath, fallbackPath };
}

function normalizeFunctionSlug(slug) {
  const raw = typeof slug === "string" ? slug.trim() : "";
  return raw.replace(/^\/+/, "");
}

function normalizePrefix(prefix) {
  const raw = typeof prefix === "string" ? prefix.trim() : "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function requestWithFallback({
  http,
  primaryPath,
  fallbackPath,
  params,
  fetchOptions,
}) {
  try {
    return await http.get(primaryPath, { params, ...(fetchOptions || {}) });
  } catch (err) {
    if (!shouldFallbackToLegacy(err, primaryPath)) throw err;
    return await http.get(fallbackPath, { params, ...(fetchOptions || {}) });
  }
}

async function requestWithFallbackPost({
  http,
  primaryPath,
  fallbackPath,
  body,
  fetchOptions,
}) {
  try {
    return await requestWithAuthRetryPost({
      http,
      path: primaryPath,
      body,
      fetchOptions,
    });
  } catch (err) {
    if (!shouldFallbackToLegacy(err, primaryPath)) throw err;
    return await requestWithAuthRetryPost({
      http,
      path: fallbackPath,
      body,
      fetchOptions,
    });
  }
}

async function requestWithAuthRetryPost({
  http,
  path,
  body,
  fetchOptions,
}) {
  return await http.post(path, body, { ...(fetchOptions || {}) });
}

function shouldFallbackToLegacy(error, primaryPath) {
  if (!primaryPath || !primaryPath.startsWith(`${normalizePrefix(FUNCTION_PREFIX)}/`)) {
    return false;
  }
  const status = error?.statusCode ?? error?.status;
  return status === 404;
}

function normalizeSdkError(error, errorPrefix) {
  const raw = error?.message || String(error || "Unknown error");
  const msg = normalizeBackendErrorMessage(raw);
  const err = new Error(errorPrefix ? `${errorPrefix}: ${msg}` : msg);
  err.cause = error;
  const status = error?.statusCode ?? error?.status;
  if (typeof status === "number") {
    err.status = status;
    err.statusCode = status;
  }
  err.retryable = isRetryableStatus(status) || isRetryableMessage(raw);
  if (msg !== raw) err.originalMessage = raw;
  if (error?.nextActions) err.nextActions = error.nextActions;
  if (error?.error) err.error = error.error;
  return err;
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
