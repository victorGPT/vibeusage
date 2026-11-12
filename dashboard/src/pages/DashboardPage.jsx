import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap";
import { useProjectUsageSummary } from "../hooks/use-project-usage-summary";
import { useRecentUsageData } from "../hooks/use-recent-usage-data";
import { useTrendData } from "../hooks/use-trend-data";
import { useUsageData } from "../hooks/use-usage-data";
import { useUsageModelBreakdown } from "../hooks/use-usage-model-breakdown";
import {
  isAccessTokenReady,
  normalizeAccessToken,
  resolveAuthAccessToken,
} from "../lib/auth-token";
import { copy } from "../lib/copy";
import { getAppVersion } from "../lib/app-version";
import { getRangeForPeriod } from "../lib/date-range";
import { trimLeadingZeroMonths } from "../lib/details";
import { selectRollingUsageForDisplay } from "../lib/dashboard-period-bindings";
import { formatUsdCurrency, toDisplayNumber, toFiniteNumber } from "../lib/format";
import { shouldShowInstallCard } from "../lib/install-status";
import { getMockNow, isMockEnabled } from "../lib/mock-data";
import { buildFleetData, resolveModelDisplayName } from "../lib/model-breakdown";
import { safeWriteClipboard, safeWriteClipboardImage } from "../lib/safe-browser";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode";
import {
  formatTimeZoneShortLabel,
  getBrowserTimeZone,
  getBrowserTimeZoneOffsetMinutes,
  getLocalDayKey,
} from "../lib/timezone";
import {
  getLeaderboard,
  getPublicVisibility,
  setPublicVisibility,
  getUserStatus,
  getPublicViewProfile,
  requestInstallLinkCode,
} from "../lib/vibeusage-api";
import { Heading } from "../ui/2049/base/Heading";
import { Label } from "../ui/2049/base/Label";
import { PageFooter } from "../ui/2049/base/PageFooter";
import { DailyTable } from "../ui/2049/blocks/DailyTable";
import { subscriptionLabels } from "../ui/2049/blocks/derive";
import { DotHeatmap } from "../ui/2049/blocks/DotHeatmap";
import { IdentityBar } from "../ui/2049/blocks/IdentityBar";
import { Models } from "../ui/2049/blocks/Models";
import { Projects } from "../ui/2049/blocks/Projects";
import { RankRail } from "../ui/2049/blocks/RankRail";
import { Readout } from "../ui/2049/blocks/Readout";
import { periodLabel } from "../ui/2049/blocks/shared";
import { StateScreen } from "../ui/2049/blocks/StateScreen";
import { TopNav } from "../ui/2049/blocks/TopNav";
import { Trend } from "../ui/2049/blocks/Trend";
import { CostAnalysisModal } from "../ui/matrix-a/components/CostAnalysisModal.jsx";
import { KeyboardCheatsheet } from "../ui/matrix-a/components/KeyboardCheatsheet.jsx";
import { Button } from "../ui/shadcn/button";
import { useGlobalKeybinds } from "../hooks/use-global-keybinds";

const DETAILS_PAGED_PERIODS = new Set(["day", "total"]);

function hasUsageValue(value, level) {
  if (typeof level === "number" && level > 0) return true;
  if (typeof value === "bigint") return value > 0n;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^[0-9]+$/.test(trimmed)) {
      try {
        return BigInt(trimmed) > 0n;
      } catch (_e) {
        return false;
      }
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric > 0;
  }
  return false;
}

function getBillableTotal(row) {
  if (!row) return null;
  return row?.billable_total_tokens ?? row?.total_tokens;
}

function getHeatmapValue(cell) {
  if (!cell) return null;
  return cell?.billable_total_tokens ?? cell?.value ?? cell?.total_tokens;
}

function isProductionHost(hostname) {
  if (!hostname) return false;
  return hostname === "www.vibeusage.cc";
}

function isForceInstallEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get("force_install") || "").toLowerCase();
  if (raw !== "1" && raw !== "true") return false;
  return !isProductionHost(window.location.hostname);
}

function mainScreen({
  publicViewInvalid,
  showExpiredGate,
  usageError,
  shouldShowInstall,
  usageLoading,
  hasSummary,
  showEmpty,
}) {
  if (publicViewInvalid) return "invalid";
  if (showExpiredGate) return "expired";
  if (usageError) return "error";
  if (shouldShowInstall) return "install";
  if (usageLoading && !hasSummary) return "loading";
  if (showEmpty) return "empty";
  return "readout";
}

