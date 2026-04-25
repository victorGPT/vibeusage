import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackendStatus } from "../components/BackendStatus.jsx";
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
import { getDetailsSortColumns, sortDailyRows } from "../lib/daily";
import { getRangeForPeriod } from "../lib/date-range";
import { DETAILS_PAGE_SIZE, paginateRows, trimLeadingZeroMonths } from "../lib/details";
import {
  getUsagePanelLoading,
  selectRollingUsageForDisplay,
} from "../lib/dashboard-period-bindings";
import {
  formatCompactNumber,
  formatUsdCurrency,
  toDisplayNumber,
  toFiniteNumber,
} from "../lib/format";
import { shouldShowInstallCard } from "../lib/install-status";
import { getMockNow, isMockEnabled } from "../lib/mock-data";
import {
  buildFleetData,
  buildTopModels,
  resolveModelDisplayName,
} from "../lib/model-breakdown";
import { safeWriteClipboard, safeWriteClipboardImage } from "../lib/safe-browser";
import { isScreenshotModeEnabled } from "../lib/screenshot-mode";
import {
  formatTimeZoneLabel,
  formatTimeZoneShortLabel,
  getBrowserTimeZone,
  getBrowserTimeZoneOffsetMinutes,
  getLocalDayKey,
} from "../lib/timezone";
import {
  getPublicVisibility,
  setPublicVisibility,
  getUserStatus,
  getPublicViewProfile,
  requestInstallLinkCode,
} from "../lib/vibeusage-api";
import { AsciiBox } from "../ui/foundation/AsciiBox.jsx";
import { MatrixButton } from "../ui/foundation/MatrixButton.jsx";
import { COLORS } from "../ui/matrix-a/components/MatrixConstants";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { BootScreen } from "../ui/matrix-a/components/BootScreen.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";
import { ProjectUsagePanel } from "../ui/matrix-a/components/ProjectUsagePanel.jsx";
import { KeyboardCheatsheet } from "../ui/matrix-a/components/KeyboardCheatsheet.jsx";
import { DashboardView } from "../ui/matrix-a/views/DashboardView.jsx";
import { useGlobalKeybinds } from "../hooks/use-global-keybinds";

