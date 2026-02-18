import { clearSessionSoftExpired, markSessionSoftExpired } from "./auth-storage";
import { normalizeAccessToken, resolveAuthAccessToken } from "./auth-token";
import { formatDateLocal } from "./date-range";
import { insforgeAuthClient } from "./insforge-auth-client";
import { createInsforgeClient } from "./insforge-client";
import {
  getMockUsageDaily,
  getMockUsageHourly,
  getMockUsageHeatmap,
  getMockUsageMonthly,
  getMockUsageModelBreakdown,
  getMockUsageSummary,
  getMockProjectUsageSummary,
  getMockLeaderboard,
  isMockEnabled,
} from "./mock-data";

const BACKEND_RUNTIME_UNAVAILABLE = "Backend runtime unavailable (InsForge). Please retry later.";

const PATHS = {
  usageSummary: "vibeusage-usage-summary",
  usageDaily: "vibeusage-usage-daily",
  usageHourly: "vibeusage-usage-hourly",
  usageMonthly: "vibeusage-usage-monthly",
  usageHeatmap: "vibeusage-usage-heatmap",
  usageModelBreakdown: "vibeusage-usage-model-breakdown",
  projectUsageSummary: "vibeusage-project-usage-summary",
  leaderboard: "vibeusage-leaderboard",
  leaderboardSettings: "vibeusage-leaderboard-settings",
  leaderboardProfile: "vibeusage-leaderboard-profile",
  userStatus: "vibeusage-user-status",
  linkCodeInit: "vibeusage-link-code-init",
  publicViewStatus: "vibeusage-public-view-status",
  publicViewIssue: "vibeusage-public-view-issue",
  publicViewRevoke: "vibeusage-public-view-revoke",
  publicViewProfile: "vibeusage-public-view-profile",
};

const FUNCTION_PREFIX = "/functions";
const LEGACY_FUNCTION_PREFIX = "/api/functions";
const REQUEST_KIND = {
  business: "business",
  probe: "probe",
};
type AnyRecord = Record<string, any>;

let refreshInFlight: Promise<any> | null = null;

async function resolveAccessToken(accessToken: any) {
  return await resolveAuthAccessToken(accessToken);
}

export async function probeBackend({ baseUrl, accessToken, signal }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  const today = formatDateLocal(new Date());
  await requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.usageSummary,
    params: { from: today, to: today },
    fetchOptions: { cache: "no-store", signal },
    retry: false,
    requestKind: REQUEST_KIND.probe,
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
  rolling = false,
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageSummary({ from, to, seed: resolvedAccessToken, rolling });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  const rollingParams = rolling ? { rolling: "1" } : {};
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.usageSummary,
    params: { from, to, ...filterParams, ...tzParams, ...rollingParams },
  });
}

export async function getProjectUsageSummary({
  baseUrl,
  accessToken,
  from,
  to,
  source,
  limit,
  timeZone,
  tzOffsetMinutes,
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockProjectUsageSummary({ seed: resolvedAccessToken, limit });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source });
  const params: AnyRecord = { ...filterParams, ...tzParams };
  if (from) params.from = from;
  if (to) params.to = to;
  if (limit != null) params.limit = String(limit);
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.projectUsageSummary,
    params,
  });
}

export async function getLeaderboard({
  baseUrl,
  accessToken,
  period,
  metric,
  limit,
  offset,
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockLeaderboard({ seed: resolvedAccessToken, period, metric, limit, offset });
  }
  const rawPeriod = typeof period === "string" ? period : "week";
  const safePeriod = rawPeriod.trim().toLowerCase();
  const normalizedPeriod =
    safePeriod === "month" || safePeriod === "total" || safePeriod === "week" ? safePeriod : "week";
  const params: AnyRecord = { period: normalizedPeriod };
  if (metric) params.metric = String(metric);
  if (limit != null) params.limit = String(limit);
  if (offset != null) params.offset = String(offset);
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.leaderboard,
    params,
  });
}

export async function getLeaderboardSettings({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return { leaderboard_public: false, updated_at: null };
  }
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.leaderboardSettings,
  });
}

export async function setLeaderboardSettings({
  baseUrl,
  accessToken,
  leaderboardPublic,
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return { leaderboard_public: Boolean(leaderboardPublic), updated_at: new Date().toISOString() };
  }
  return requestPostJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.leaderboardSettings,
    body: { leaderboard_public: Boolean(leaderboardPublic) },
  });
}