export function DashboardPage({
  baseUrl,
  auth,
  currentIdentity,
  signedIn,
  sessionSoftExpired,
  signOut,
  publicMode = false,
  publicToken = null,
  signInUrl = "/sign-in",
}) {
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState(null);
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState(null);
  const [linkCodeLoading, setLinkCodeLoading] = useState(false);
  const [linkCodeError, setLinkCodeError] = useState(null);
  const [linkCodeExpiryTick, setLinkCodeExpiryTick] = useState(0);
  const [linkCodeRefreshToken, setLinkCodeRefreshToken] = useState(0);
  const [publicViewEnabled, setPublicViewEnabled] = useState(false);
  const [publicViewToken, setPublicViewToken] = useState(null);
  const [publicViewLoading, setPublicViewLoading] = useState(false);
  const [publicViewActionLoading, setPublicViewActionLoading] = useState(false);
  const [publicViewCopied, setPublicViewCopied] = useState(false);
  const [publicProfileName, setPublicProfileName] = useState(null);
  const [publicProfileAvatarUrl, setPublicProfileAvatarUrl] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [rankBoard, setRankBoard] = useState(null);
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const forceInstall = useMemo(() => isForceInstallEnabled(), []);
  const [isCapturing, setIsCapturing] = useState(false);
  const mockEnabled = isMockEnabled();
  const authTokenAllowed = signedIn && !sessionSoftExpired;
  const authAccessToken = useMemo(() => {
    if (!authTokenAllowed) return null;
    if (typeof auth === "function") return auth;
    if (typeof auth === "string") return auth;
    if (auth && typeof auth === "object") return auth;
    return null;
  }, [auth, authTokenAllowed]);
  const effectiveAuthToken = authTokenAllowed ? authAccessToken : null;
  const accessToken = publicMode ? normalizeAccessToken(publicToken) : effectiveAuthToken;
  const accessEnabled = signedIn || mockEnabled || publicMode;
  const authTokenReady = authTokenAllowed && isAccessTokenReady(effectiveAuthToken);
  const guestAllowed = signedIn && sessionSoftExpired && !publicMode;

  useEffect(() => {
    if (!signedIn || mockEnabled) {
      setLinkCode(null);
      setLinkCodeExpiresAt(null);
      setLinkCodeLoading(false);
      setLinkCodeError(null);
      return;
    }
    if (publicMode) return;
    if (!authTokenReady) {
      setLinkCode(null);
      setLinkCodeExpiresAt(null);
      setLinkCodeLoading(false);
      setLinkCodeError(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const resetLinkCode = () => {
      setLinkCode(null);
      setLinkCodeExpiresAt(null);
      setLinkCodeLoading(false);
      setLinkCodeError(null);
    };
    setLinkCodeLoading(true);
    setLinkCodeError(null);
    (async () => {
      let resolvedToken = null;
      try {
        resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
      } catch (_err) {
        resolvedToken = null;
      }
      if (!active) return;
      if (!resolvedToken) {
        resetLinkCode();
        return;
      }
      try {
        const data = await requestInstallLinkCode({
          baseUrl,
          accessToken: resolvedToken,
          signal: controller.signal,
        });
        if (!active) return;
        setLinkCode(typeof data?.link_code === "string" ? data.link_code : null);
        setLinkCodeExpiresAt(typeof data?.expires_at === "string" ? data.expires_at : null);
      } catch (err) {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        if (!active) return;
        setLinkCode(null);
        setLinkCodeExpiresAt(null);
        setLinkCodeError(err?.message || "Failed to load link code");
      } finally {
        if (!active) return;
        setLinkCodeLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    baseUrl,
    mockEnabled,
    signedIn,
    publicMode,
    authTokenReady,
    effectiveAuthToken,
    linkCodeRefreshToken,
  ]);

  useEffect(() => {
    if (!signedIn || mockEnabled || publicMode) {
      setPublicViewEnabled(false);
      setPublicViewToken(null);
      setPublicViewLoading(false);
      setPublicViewActionLoading(false);
      setPublicViewCopied(false);
      return;
    }
    if (!authTokenReady) {
      setPublicViewEnabled(false);
      setPublicViewToken(null);
      setPublicViewLoading(false);
      setPublicViewActionLoading(false);
      setPublicViewCopied(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPublicViewLoading(true);
    (async () => {
      let resolvedToken = null;
      try {
        resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
      } catch (_err) {
        resolvedToken = null;
      }
      if (!active) return;
      if (!resolvedToken) {
        setPublicViewEnabled(false);
        setPublicViewToken(null);
        setPublicViewLoading(false);
        return;
      }
      try {
        const data = await getPublicVisibility({
          baseUrl,
          accessToken: resolvedToken,
        });
        if (!active) return;
        const enabled = Boolean(data?.enabled);
        setPublicViewEnabled(enabled);
        setPublicViewToken(data?.share_token || null);
      } catch (_err) {
        if (!active) return;
        setPublicViewEnabled(false);
        setPublicViewToken(null);
      } finally {
        if (!active) return;
        setPublicViewLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [baseUrl, mockEnabled, signedIn, publicMode, authTokenReady, effectiveAuthToken]);

  useEffect(() => {
    if (!publicMode) {
      setPublicProfileName(null);
      setPublicProfileAvatarUrl(null);
      return;
    }
    if (!publicToken) {
      setPublicProfileName(null);
      setPublicProfileAvatarUrl(null);
      return;
    }
    setPublicProfileName(null);
    setPublicProfileAvatarUrl(null);
    let active = true;
    const controller = new AbortController();
    getPublicViewProfile({ baseUrl, accessToken: publicToken, signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setPublicProfileName(typeof data?.display_name === "string" ? data.display_name : null);
        setPublicProfileAvatarUrl(typeof data?.avatar_url === "string" ? data.avatar_url : null);
      })
      .catch(() => {
        if (!active) return;
        setPublicProfileName(null);
        setPublicProfileAvatarUrl(null);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [baseUrl, publicMode, publicToken]);

  useEffect(() => {
    if (!signedIn || mockEnabled || publicMode) {
      setUserStatus(null);
      return;
    }
    if (!authTokenReady) {
      setUserStatus(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    (async () => {
      let resolvedToken = null;
      try {
        resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
      } catch (_err) {
        resolvedToken = null;
      }
      if (!active) return;
      if (!resolvedToken) {
        setUserStatus(null);
        return;
      }
      try {
        const data = await getUserStatus({
          baseUrl,
          accessToken: resolvedToken,
          signal: controller.signal,
        });
        if (!active) return;
        setUserStatus(data && typeof data === "object" ? data : null);
      } catch (_err) {
        if (!active) return;
        setUserStatus(null);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [authTokenReady, baseUrl, effectiveAuthToken, mockEnabled, publicMode, signedIn]);

  const linkCodeExpired = useMemo(() => {
    if (!linkCodeExpiresAt) return false;
    const ts = Date.parse(linkCodeExpiresAt);
    if (!Number.isFinite(ts)) return false;
    const now = linkCodeExpiryTick || Date.now();
    return ts <= now;
  }, [linkCodeExpiresAt, linkCodeExpiryTick]);

  useEffect(() => {
    if (!signedIn || mockEnabled || publicMode) return;
    if (!linkCodeExpiresAt || !linkCodeExpired) return;
    if (linkCodeLoading) return;
    setLinkCode(null);
    setLinkCodeExpiresAt(null);
    setLinkCodeError(null);
    setLinkCodeRefreshToken((value) => value + 1);
  }, [linkCodeExpired, linkCodeExpiresAt, linkCodeLoading, mockEnabled, signedIn]);

  useEffect(() => {
    if (!linkCodeExpiresAt || publicMode) return;
    const ts = Date.parse(linkCodeExpiresAt);
    if (!Number.isFinite(ts)) return;
    const now = Date.now();
    setLinkCodeExpiryTick(now);
    if (ts <= now) return;
    const timeoutId = window.setTimeout(() => setLinkCodeExpiryTick(Date.now()), ts - now);
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      setLinkCodeExpiryTick(Date.now());
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    window.addEventListener("focus", handleVisibilityChange);
    return () => {
      window.clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [linkCodeExpiresAt]);

  // ponytail: one page of 100 ranks. When my rank is past 100 the entry ahead is not in it, so
  // RankRail hides To-pass; a second request at offset rank-4 would bring it back.
  useEffect(() => {
    if (publicMode || (!authTokenReady && !mockEnabled)) {
      setRankBoard(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    (async () => {
      let resolvedToken = null;
      try {
        resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
      } catch (_err) {
        resolvedToken = null;
      }
      if (!active) return;
      if (!resolvedToken && !mockEnabled) {
        setRankBoard(null);
        return;
      }
      try {
        const data = await getLeaderboard({
          baseUrl,
          accessToken: resolvedToken,
          period: "week",
          limit: 100,
          offset: 0,
          signal: controller.signal,
        });
        if (!active) return;
        setRankBoard(data && typeof data === "object" ? data : null);
      } catch (_err) {
        if (!active) return;
        setRankBoard(null);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [authTokenReady, baseUrl, effectiveAuthToken, mockEnabled, publicMode]);

  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const tzOffsetMinutes = useMemo(() => getBrowserTimeZoneOffsetMinutes(), []);
  const mockNow = useMemo(() => getMockNow(), []);
  const cacheKey = publicMode ? null : auth?.userId || auth?.email || null;
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const transitionSelectedPeriod = useCallback((nextPeriod) => {
    startTransition(() => {
      setSelectedPeriod(nextPeriod);
    });
  }, []);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const period = screenshotMode ? "total" : selectedPeriod;
  const range = useMemo(
    () =>
      getRangeForPeriod(period, {
        timeZone,
        offsetMinutes: tzOffsetMinutes,
        now: mockNow,
      }),
    [mockNow, period, timeZone, tzOffsetMinutes],
  );
  const from = range.from;
  const to = range.to;
  const weekRange = useMemo(
    () =>
      getRangeForPeriod("week", {
        timeZone,
        offsetMinutes: tzOffsetMinutes,
        now: mockNow,
      }),
    [mockNow, timeZone, tzOffsetMinutes],
  );
  const timeZoneShortLabel = useMemo(
    () => formatTimeZoneShortLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes],
  );
  const timeZoneRangeLabel = useMemo(
    () => `Local time (${timeZoneShortLabel})`,
    [timeZoneShortLabel],
  );
  const trendTimeZone = timeZone;
  const trendTzOffsetMinutes = tzOffsetMinutes;
  const todayKey = useMemo(
    () =>
      getLocalDayKey({
        timeZone,
        offsetMinutes: tzOffsetMinutes,
        date: mockNow || new Date(),
      }),
    [mockNow, timeZone, tzOffsetMinutes],
  );

  const {
    summary,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageData({
    baseUrl,
    accessToken,
    guestAllowed,
    from,
    to,
    includeDaily: period !== "total",
    cacheKey,
    timeZone,
    tzOffsetMinutes,
    now: mockNow,
  });

  const { rolling: recentRolling, refresh: refreshRecentUsage } = useRecentUsageData({
    baseUrl,
    accessToken,
    guestAllowed,
    cacheKey,
    timeZone,
    tzOffsetMinutes,
    now: mockNow,
  });

  const { breakdown: modelBreakdown, refresh: refreshModelBreakdown } = useUsageModelBreakdown({
    baseUrl,
    accessToken,
    guestAllowed,
    from,
    to,
    cacheKey,
    timeZone,
    tzOffsetMinutes,
  });

  const [projectUsageLimit, setProjectUsageLimit] = useState(3);
  const { entries: projectUsageEntries } = useProjectUsageSummary({
    baseUrl,
    accessToken,
    guestAllowed,
    limit: projectUsageLimit,
    allTime: true,
    from,
    to,
    timeZone,
    tzOffsetMinutes,
  });

  const { rows: trendRows, refresh: refreshTrend } = useTrendData({
    baseUrl,
    accessToken,
    guestAllowed,
    period,
    from,
    to,
    months: 24,
    cacheKey,
    timeZone: trendTimeZone,
    tzOffsetMinutes: trendTzOffsetMinutes,
    now: mockNow,
  });

  const {
    range: heatmapRange,
    daily: heatmapDaily,
    heatmap,
    loading: heatmapLoading,
    error: heatmapError,
    refresh: refreshHeatmap,
  } = useActivityHeatmap({
    baseUrl,
    accessToken,
    guestAllowed,
    weeks: 52,
    cacheKey,
    timeZone,
    tzOffsetMinutes,
    now: mockNow,
  });

  const detailsDateKey = useMemo(() => {
    if (period === "day") return "hour";
    if (period === "total") return "month";
    return "day";
  }, [period]);
  const detailsRows = useMemo(() => {
    if (period === "day") {
      return Array.isArray(trendRows) ? trendRows.filter((row) => row?.hour && !row?.future) : [];
    }
    if (period === "total") {
      const rows = Array.isArray(trendRows)
        ? trendRows.filter((row) => row?.month && !row?.future)
        : [];
      return trimLeadingZeroMonths(rows);
    }
    return Array.isArray(trendRows) ? trendRows.filter((row) => row?.day && !row?.future) : [];
  }, [period, trendRows]);
  const trendRowsForDisplay = useMemo(() => {
    if (period === "day") {
      return Array.isArray(trendRows) ? trendRows.filter((row) => row?.hour) : [];
    }
    return trendRows;
  }, [period, trendRows]);

  const activeDays = useMemo(() => {
    if (!signedIn && !mockEnabled && !publicMode) return 0;
    const serverActive = Number(heatmap?.active_days);
    if (Number.isFinite(serverActive)) return serverActive;

    let count = 0;
    const seen = new Set();
    const considerDay = (day, value, level) => {
      if (typeof day !== "string" || !day) return;
      if (seen.has(day)) return;
      if (!hasUsageValue(value, level)) return;
      seen.add(day);
      count += 1;
    };

    if (Array.isArray(heatmapDaily)) {
      for (const row of heatmapDaily) {
        considerDay(row?.day, getBillableTotal(row));
      }
    }

    const weeks = Array.isArray(heatmap?.weeks) ? heatmap.weeks : [];
    for (const week of weeks) {
      for (const cell of Array.isArray(week) ? week : []) {
        const value = getHeatmapValue(cell);
        considerDay(cell?.day, value, cell?.level);
      }
    }

    return count;
  }, [signedIn, mockEnabled, heatmap?.active_days, heatmap?.weeks, heatmapDaily]);

  const refreshAll = useCallback(() => {
    refreshUsage();
    refreshRecentUsage();
    refreshHeatmap();
    refreshTrend();
    refreshModelBreakdown();
  }, [refreshHeatmap, refreshModelBreakdown, refreshRecentUsage, refreshTrend, refreshUsage]);

  const rollingUsage = useMemo(
    () => selectRollingUsageForDisplay({ recentRolling }),
    [recentRolling],
  );
  const publicViewInvalid = useMemo(() => {
    if (!publicMode || !usageError) return false;
    const status =
      typeof usageError === "object" && usageError
        ? (usageError?.status ?? usageError?.statusCode)
        : null;
    if (status === 401) return true;
    const message =
      typeof usageError === "string" ? usageError : String(usageError?.message || usageError || "");
    return /unauthorized|invalid|token|revoked|401/i.test(message);
  }, [publicMode, usageError]);
  const identityRawName = useMemo(() => {
    if (typeof currentIdentity?.displayName !== "string") return "";
    return currentIdentity.displayName.trim();
  }, [currentIdentity?.displayName]);
  const publicIdentityName = useMemo(() => {
    if (typeof publicProfileName !== "string") return "";
    return publicProfileName.trim();
  }, [publicProfileName]);
  const identityPending = !publicMode && signedIn && currentIdentity === undefined;

  const identityLabel = useMemo(() => {
    if (!identityRawName || identityRawName.includes("@")) {
      return copy("dashboard.identity.fallback");
    }
    return identityRawName;
  }, [identityRawName]);

  const identityHandle = useMemo(() => {
    return identityLabel.replace(/[^a-zA-Z0-9._-]/g, "_");
  }, [identityLabel]);

  const identityDisplayName = useMemo(() => {
    if (publicMode) {
      return publicIdentityName || copy("dashboard.identity.fallback");
    }
    if (identityPending) {
      return copy("shared.placeholder.short");
    }
    return identityHandle;
  }, [identityHandle, identityPending, publicIdentityName, publicMode]);
  const identityStartDate = useMemo(() => {
    let earliest = null;

    const considerDay = (day) => {
      if (typeof day !== "string" || !day) return;
      if (!earliest || day < earliest) earliest = day;
    };

    if (Array.isArray(heatmapDaily)) {
      for (const row of heatmapDaily) {
        if (!row?.day) continue;
        if (!hasUsageValue(getBillableTotal(row))) continue;
        considerDay(row.day);
      }
    }

    const weeks = Array.isArray(heatmap?.weeks) ? heatmap.weeks : [];
    for (const week of weeks) {
      for (const cell of Array.isArray(week) ? week : []) {
        if (!cell?.day) continue;
        const value = getHeatmapValue(cell);
        const level = cell?.level;
        if (!hasUsageValue(value, level)) continue;
        considerDay(cell.day);
      }
    }

    return earliest;
  }, [heatmap?.weeks, heatmapDaily]);
  const identitySubscriptions = useMemo(
    () => (publicMode ? [] : subscriptionLabels(userStatus?.subscriptions?.items)),
    [publicMode, userStatus],
  );

  const summaryTotalTokens = getBillableTotal(summary);
  const placeholderShort = copy("shared.placeholder.short");
  const agentSummary = useMemo(() => {
    const sources = Array.isArray(modelBreakdown?.sources) ? modelBreakdown.sources : [];
    let topSource = null;
    let topSourceTokens = 0;

    for (const source of sources) {
      const tokens = toFiniteNumber(
        source?.totals?.billable_total_tokens ?? source?.totals?.total_tokens,
      );
      if (!Number.isFinite(tokens) || tokens <= 0) continue;
      if (tokens > topSourceTokens) {
        topSourceTokens = tokens;
        topSource = source;
      }
    }

    let agentName = placeholderShort;
    let modelName = placeholderShort;
    let modelPercent = "0.0";

    if (topSource && topSourceTokens > 0) {
      agentName = topSource?.source ? String(topSource.source).toUpperCase() : placeholderShort;
      const models = Array.isArray(topSource?.models) ? topSource.models : [];
      let topModelTokens = 0;
      for (const model of models) {
        const tokens = toFiniteNumber(
          model?.totals?.billable_total_tokens ?? model?.totals?.total_tokens,
        );
        if (!Number.isFinite(tokens) || tokens <= 0) continue;
        if (tokens > topModelTokens) {
          topModelTokens = tokens;
          modelName = resolveModelDisplayName(model, placeholderShort);
        }
      }
      if (topModelTokens > 0) {
        modelPercent = ((topModelTokens / topSourceTokens) * 100).toFixed(1);
      }
    }

    return { agentName, modelName, modelPercent };
  }, [modelBreakdown, placeholderShort]);
  const displayTotalTokens = toDisplayNumber(summaryTotalTokens);
  const twitterTotalTokens = displayTotalTokens === "-" ? placeholderShort : displayTotalTokens;
  const screenshotTwitterText = copy("dashboard.screenshot.twitter_text", {
    total_tokens: twitterTotalTokens,
    agent_name: agentSummary.agentName,
    model_name: agentSummary.modelName,
    model_percent: agentSummary.modelPercent,
  });
  const screenshotTwitterUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const intentUrl = new URL("https://twitter.com/intent/tweet");
    intentUrl.searchParams.set("text", screenshotTwitterText);
    return intentUrl.toString();
  }, [screenshotTwitterText]);
  const captureScreenshotBlob = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const waitForHeatmapLatest = async () => {
      const maxWaitMs = 2000;
      const start = performance.now();
      while (performance.now() - start < maxWaitMs) {
        const el = document.querySelector("[data-heatmap-scroll='true']");
        if (!el) return;
        if (el.dataset.latestMonthReady === "true") return;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };
    const root = document.querySelector("#root") || document.body;
    const docEl = document.documentElement;
    const { scrollWidth, scrollHeight } = document.documentElement;
    const backgroundColor = getComputedStyle(docEl).getPropertyValue("--color-background").trim();
    docEl?.classList.add("screenshot-capture");
    document.body?.classList.add("screenshot-capture");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitForHeatmapLatest();
    try {
      const { toBlob, toPng } = await import("html-to-image");
      const blob = await toBlob(root, {
        backgroundColor,
        pixelRatio: 2,
        cacheBust: true,
        width: scrollWidth,
        height: scrollHeight,
        style: {
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
        },
        filter: (node) =>
          !(node instanceof HTMLElement) || node.dataset?.screenshotExclude !== "true",
      });
      if (blob) return blob;
      const dataUrl = await toPng(root, {
        backgroundColor,
        pixelRatio: 2,
        cacheBust: true,
        width: scrollWidth,
        height: scrollHeight,
        style: {
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
        },
        filter: (node) =>
          !(node instanceof HTMLElement) || node.dataset?.screenshotExclude !== "true",
      });
      if (!dataUrl) return null;
      const response = await fetch(dataUrl);
      return await response.blob();
    } finally {
      docEl?.classList.remove("screenshot-capture");
      document.body?.classList.remove("screenshot-capture");
    }
  }, []);
  const handleShareToX = useCallback(async () => {
    if (typeof window === "undefined" || isCapturing) return;
    setIsCapturing(true);
    const userAgent = navigator?.userAgent || "";
    const isIOS = /iP(hone|od|ad)/i.test(userAgent);
    const isSafari =
      /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(userAgent);
    const canCopyImage =
      typeof navigator !== "undefined" &&
      Boolean(navigator.clipboard?.write) &&
      typeof window !== "undefined" &&
      Boolean(window.ClipboardItem);
    const allowBypassClipboard = !canCopyImage || isIOS || isSafari;
    let copied = allowBypassClipboard;
    try {
      const blob = await captureScreenshotBlob();
      if (blob && canCopyImage) {
        if (typeof document !== "undefined" && !document.hasFocus()) {
          window.focus?.();
        }
        copied = await safeWriteClipboardImage(blob);
      }
    } catch (error) {
      console.error("Failed to capture screenshot", error);
    } finally {
      setIsCapturing(false);
      if (!copied) {
        console.warn("Failed to write screenshot to clipboard.");
        return;
      }
      if (screenshotTwitterUrl) {
        window.location.href = screenshotTwitterUrl;
      }
    }
  }, [captureScreenshotBlob, isCapturing, screenshotTwitterUrl]);

  const summaryCostValue = useMemo(() => {
    const formatted = formatUsdCurrency(summary?.total_cost_usd);
    if (!formatted || formatted === "-" || formatted.startsWith("$")) return formatted;
    return `$${formatted}`;
  }, [summary?.total_cost_usd]);

  const fleetData = useMemo(
    () => buildFleetData(modelBreakdown, { copyFn: copy }),
    [modelBreakdown],
  );

  const openCostModal = useCallback(() => setCostModalOpen(true), []);
  const closeCostModal = useCallback(() => setCostModalOpen(false), []);
  const costInfoEnabled = summaryCostValue && summaryCostValue !== "-" && fleetData.length > 0;

  const resolvedLinkCode = !linkCodeExpired ? linkCode : null;
  const hasActiveDeviceToken = Boolean(
    userStatus?.install?.has_active_device_token ?? userStatus?.install?.hasActiveDeviceToken,
  );
  // The heatmap hook starts idle with no data, which reads as zero active days for one frame.
  const heatmapPending = heatmapLoading || (!heatmap && !heatmapError);
  const shouldShowInstall = shouldShowInstallCard({
    publicMode,
    screenshotMode,
    forceInstall,
    accessEnabled,
    heatmapLoading: heatmapPending,
    activeDays,
    hasActiveDeviceToken,
  });
  // The heatmap covers 52 weeks and Total covers 24 months, so a quiet year alone is not "no data".
  const showEmpty =
    !publicMode &&
    accessEnabled &&
    !heatmapPending &&
    activeDays === 0 &&
    hasActiveDeviceToken &&
    Boolean(summary) &&
    !hasUsageValue(summaryTotalTokens);
  const publicViewBusy = publicViewLoading || publicViewActionLoading;
  const publicViewUrl = useMemo(() => {
    if (!publicViewToken || typeof window === "undefined") return "";
    const url = new URL(`/share/${publicViewToken}`, window.location.origin);
    return url.toString();
  }, [publicViewToken]);

  const handleCopyPublicView = useCallback(async () => {
    if (publicViewActionLoading || !publicViewEnabled) return;
    let nextUrl = publicViewUrl;
    if (!nextUrl) {
      setPublicViewActionLoading(true);
      try {
        const resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
        if (!resolvedToken) {
          setPublicViewActionLoading(false);
          return;
        }
        const data = await getPublicVisibility({
          baseUrl,
          accessToken: resolvedToken,
        });
        const token = typeof data?.share_token === "string" ? data.share_token : null;
        setPublicViewToken(token);
        if (token && typeof window !== "undefined") {
          const url = new URL(`/share/${token}`, window.location.origin);
          nextUrl = url.toString();
        }
      } catch (_err) {
        // ignore issue errors
      } finally {
        setPublicViewActionLoading(false);
      }
    }
    if (!nextUrl) return;
    const didCopy = await safeWriteClipboard(nextUrl);
    if (!didCopy) return;
    setPublicViewCopied(true);
    window.setTimeout(() => setPublicViewCopied(false), 2000);
  }, [effectiveAuthToken, baseUrl, publicViewActionLoading, publicViewEnabled, publicViewUrl]);

  const handleTogglePublicView = useCallback(async () => {
    if (publicViewActionLoading) return;
    setPublicViewCopied(false);
    setPublicViewActionLoading(true);
    try {
      const resolvedToken = await resolveAuthAccessToken(effectiveAuthToken);
      if (!resolvedToken) {
        setPublicViewActionLoading(false);
        return;
      }
      const nextValue = !publicViewEnabled;
      const data = await setPublicVisibility({
        baseUrl,
        accessToken: resolvedToken,
        enabled: nextValue,
      });
      const enabled = Boolean(data?.enabled);
      setPublicViewEnabled(enabled);
      setPublicViewToken(data?.share_token || null);
    } catch (_err) {
      // ignore toggle errors
    } finally {
      setPublicViewActionLoading(false);
    }
  }, [effectiveAuthToken, baseUrl, publicViewActionLoading, publicViewEnabled]);

  const handleSignIn = useCallback(() => window.location.assign(signInUrl), [signInUrl]);

  // Global keybind layer — DESIGN.md §11. Disabled in screenshot mode.
  // While the cheatsheet is open the modal owns the keyboard: only ? and esc
  // route through (toggle / close); period / refresh / share are silenced so
  // they don't bleed past the overlay.
  useGlobalKeybinds({
    onTogglePeriod: cheatsheetOpen ? undefined : transitionSelectedPeriod,
    onRefresh: cheatsheetOpen ? undefined : refreshAll,
    onShare: cheatsheetOpen ? undefined : handleShareToX,
    onToggleCheatsheet: () => setCheatsheetOpen((o) => !o),
    onCloseCheatsheet: () => setCheatsheetOpen(false),
    enabled: !screenshotMode,
  });

  const showExpiredGate = sessionSoftExpired && !publicMode;
  const screen = mainScreen({
    publicViewInvalid,
    showExpiredGate,
    usageError,
    shouldShowInstall,
    usageLoading,
    hasSummary: Boolean(summary),
    showEmpty,
  });

  return (
    <div className="min-h-screen bg-background px-8 pb-12 font-sans text-foreground">
      <div className="mx-auto flex max-w-304 flex-col gap-4">
        {screenshotMode ? (
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-4 pt-8">
            <div>
              <Heading text={copy("dashboard.screenshot.title_line1")} size="m" level={1} />
              <Heading text={copy("dashboard.screenshot.title_line2")} size="xl" level={1} />
            </div>
            <div data-screenshot-exclude="true" className="flex flex-wrap items-center gap-3">
              <Label text={copy("dashboard.screenshot.twitter_hint")} />
              <Button onClick={handleShareToX} disabled={isCapturing}>
                {copy("dashboard.screenshot.twitter_button")}
              </Button>
            </div>
          </div>
        ) : (
          <TopNav
            active="dashboard"
            signedIn={signedIn}
            dashboardHref="/"
            leaderboardHref="/leaderboard"
            githubHref={copy("ui2049.top_nav.github_href")}
            onSignIn={handleSignIn}
            onSignOut={signOut}
          />
        )}
        <IdentityBar
          handle={identityDisplayName}
          since={identityStartDate}
          activeDays={activeDays}
          subscriptions={identitySubscriptions}
          owner={!publicMode && signedIn}
          publicEnabled={publicViewEnabled}
          publicBusy={publicViewBusy || sessionSoftExpired}
          onPublicChange={handleTogglePublicView}
          onCopyShareLink={handleCopyPublicView}
          shareCopied={publicViewCopied}
        />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className={publicMode ? "min-w-0 lg:col-span-12" : "min-w-0 lg:col-span-8"}>
            {screen === "readout" ? (
              <Readout
                period={period}
                onPeriodChange={screenshotMode ? undefined : transitionSelectedPeriod}
                totals={summary ?? {}}
                from={from}
                to={to}
                asOf={todayKey}
                handle={identityDisplayName}
                onCostBreakdown={costInfoEnabled ? openCostModal : undefined}
              />
            ) : (
              <StateScreen
                variant={screen}
                linkCode={resolvedLinkCode}
                onSignIn={handleSignIn}
                onRetry={refreshAll}
              />
            )}
          </div>
          {publicMode ? null : (
            <div className="min-w-0 lg:col-span-4 *:min-h-96">
              <RankRail
                me={rankBoard?.me ?? null}
                entries={Array.isArray(rankBoard?.entries) ? rankBoard.entries : []}
                totalEntries={rankBoard?.total_entries ?? 0}
                from={rankBoard?.from || weekRange.from}
                to={rankBoard?.to || weekRange.to}
                handle={identityDisplayName}
                leaderboardHref="/leaderboard"
              />
            </div>
          )}
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-6 lg:*:min-h-176">
            <Models
              breakdown={modelBreakdown ?? {}}
              periodLabel={periodLabel(period)}
              from={from}
              to={to}
              handle={identityDisplayName}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-6">
            <div className="lg:*:min-h-66">
              <DotHeatmap
                heatmap={{ ...heatmapRange, weeks: [], ...heatmap }}
                handle={identityDisplayName}
              />
            </div>
            <div className="lg:*:min-h-106">
              <Trend
                rows={trendRowsForDisplay}
                dateKey={detailsDateKey}
                period={period}
                rolling={rollingUsage}
              />
            </div>
          </div>
        </div>
        <Projects
          entries={projectUsageEntries}
          limit={projectUsageLimit}
          onLimitChange={setProjectUsageLimit}
          totalTokens={period === "total" ? summaryTotalTokens : undefined}
        />
        <DailyTable
          rows={detailsRows}
          dateKey={detailsDateKey}
          paged={DETAILS_PAGED_PERIODS.has(period)}
        />
        {screenshotMode ? null : (
          <PageFooter
            left={timeZoneRangeLabel}
            right={copy("ui2049.page_footer.version", { version: getAppVersion(import.meta.env) })}
          />
        )}
      </div>
      <CostAnalysisModal isOpen={costModalOpen} onClose={closeCostModal} fleetData={fleetData} />
      <KeyboardCheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
    </div>
  );
}