const PERIODS = ["day", "week", "month", "total"];
const DETAILS_DATE_KEYS = new Set(["day", "hour", "month"]);
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
  signUpUrl = "/sign-up",
}) {
  const [booted, setBooted] = useState(false);
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
  const [compactSummary, setCompactSummary] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const forceInstall = useMemo(() => isForceInstallEnabled(), []);
  const [isCapturing, setIsCapturing] = useState(false);
  const identityScrambleDurationMs = 2200;
  const [coreIndexCollapsed, setCoreIndexCollapsed] = useState(true);
  const [installCopied, setInstallCopied] = useState(false);
  const [sessionExpiredCopied, setSessionExpiredCopied] = useState(false);
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
    const t = window.setTimeout(() => setBooted(true), 900);
    return () => window.clearTimeout(t);
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompactSummary(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const tzOffsetMinutes = useMemo(() => getBrowserTimeZoneOffsetMinutes(), []);
  const mockNow = useMemo(() => getMockNow(), []);
  const cacheKey = publicMode ? null : auth?.userId || auth?.email || null;
  const [selectedPeriod, setSelectedPeriod] = useState("week");
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
  const timeZoneLabel = useMemo(
    () => formatTimeZoneLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes],
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
  const trendTimeZoneLabel = timeZoneLabel;
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
    daily,
    summary,
    source: usageSource,
    loading: usageLoading,
    refreshing: usageRefreshing,
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

  const {
    breakdown: modelBreakdown,
    loading: modelBreakdownLoading,
    refresh: refreshModelBreakdown,
  } = useUsageModelBreakdown({
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
  const {
    entries: projectUsageEntries,
    loading: projectUsageLoading,
    error: projectUsageError,
  } = useProjectUsageSummary({
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

  const {
    rows: trendRows,
    from: trendFrom,
    to: trendTo,
    loading: trendLoading,
    refresh: refreshTrend,
  } = useTrendData({
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
    daily: heatmapDaily,
    heatmap,
    loading: heatmapLoading,
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
  const detailsColumns = useMemo(() => getDetailsSortColumns(detailsDateKey), [detailsDateKey]);
  const [sort, setSort] = useState(() => ({ key: "day", dir: "desc" }));
  useEffect(() => {
    setSort((prev) => {
      if (!DETAILS_DATE_KEYS.has(prev.key)) return prev;
      if (prev.key === detailsDateKey) return prev;
      return { key: detailsDateKey, dir: prev.dir };
    });
  }, [detailsDateKey]);
  const effectiveSort = useMemo(() => {
    if (DETAILS_DATE_KEYS.has(sort.key) && sort.key !== detailsDateKey) {
      return { ...sort, key: detailsDateKey };
    }
    return sort;
  }, [detailsDateKey, sort]);
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
  const sortedDetails = useMemo(
    () => sortDailyRows(detailsRows, effectiveSort),
    [detailsRows, effectiveSort],
  );
  const hasDetailsActual = useMemo(
    () => detailsRows.some((row) => !row?.missing && !row?.future),
    [detailsRows],
  );
  const detailsPageCount = useMemo(() => {
    if (!DETAILS_PAGED_PERIODS.has(period)) return 1;
    const count = Math.ceil(sortedDetails.length / DETAILS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [period, sortedDetails.length]);
  const [detailsPage, setDetailsPage] = useState(0);
  useEffect(() => {
    if (!DETAILS_PAGED_PERIODS.has(period)) {
      setDetailsPage(0);
      return;
    }
    setDetailsPage((prev) => Math.min(prev, detailsPageCount - 1));
  }, [detailsPageCount, period]);
  useEffect(() => {
    if (!DETAILS_PAGED_PERIODS.has(period)) return;
    setDetailsPage(0);
  }, [period, sort.dir, sort.key]);
  const pagedDetails = useMemo(() => {
    if (!DETAILS_PAGED_PERIODS.has(period)) return sortedDetails;
    return paginateRows(sortedDetails, detailsPage, DETAILS_PAGE_SIZE);
  }, [detailsPage, period, sortedDetails]);
  const trendRowsForDisplay = useMemo(() => {
    if (period === "day") {
      return Array.isArray(trendRows) ? trendRows.filter((row) => row?.hour) : [];
    }
    return trendRows;
  }, [period, trendRows]);
  const trendFromForDisplay = trendFrom;
  const trendToForDisplay = trendTo;

  function renderDetailCell(row, key) {
    if (row?.future) return "—";
    if (row?.missing) return copy("shared.status.unsynced");
    if (key === "total_tokens") {
      return toDisplayNumber(getBillableTotal(row));
    }
    return toDisplayNumber(row?.[key]);
  }

  function renderDetailDate(row) {
    const raw = row?.[detailsDateKey];
    if (raw == null) return "";
    const value = String(raw);
    if (detailsDateKey === "hour") {
      const [datePart, timePart] = value.split("T");
      if (datePart && timePart) {
        return `${datePart} ${timePart.slice(0, 5)}`;
      }
    }
    return value;
  }

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "desc" };
    });
  }

  function ariaSortFor(key) {
    if (effectiveSort.key !== key) return "none";
    return effectiveSort.dir === "asc" ? "ascending" : "descending";
  }

  function sortIconFor(key) {
    if (effectiveSort.key !== key) return "";
    return effectiveSort.dir === "asc" ? "▲" : "▼";
  }

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

  const usagePanelLoading = useMemo(
    () =>
      getUsagePanelLoading({
        usageLoading,
        heatmapLoading,
        trendLoading,
        modelBreakdownLoading,
      }),
    [heatmapLoading, modelBreakdownLoading, trendLoading, usageLoading],
  );
  const rollingUsage = useMemo(
    () => selectRollingUsageForDisplay({ recentRolling }),
    [recentRolling],
  );
  const usageSourceLabel = useMemo(
    () =>
      copy("shared.data_source", {
        source: String(usageSource || "edge").toUpperCase(),
      }),
    [usageSource],
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
  const identitySubscriptions = useMemo(() => {
    if (publicMode) return [];
    const rows = Array.isArray(userStatus?.subscriptions?.items)
      ? userStatus.subscriptions.items
      : [];
    const normalized = rows
      .map((row) => {
        const tool = typeof row?.tool === "string" ? row.tool.trim() : "";
        const planTypeRaw =
          typeof row?.plan_type === "string"
            ? row.plan_type
            : typeof row?.planType === "string"
              ? row.planType
              : "";
        const planType = planTypeRaw.trim();
        if (!tool || !planType) return null;
        return {
          tool,
          planType,
          provider: typeof row?.provider === "string" ? row.provider.trim() : "",
          product: typeof row?.product === "string" ? row.product.trim() : "",
          rateLimitTier:
            typeof row?.rate_limit_tier === "string"
              ? row.rate_limit_tier.trim()
              : typeof row?.rateLimitTier === "string"
                ? row.rateLimitTier.trim()
                : "",
        };
      })
      .filter(Boolean);
    return normalized.slice(0, 6);
  }, [publicMode, userStatus]);

  const activityHeatmapBlock = (
    <AsciiBox
      title={copy("dashboard.activity.title")}
      subtitle={accessEnabled ? copy("dashboard.activity.subtitle") : "—"}
      className="min-w-0 overflow-hidden"
    >
      <ActivityHeatmap
        heatmap={heatmap}
        timeZoneLabel={timeZoneLabel}
        timeZoneShortLabel={timeZoneShortLabel}
        hideLegend={screenshotMode}
        defaultToLatestMonth={screenshotMode}
      />
    </AsciiBox>
  );

  const rangeLabel = useMemo(() => {
    return `${from}..${to}`;
  }, [from, period, to]);

  const summaryLabel = copy("usage.summary.total");
  const summaryTotalTokens = getBillableTotal(summary);
  const thousandSuffix = copy("shared.unit.thousand_abbrev");
  const millionSuffix = copy("shared.unit.million_abbrev");
  const billionSuffix = copy("shared.unit.billion_abbrev");
  const summaryNumber = toFiniteNumber(summaryTotalTokens);
  const useCompactSummary =
    compactSummary && summaryNumber != null && Math.abs(summaryNumber) >= 1000000000;
  const summaryValue = useMemo(() => {
    if (!useCompactSummary) return toDisplayNumber(summaryTotalTokens);
    return formatCompactNumber(summaryNumber, {
      thousandSuffix,
      millionSuffix,
      billionSuffix,
      decimals: 1,
    });
  }, [
    billionSuffix,
    millionSuffix,
    summaryTotalTokens,
    summaryNumber,
    thousandSuffix,
    useCompactSummary,
  ]);

  const coreIndexCollapseLabel = copy("dashboard.core_index.collapse_label");
  const coreIndexExpandLabel = copy("dashboard.core_index.expand_label");
  const coreIndexCollapseAria = copy("dashboard.core_index.collapse_aria");
  const coreIndexExpandAria = copy("dashboard.core_index.expand_aria");
  const allowBreakdownToggle = !screenshotMode;
  const screenshotTitleLine1 = copy("dashboard.screenshot.title_line1");
  const screenshotTitleLine2 = copy("dashboard.screenshot.title_line2");
  const screenshotTwitterLabel = copy("dashboard.screenshot.twitter_label");
  const screenshotTwitterButton = copy("dashboard.screenshot.twitter_button");
  const screenshotTwitterHint = copy("dashboard.screenshot.twitter_hint");
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
    docEl?.classList.add("screenshot-capture");
    document.body?.classList.add("screenshot-capture");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitForHeatmapLatest();
    try {
      const { toBlob, toPng } = await import("html-to-image");
      const blob = await toBlob(root, {
        backgroundColor: COLORS.SURFACE,
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
        backgroundColor: COLORS.SURFACE,
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
  const footerLeftContent = screenshotMode
    ? null
    : accessEnabled
      ? copy("dashboard.footer.active", { range: timeZoneRangeLabel })
      : copy("dashboard.footer.auth");
  const periodsForDisplay = useMemo(() => (screenshotMode ? [] : PERIODS), [screenshotMode]);

  const metricsRows = useMemo(
    () => [
      {
        label: copy("usage.metric.total"),
        value: toDisplayNumber(summaryTotalTokens),
        valueClassName: "text-ink-bright",
      },
      {
        label: copy("usage.metric.input"),
        value: toDisplayNumber(summary?.input_tokens),
      },
      {
        label: copy("usage.metric.output"),
        value: toDisplayNumber(summary?.output_tokens),
      },
      {
        label: copy("usage.metric.cached_input"),
        value: toDisplayNumber(summary?.cached_input_tokens),
      },
      {
        label: copy("usage.metric.reasoning_output"),
        value: toDisplayNumber(summary?.reasoning_output_tokens),
      },
    ],
    [
      summary?.cached_input_tokens,
      summary?.input_tokens,
      summary?.output_tokens,
      summary?.reasoning_output_tokens,
      summaryTotalTokens,
    ],
  );

  const summaryCostValue = useMemo(() => {
    const formatted = formatUsdCurrency(summary?.total_cost_usd);
    if (!formatted || formatted === "-" || formatted.startsWith("$")) return formatted;
    return `$${formatted}`;
  }, [summary?.total_cost_usd]);

  const fleetData = useMemo(
    () => buildFleetData(modelBreakdown, { copyFn: copy }),
    [modelBreakdown],
  );
  const topModels = useMemo(
    () => buildTopModels(modelBreakdown, { limit: 3, copyFn: copy }),
    [modelBreakdown],
  );
  const projectUsageBlock = useMemo(
    () => (
      <ProjectUsagePanel
        entries={projectUsageEntries}
        limit={projectUsageLimit}
        onLimitChange={setProjectUsageLimit}
        loading={projectUsageLoading}
        error={projectUsageError}
      />
    ),
    [projectUsageEntries, projectUsageLimit, projectUsageLoading, projectUsageError],
  );

  const openCostModal = useCallback(() => setCostModalOpen(true), []);
  const closeCostModal = useCallback(() => setCostModalOpen(false), []);
  const costInfoEnabled = summaryCostValue && summaryCostValue !== "-" && fleetData.length > 0;

  const installInitCmdBase = copy("dashboard.install.cmd.init");
  const resolvedLinkCode = !linkCodeExpired ? linkCode : null;
  const installInitCmdCopy = resolvedLinkCode
    ? copy("dashboard.install.cmd.init_link_code", {
        link_code: resolvedLinkCode,
      })
    : installInitCmdBase;
  const installInitCmdDisplay = installInitCmdBase;
  const installSyncCmd = copy("dashboard.install.cmd.sync");
  const installCopyLabel = resolvedLinkCode
    ? copy("dashboard.install.copy")
    : copy("dashboard.install.copy_base");
  const installCopiedLabel = copy("dashboard.install.copied");
  const sessionExpiredCopyLabel = copy("dashboard.session_expired.copy_label");
  const sessionExpiredCopiedLabel = copy("dashboard.session_expired.copied");
  const hasActiveDeviceToken = Boolean(
    userStatus?.install?.has_active_device_token ?? userStatus?.install?.hasActiveDeviceToken,
  );
  const shouldShowInstall = shouldShowInstallCard({
    publicMode,
    screenshotMode,
    forceInstall,
    accessEnabled,
    heatmapLoading,
    activeDays,
    hasActiveDeviceToken,
  });
  const installPrompt = copy("dashboard.install.prompt");
  const publicViewTitle = copy("dashboard.public_view.title");
  const publicViewStatusEnabledLabel = copy("dashboard.public_view.status.enabled");
  const publicViewStatusDisabledLabel = copy("dashboard.public_view.status.disabled");
  const publicViewCopyLabel = copy("dashboard.public_view.action.copy");
  const publicViewCopiedLabel = copy("dashboard.public_view.action.copied");
  const publicViewEnableLabel = copy("dashboard.public_view.action.enable");
  const publicViewDisableLabel = copy("dashboard.public_view.action.disable");
  const publicViewInvalidTitle = copy("dashboard.public_view.invalid.title");
  const publicViewInvalidBody = copy("dashboard.public_view.invalid.body");
  const publicViewBusy = publicViewLoading || publicViewActionLoading;
  const publicViewStatusLabel = publicViewEnabled
    ? publicViewStatusEnabledLabel
    : publicViewStatusDisabledLabel;
  const publicViewUrl = useMemo(() => {
    if (!publicViewToken || typeof window === "undefined") return "";
    const url = new URL(`/share/${publicViewToken}`, window.location.origin);
    return url.toString();
  }, [publicViewToken]);
  const publicViewCopyButtonLabel = publicViewCopied ? publicViewCopiedLabel : publicViewCopyLabel;
  const publicViewToggleLabel = publicViewEnabled ? publicViewDisableLabel : publicViewEnableLabel;

  const handleCopyInstall = useCallback(async () => {
    if (!installInitCmdCopy) return;
    const didCopy = await safeWriteClipboard(installInitCmdCopy);
    if (!didCopy) return;
    setInstallCopied(true);
    window.setTimeout(() => setInstallCopied(false), 2000);
  }, [installInitCmdCopy]);

  const handleCopySessionExpired = useCallback(async () => {
    if (!installInitCmdBase) return;
    const didCopy = await safeWriteClipboard(installInitCmdBase);
    if (!didCopy) return;
    setSessionExpiredCopied(true);
    window.setTimeout(() => setSessionExpiredCopied(false), 2000);
  }, [installInitCmdBase]);

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
          signal: controller.signal,
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

  const dailyEmptyTemplate = useMemo(() => copy("dashboard.daily.empty", { cmd: "{{cmd}}" }), []);
  const [dailyEmptyPrefix, dailyEmptySuffix] = useMemo(() => {
    const parts = dailyEmptyTemplate.split("{{cmd}}");
    if (parts.length === 1) return [dailyEmptyTemplate, ""];
    return [parts[0], parts.slice(1).join("{{cmd}}")];
  }, [dailyEmptyTemplate]);

  const headerStatus =
    authTokenAllowed && authTokenReady ? (
      <BackendStatus baseUrl={baseUrl} accessToken={effectiveAuthToken} />
    ) : null;

  const headerRight = (
    <div className="ml-auto flex w-max min-w-max items-center gap-2 sm:gap-3 md:gap-4">
      <GithubStar isFixed={false} size="header" className="hidden sm:inline-flex" />
      {!publicMode && signedIn ? (
        <MatrixButton as="a" size="header" href="/leaderboard">
          {copy("leaderboard.nav.open")}
        </MatrixButton>
      ) : null}

      {publicMode ? (
        signedIn ? (
          <MatrixButton onClick={signOut} size="header">
            {copy("dashboard.sign_out")}
          </MatrixButton>
        ) : (
          <MatrixButton as="a" size="header" href={signInUrl}>
            {copy("landing.nav.login")}
          </MatrixButton>
        )
      ) : signedIn ? (
        <MatrixButton onClick={signOut} size="header">
          {copy("dashboard.sign_out")}
        </MatrixButton>
      ) : (
        <span className="text-micro opacity-60">{copy("dashboard.not_signed_in")}</span>
      )}
    </div>
  );

  // Global keybind layer — DESIGN.md §11. Disabled in screenshot mode and
  // before the boot screen finishes (handlers may not be ready).
  // While the cheatsheet is open the modal owns the keyboard: only ? and esc
  // route through (toggle / close); period / refresh / share are silenced so
  // they don't bleed past the overlay.
  useGlobalKeybinds({
    onTogglePeriod: cheatsheetOpen ? undefined : setSelectedPeriod,
    onRefresh: cheatsheetOpen ? undefined : refreshAll,
    onShare: cheatsheetOpen ? undefined : handleShareToX,
    onToggleCheatsheet: () => setCheatsheetOpen((o) => !o),
    onCloseCheatsheet: () => setCheatsheetOpen(false),
    enabled: booted && !screenshotMode,
  });

  if (!booted) {
    return <BootScreen onSkip={() => setBooted(true)} />;
  }

  const showExpiredGate = sessionSoftExpired && !publicMode;
  const requireAuthGate = !signedIn && !mockEnabled && !sessionSoftExpired;
  const showAuthGate = requireAuthGate && !publicMode;

  return (
    <>
    <DashboardView
      copy={copy}
      headerStatus={headerStatus}
      headerRight={headerRight}
      footerLeftContent={footerLeftContent}
      screenshotMode={screenshotMode}
      publicViewInvalid={publicViewInvalid}
      publicViewInvalidTitle={publicViewInvalidTitle}
      publicViewInvalidBody={publicViewInvalidBody}
      showExpiredGate={showExpiredGate}
      showAuthGate={showAuthGate}
      sessionExpiredCopied={sessionExpiredCopied}
      sessionExpiredCopiedLabel={sessionExpiredCopiedLabel}
      sessionExpiredCopyLabel={sessionExpiredCopyLabel}
      handleCopySessionExpired={handleCopySessionExpired}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      screenshotTitleLine1={screenshotTitleLine1}
      screenshotTitleLine2={screenshotTitleLine2}
      identityDisplayName={identityDisplayName}
      identityStartDate={identityStartDate}
      activeDays={activeDays}
      identitySubscriptions={identitySubscriptions}
      identityScrambleDurationMs={identityScrambleDurationMs}
      projectUsageBlock={projectUsageBlock}
      topModels={topModels}
      signedIn={signedIn}
      publicMode={publicMode}
      shouldShowInstall={shouldShowInstall}
      installPrompt={installPrompt}
      handleCopyInstall={handleCopyInstall}
      installCopied={installCopied}
      installCopiedLabel={installCopiedLabel}
      installCopyLabel={installCopyLabel}
      installInitCmdDisplay={installInitCmdDisplay}
      linkCodeLoading={linkCodeLoading}
      linkCodeError={linkCodeError}
      publicViewTitle={publicViewTitle}
      handleTogglePublicView={handleTogglePublicView}
      publicViewBusy={publicViewBusy}
      publicViewEnabled={publicViewEnabled}
      publicViewToggleLabel={publicViewToggleLabel}
      publicViewStatusLabel={publicViewStatusLabel}
      publicViewCopyButtonLabel={publicViewCopyButtonLabel}
      handleCopyPublicView={handleCopyPublicView}
      trendRowsForDisplay={trendRowsForDisplay}
      trendFromForDisplay={trendFromForDisplay}
      trendToForDisplay={trendToForDisplay}
      period={period}
      trendTimeZoneLabel={trendTimeZoneLabel}
      activityHeatmapBlock={activityHeatmapBlock}
      isCapturing={isCapturing}
      handleShareToX={handleShareToX}
      screenshotTwitterLabel={screenshotTwitterLabel}
      screenshotTwitterButton={screenshotTwitterButton}
      screenshotTwitterHint={screenshotTwitterHint}
      periodsForDisplay={periodsForDisplay}
      setSelectedPeriod={setSelectedPeriod}
      metricsRows={metricsRows}
      summaryLabel={summaryLabel}
      summaryValue={summaryValue}
      summaryCostValue={summaryCostValue}
      rollingUsage={rollingUsage}
      costInfoEnabled={costInfoEnabled}
      openCostModal={openCostModal}
      allowBreakdownToggle={allowBreakdownToggle}
      coreIndexCollapsed={coreIndexCollapsed}
      setCoreIndexCollapsed={setCoreIndexCollapsed}
      coreIndexCollapseLabel={coreIndexCollapseLabel}
      coreIndexExpandLabel={coreIndexExpandLabel}
      coreIndexCollapseAria={coreIndexCollapseAria}
      coreIndexExpandAria={coreIndexExpandAria}
      refreshAll={refreshAll}
      usagePanelLoading={usagePanelLoading}
      usagePanelRefreshing={usageRefreshing}
      usageError={usageError}
      rangeLabel={rangeLabel}
      timeZoneRangeLabel={timeZoneRangeLabel}
      usageSourceLabel={usageSourceLabel}
      fleetData={fleetData}
      hasDetailsActual={hasDetailsActual}
      dailyEmptyPrefix={dailyEmptyPrefix}
      installSyncCmd={installSyncCmd}
      dailyEmptySuffix={dailyEmptySuffix}
      detailsColumns={detailsColumns}
      ariaSortFor={ariaSortFor}
      toggleSort={toggleSort}
      sortIconFor={sortIconFor}
      pagedDetails={pagedDetails}
      detailsDateKey={detailsDateKey}
      renderDetailDate={renderDetailDate}
      renderDetailCell={renderDetailCell}
      DETAILS_PAGED_PERIODS={DETAILS_PAGED_PERIODS}
      detailsPageCount={detailsPageCount}
      detailsPage={detailsPage}
      setDetailsPage={setDetailsPage}
      costModalOpen={costModalOpen}
      closeCostModal={closeCostModal}
    />
    <KeyboardCheatsheet
      open={cheatsheetOpen}
      onClose={() => setCheatsheetOpen(false)}
    />
    </>
  );
}