export async function getLeaderboardProfile({
  baseUrl,
  accessToken,
  userId,
  period,
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    const mock = getMockLeaderboard({
      seed: resolvedAccessToken,
      period,
      metric: "all",
      limit: 250,
      offset: 0,
    });
    const entries = Array.isArray(mock?.entries) ? mock.entries : [];
    const match = entries.find((entry: any) => entry?.user_id === userId) || null;
    return {
      period: mock?.period ?? "week",
      from: mock?.from ?? null,
      to: mock?.to ?? null,
      generated_at: mock?.generated_at ?? new Date().toISOString(),
      entry: match
        ? {
            user_id: match.user_id ?? null,
            display_name: match.display_name ?? null,
            avatar_url: match.avatar_url ?? null,
            rank: match.rank ?? null,
            gpt_tokens: match.gpt_tokens ?? "0",
            claude_tokens: match.claude_tokens ?? "0",
            other_tokens: match.other_tokens ?? "0",
            total_tokens: match.total_tokens ?? "0",
          }
        : null,
    };
  }
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.leaderboardProfile,
    params: { user_id: String(userId || ""), period: String(period || "") },
  });
}

export async function getUserStatus({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    const now = new Date().toISOString();
    return {
      user_id: "mock-user",
      created_at: now,
      pro: {
        active: true,
        sources: ["mock"],
        expires_at: null,
        partial: false,
        as_of: now,
      },
      subscriptions: {
        partial: false,
        as_of: now,
        items: [
          {
            tool: "codex",
            provider: "openai",
            product: "chatgpt",
            plan_type: "pro",
            updated_at: now,
          },
          {
            tool: "claude",
            provider: "anthropic",
            product: "subscription",
            plan_type: "max",
            rate_limit_tier: "default_claude_max_5x",
            updated_at: now,
          },
        ],
      },
      install: {
        partial: false,
        as_of: now,
        has_active_device_token: false,
        has_active_device: false,
        active_device_tokens: 0,
        active_devices: 0,
        latest_token_activity_at: null,
        latest_device_seen_at: null,
      },
    };
  }
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.userStatus,
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
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageModelBreakdown({ from, to, seed: resolvedAccessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source });
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
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
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageDaily({ from, to, seed: resolvedAccessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
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
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageHourly({ day, seed: resolvedAccessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
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
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageMonthly({ months, to, seed: resolvedAccessToken });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
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
}: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return getMockUsageHeatmap({
      weeks,
      to,
      weekStartsOn,
      seed: resolvedAccessToken,
    });
  }
  const tzParams = buildTimeZoneParams({ timeZone, tzOffsetMinutes });
  const filterParams = buildFilterParams({ source, model });
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
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

export async function requestInstallLinkCode({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  if (isMockEnabled()) {
    return {
      link_code: "mock_link_code",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
  }
  return requestPostJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.linkCodeInit,
    body: {},
  });
}

export async function getPublicViewStatus({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.publicViewStatus,
  });
}

export async function getPublicViewProfile({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  return requestJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.publicViewProfile,
  });
}

export async function issuePublicViewToken({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  return requestPostJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.publicViewIssue,
    body: {},
  });
}

export async function revokePublicViewToken({ baseUrl, accessToken }: AnyRecord = {}) {
  const resolvedAccessToken = await resolveAccessToken(accessToken);
  return requestPostJson({
    baseUrl,
    accessToken: resolvedAccessToken,
    slug: PATHS.publicViewRevoke,
    body: {},
  });
}

function buildTimeZoneParams({ timeZone, tzOffsetMinutes }: AnyRecord = {}) {
  const params: AnyRecord = {};
  const tz = typeof timeZone === "string" ? timeZone.trim() : "";
  if (tz) params.tz = tz;
  if (Number.isFinite(tzOffsetMinutes)) {
    params.tz_offset_minutes = String(Math.trunc(tzOffsetMinutes));
  }
  return params;
}

function buildFilterParams({ source, model }: AnyRecord = {}) {
  const params: AnyRecord = {};
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
  requestKind = REQUEST_KIND.business,
  skipSessionExpiry = false,
  allowRefresh = true,
}: AnyRecord = {}) {
  let activeAccessToken = await resolveAccessToken(accessToken);
  let hadAccessToken = hasAccessTokenValue(activeAccessToken);
  let http = createInsforgeClient({
    baseUrl,
    accessToken: activeAccessToken ?? undefined,
  }).getHttpClient();
  const retryOptions = normalizeRetryOptions(retry, "GET");
  const normalizedRequestKind = skipSessionExpiry ? REQUEST_KIND.probe : requestKind;
  let attempt = 0;
  const { primaryPath, fallbackPath } = buildFunctionPaths(slug);

  while (true) {
    try {
      const result = await requestWithFallback({
        http,
        primaryPath,
        fallbackPath,
        params,
        fetchOptions,
      });
      clearSessionSoftExpiredIfNeeded({
        hadAccessToken,
        accessToken: activeAccessToken,
      });
      return result;
    } catch (e) {
      const errInput = e as any;
      if (errInput?.name === "AbortError") throw e;
      let err: any = null;
      const status = errInput?.statusCode ?? errInput?.status;
      if (
        allowRefresh &&
        shouldAttemptSessionRefresh({
          status,
          requestKind: normalizedRequestKind,
          hadAccessToken,
          accessToken: activeAccessToken,
        })
      ) {
        const refreshedSession = await refreshSessionOnce();
        const refreshedToken = refreshedSession?.accessToken ?? null;
        if (hasAccessTokenValue(refreshedToken)) {
          const retryClient = createInsforgeClient({
            baseUrl,
            accessToken: refreshedToken,
          });
          const retryHttp = retryClient.getHttpClient();
          activeAccessToken = refreshedToken;
          hadAccessToken = true;
          http = retryHttp;
          try {
            const retryResult = await requestWithFallback({
              http: retryHttp,
              primaryPath,
              fallbackPath,
              params,
              fetchOptions,
            });
            clearSessionSoftExpiredIfNeeded({
              hadAccessToken: true,
              accessToken: refreshedToken,
            });
            return retryResult;
          } catch (retryErr) {
            const retryStatus = (retryErr as any)?.statusCode ?? (retryErr as any)?.status;
            if (
              shouldMarkSessionSoftExpired({
                status: retryStatus,
                hadAccessToken: true,
                accessToken: refreshedToken,
                skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
              })
            ) {
              markSessionSoftExpired();
            }
            err = normalizeSdkError(retryErr, {
              errorPrefix,
              hadAccessToken: true,
              accessToken: refreshedToken,
              skipSessionExpiry: true,
            });
          }
        } else if (
          canSetSessionSoftExpired({
            hadAccessToken,
            accessToken: activeAccessToken,
            skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
          })
        ) {
          markSessionSoftExpired();
        }
        err ??= normalizeSdkError(errInput, {
          errorPrefix,
          hadAccessToken,
          accessToken: activeAccessToken,
          skipSessionExpiry: true,
        });
      }
      err ??= normalizeSdkError(errInput, {
        errorPrefix,
        hadAccessToken,
        accessToken: activeAccessToken,
        skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
      });
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
  requestKind = REQUEST_KIND.business,
  skipSessionExpiry = false,
  allowRefresh = true,
}: AnyRecord = {}) {
  let activeAccessToken = await resolveAccessToken(accessToken);
  let hadAccessToken = hasAccessTokenValue(activeAccessToken);
  let http = createInsforgeClient({
    baseUrl,
    accessToken: activeAccessToken ?? undefined,
  }).getHttpClient();
  const retryOptions = normalizeRetryOptions(retry, "POST");
  const normalizedRequestKind = skipSessionExpiry ? REQUEST_KIND.probe : requestKind;
  let attempt = 0;
  const { primaryPath, fallbackPath } = buildFunctionPaths(slug);

  while (true) {
    try {
      const result = await requestWithFallbackPost({
        http,
        primaryPath,
        fallbackPath,
        body,
        fetchOptions,
      });
      clearSessionSoftExpiredIfNeeded({
        hadAccessToken,
        accessToken: activeAccessToken,
      });
      return result;
    } catch (e) {
      const errInput = e as any;
      if (errInput?.name === "AbortError") throw e;
      let err: any = null;
      const status = errInput?.statusCode ?? errInput?.status;
      if (
        allowRefresh &&
        shouldAttemptSessionRefresh({
          status,
          requestKind: normalizedRequestKind,
          hadAccessToken,
          accessToken: activeAccessToken,
        })
      ) {
        const refreshedSession = await refreshSessionOnce();
        const refreshedToken = refreshedSession?.accessToken ?? null;
        if (hasAccessTokenValue(refreshedToken)) {
          const retryClient = createInsforgeClient({
            baseUrl,
            accessToken: refreshedToken,
          });
          const retryHttp = retryClient.getHttpClient();
          activeAccessToken = refreshedToken;
          hadAccessToken = true;
          http = retryHttp;
          try {
            const retryResult = await requestWithFallbackPost({
              http: retryHttp,
              primaryPath,
              fallbackPath,
              body,
              fetchOptions,
            });
            clearSessionSoftExpiredIfNeeded({
              hadAccessToken: true,
              accessToken: refreshedToken,
            });
            return retryResult;
          } catch (retryErr) {
            const retryStatus = (retryErr as any)?.statusCode ?? (retryErr as any)?.status;
            if (
              shouldMarkSessionSoftExpired({
                status: retryStatus,
                hadAccessToken: true,
                accessToken: refreshedToken,
                skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
              })
            ) {
              markSessionSoftExpired();
            }
            err = normalizeSdkError(retryErr, {
              errorPrefix,
              hadAccessToken: true,
              accessToken: refreshedToken,
              skipSessionExpiry: true,
            });
          }
        } else if (
          canSetSessionSoftExpired({
            hadAccessToken,
            accessToken: activeAccessToken,
            skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
          })
        ) {
          markSessionSoftExpired();
        }
        err ??= normalizeSdkError(errInput, {
          errorPrefix,
          hadAccessToken,
          accessToken: activeAccessToken,
          skipSessionExpiry: true,
        });
      }
      err ??= normalizeSdkError(errInput, {
        errorPrefix,
        hadAccessToken,
        accessToken: activeAccessToken,
        skipSessionExpiry: normalizedRequestKind === REQUEST_KIND.probe,
      });
      if (!shouldRetry({ err, attempt, retryOptions })) throw err;
      const delayMs = computeRetryDelayMs({ retryOptions, attempt });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function buildFunctionPaths(slug: any) {
  const normalized = normalizeFunctionSlug(slug);
  const primaryPath = `${normalizePrefix(FUNCTION_PREFIX)}/${normalized}`;
  const fallbackPath = `${normalizePrefix(LEGACY_FUNCTION_PREFIX)}/${normalized}`;
  return { primaryPath, fallbackPath };
}

function normalizeFunctionSlug(slug: any) {
  const raw = typeof slug === "string" ? slug.trim() : "";
  return raw.replace(/^\/+/, "");
}

function normalizePrefix(prefix: any) {
  const raw = typeof prefix === "string" ? prefix.trim() : "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

async function requestWithFallback({
  http,
  primaryPath,
  fallbackPath,
  params,
  fetchOptions,
}: AnyRecord = {}) {
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
}: AnyRecord = {}) {
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

async function requestWithAuthRetryPost({ http, path, body, fetchOptions }: AnyRecord = {}) {
  return await http.post(path, body, { ...(fetchOptions || {}) });
}

function shouldFallbackToLegacy(error: any, primaryPath: any) {
  if (!primaryPath || !primaryPath.startsWith(`${normalizePrefix(FUNCTION_PREFIX)}/`)) {
    return false;
  }
  const status = error?.statusCode ?? error?.status;
  return status === 404;
}

function normalizeSdkError(
  error: any,
  { errorPrefix, hadAccessToken, accessToken, skipSessionExpiry }: AnyRecord = {},
) {
  // InsForgeError may have an empty `message` but a meaningful `error` field.
  const rawMessage = typeof error?.message === "string" ? error.message.trim() : "";
  const rawError = typeof error?.error === "string" ? error.error.trim() : "";
  const raw = rawMessage || rawError || String(error || "Unknown error");
  const msg = normalizeBackendErrorMessage(raw);
  const err: any = new Error(errorPrefix ? `${errorPrefix}: ${msg}` : msg);
  err.cause = error;
  const status = error?.statusCode ?? error?.status;
  if (
    shouldMarkSessionSoftExpired({
      status,
      hadAccessToken,
      accessToken,
      skipSessionExpiry,
    })
  ) {
    markSessionSoftExpired();
  }
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

function canSetSessionSoftExpired({
  hadAccessToken,
  accessToken,
  skipSessionExpiry,
}: AnyRecord = {}) {
  if (skipSessionExpiry) return false;
  if (!hadAccessToken) return false;
  if (!hasAccessTokenValue(accessToken)) return false;
  return isJwtAccessToken(accessToken);
}

function shouldMarkSessionSoftExpired({
  status,
  hadAccessToken,
  accessToken,
  skipSessionExpiry,
}: AnyRecord = {}) {
  if (status !== 401) return false;
  return canSetSessionSoftExpired({ hadAccessToken, accessToken, skipSessionExpiry });
}

function shouldClearSessionSoftExpired({ hadAccessToken, accessToken }: AnyRecord = {}) {
  return canSetSessionSoftExpired({ hadAccessToken, accessToken });
}

function clearSessionSoftExpiredIfNeeded({ hadAccessToken, accessToken }: AnyRecord = {}) {
  if (!shouldClearSessionSoftExpired({ hadAccessToken, accessToken })) return;
  clearSessionSoftExpired();
}

function normalizeBackendErrorMessage(message: any) {
  if (!isBackendRuntimeDownMessage(message)) return String(message || "Unknown error");
  return BACKEND_RUNTIME_UNAVAILABLE;
}

function isBackendRuntimeDownMessage(message: any) {
  const s = String(message || "").toLowerCase();
  if (!s) return false;
  if (s.includes("deno:") || s.includes("deno")) return true;
  if (s.includes("econnreset") || s.includes("econnrefused")) return true;
  if (s.includes("etimedout")) return true;
  if (s.includes("timeout") && s.includes("request")) return true;
  if (s.includes("upstream") && (s.includes("deno") || s.includes("connect"))) return true;
  return false;
}

function shouldAttemptSessionRefresh({
  status,
  requestKind,
  hadAccessToken,
  accessToken,
}: AnyRecord = {}) {
  if (status !== 401) return false;
  if (requestKind !== REQUEST_KIND.business) return false;
  return canSetSessionSoftExpired({ hadAccessToken, accessToken });
}

async function refreshSessionOnce() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = insforgeAuthClient.auth
    .getCurrentSession()
    .then(({ data }: AnyRecord) => data?.session ?? null)
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function isRetryableStatus(status: any) {
  return status === 502 || status === 503 || status === 504;
}

function isRetryableMessage(message: any) {
  const s = String(message || "").toLowerCase();
  if (!s) return false;
  if (isBackendRuntimeDownMessage(s)) return true;
  if (s.includes("econnreset") || s.includes("econnrefused")) return true;
  if (s.includes("etimedout") || s.includes("timeout")) return true;
  if (s.includes("networkerror") || s.includes("failed to fetch")) return true;
  if (s.includes("socket hang up") || s.includes("connection reset")) return true;
  return false;
}

function normalizeRetryOptions(retry: any, method: any) {
  const upperMethod = (method || "GET").toUpperCase();
  const defaultRetry =
    upperMethod === "GET"
      ? { maxRetries: 2, baseDelayMs: 300, maxDelayMs: 1500, jitterRatio: 0.2 }
      : { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0.0 };

  if (retry == null) return defaultRetry;
  if (retry === false) return { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0.0 };

  const maxRetries = clampInt(retry.maxRetries ?? defaultRetry.maxRetries, 0, 10);
  const baseDelayMs = clampInt(retry.baseDelayMs ?? defaultRetry.baseDelayMs, 50, 60_000);
  const maxDelayMs = clampInt(retry.maxDelayMs ?? defaultRetry.maxDelayMs, baseDelayMs, 120_000);
  const jitterRatio =
    typeof retry.jitterRatio === "number"
      ? Math.max(0, Math.min(0.5, retry.jitterRatio))
      : defaultRetry.jitterRatio;
  return { maxRetries, baseDelayMs, maxDelayMs, jitterRatio };
}

function hasAccessTokenValue(accessToken: any) {
  return Boolean(normalizeAccessToken(accessToken));
}

function isJwtAccessToken(accessToken: any) {
  if (!hasAccessTokenValue(accessToken)) return false;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return false;
  return parts.every((part: string) => /^[A-Za-z0-9_-]+$/.test(part));
}

function shouldRetry({ err, attempt, retryOptions }: AnyRecord = {}) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return false;
  if (attempt >= retryOptions.maxRetries) return false;
  return Boolean(err && err.retryable);
}

function computeRetryDelayMs({ retryOptions, attempt }: AnyRecord = {}) {
  if (!retryOptions || retryOptions.maxRetries <= 0) return 0;
  const exp = retryOptions.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(retryOptions.maxDelayMs, exp);
  const jitter = capped * retryOptions.jitterRatio * Math.random();
  return Math.round(capped + jitter);
}

function clampInt(value: any, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function sleep(ms: number) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
