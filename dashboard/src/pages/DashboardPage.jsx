import React, { useCallback, useEffect, useMemo, useState } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { copy } from "../lib/copy.js";
import { getRangeForPeriod } from "../lib/date-range.js";
import { getDetailsSortColumns, sortDailyRows } from "../lib/daily.js";
import {
  DETAILS_PAGE_SIZE,
  paginateRows,
  trimLeadingZeroMonths,
} from "../lib/details.js";
import {
  formatCompactNumber,
  formatUsdCurrency,
  toDisplayNumber,
  toFiniteNumber,
} from "../lib/format.js";
import { requestInstallLinkCode } from "../lib/vibescore-api.js";
import { buildFleetData } from "../lib/model-breakdown.js";
import { safeWriteClipboard, safeWriteClipboardImage } from "../lib/safe-browser.js";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap.js";
import { useTrendData } from "../hooks/use-trend-data.js";
import { useUsageData } from "../hooks/use-usage-data.js";
import { useUsageModelBreakdown } from "../hooks/use-usage-model-breakdown.js";
import {
  formatTimeZoneLabel,
  formatTimeZoneShortLabel,
  getBrowserTimeZone,
  getBrowserTimeZoneOffsetMinutes,
  getLocalDayKey,
} from "../lib/timezone.js";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { AsciiBox } from "../ui/matrix-a/components/AsciiBox.jsx";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { BootScreen } from "../ui/matrix-a/components/BootScreen.jsx";
import { IdentityCard } from "../ui/matrix-a/components/IdentityCard.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { TrendMonitor } from "../ui/matrix-a/components/TrendMonitor.jsx";
import { UsagePanel } from "../ui/matrix-a/components/UsagePanel.jsx";
import { NeuralDivergenceMap } from "../ui/matrix-a/components/NeuralDivergenceMap.jsx";
import { CostAnalysisModal } from "../ui/matrix-a/components/CostAnalysisModal.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";
import { getMockNow, isMockEnabled } from "../lib/mock-data.js";

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

function isScreenshotModeEnabled() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get("screenshot") || "").toLowerCase();
  return raw === "1" || raw === "true";
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
  signedIn,
  sessionExpired,
  signOut,
}) {
  const [booted, setBooted] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState(null);
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState(null);
  const [linkCodeLoading, setLinkCodeLoading] = useState(false);
  const [linkCodeError, setLinkCodeError] = useState(null);
  const [linkCodeExpiryTick, setLinkCodeExpiryTick] = useState(0);
  const [linkCodeRefreshToken, setLinkCodeRefreshToken] = useState(0);
  const [compactSummary, setCompactSummary] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  const screenshotMode = useMemo(() => isScreenshotModeEnabled(), []);
  const forceInstall = useMemo(() => isForceInstallEnabled(), []);
  const [isCapturing, setIsCapturing] = useState(false);
  const wrappedEntryLabel = copy("dashboard.wrapped.entry");
  const wrappedEntryEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return true;
  }, []);
  const wrappedEntryUrl = useMemo(() => {
    if (!wrappedEntryEnabled || typeof window === "undefined") return "";
    const url = new URL("/", window.location.origin);
    url.searchParams.set("screenshot", "1");
    return url.toString();
  }, [wrappedEntryEnabled]);
  const showWrappedEntry =
    wrappedEntryEnabled && !screenshotMode && Boolean(wrappedEntryUrl);
  const identityScrambleDurationMs = 2200;
  const [coreIndexCollapsed, setCoreIndexCollapsed] = useState(true);
  const [installCopied, setInstallCopied] = useState(false);
  const [sessionExpiredCopied, setSessionExpiredCopied] = useState(false);
  const mockEnabled = isMockEnabled();
  const accessEnabled = signedIn || mockEnabled;
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
    let active = true;
    setLinkCodeLoading(true);
    setLinkCodeError(null);
    requestInstallLinkCode({ baseUrl, accessToken: auth?.accessToken || null })
      .then((data) => {
        if (!active) return;
        setLinkCode(typeof data?.link_code === "string" ? data.link_code : null);
        setLinkCodeExpiresAt(
          typeof data?.expires_at === "string" ? data.expires_at : null
        );
      })
      .catch((err) => {
        if (!active) return;
        setLinkCode(null);
        setLinkCodeExpiresAt(null);
        setLinkCodeError(err?.message || "Failed to load link code");
      })
      .finally(() => {
        if (!active) return;
        setLinkCodeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [baseUrl, mockEnabled, signedIn, auth?.accessToken, linkCodeRefreshToken]);

  const linkCodeExpired = useMemo(() => {
    if (!linkCodeExpiresAt) return false;
    const ts = Date.parse(linkCodeExpiresAt);
    if (!Number.isFinite(ts)) return false;
    const now = linkCodeExpiryTick || Date.now();
    return ts <= now;
  }, [linkCodeExpiresAt, linkCodeExpiryTick]);

  useEffect(() => {
    if (!signedIn || mockEnabled) return;
    if (!linkCodeExpiresAt || !linkCodeExpired) return;
    if (linkCodeLoading) return;
    setLinkCode(null);
    setLinkCodeExpiresAt(null);
    setLinkCodeError(null);
    setLinkCodeRefreshToken((value) => value + 1);
  }, [
    linkCodeExpired,
    linkCodeExpiresAt,
    linkCodeLoading,
    mockEnabled,
    signedIn,
  ]);

  useEffect(() => {
    if (!linkCodeExpiresAt) return;
    const ts = Date.parse(linkCodeExpiresAt);
    if (!Number.isFinite(ts)) return;
    const now = Date.now();
    setLinkCodeExpiryTick(now);
    if (ts <= now) return;
    const timeoutId = window.setTimeout(
      () => setLinkCodeExpiryTick(Date.now()),
      ts - now
    );
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
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const period = screenshotMode ? "total" : selectedPeriod;
  const range = useMemo(
    () =>
      getRangeForPeriod(period, {
        timeZone,
        offsetMinutes: tzOffsetMinutes,
        now: mockNow,
      }),
    [mockNow, period, timeZone, tzOffsetMinutes]
  );
  const from = range.from;
  const to = range.to;
  const timeZoneLabel = useMemo(
    () => formatTimeZoneLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes]
  );
  const timeZoneShortLabel = useMemo(
    () =>
      formatTimeZoneShortLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes]
  );
  const timeZoneRangeLabel = useMemo(
    () => `Local time (${timeZoneShortLabel})`,
    [timeZoneShortLabel]
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
    [mockNow, timeZone, tzOffsetMinutes]
  );

  const {
    daily,
    summary,
    source: usageSource,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    from,
    to,
    includeDaily: period !== "total",
    cacheKey: auth?.userId || auth?.email || "default",
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
    accessToken: auth?.accessToken || null,
    from,
    to,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
  });

  const shareDailyToTrend = period === "week" || period === "month";
  const useDailyTrend = period === "week" || period === "month";
  const visibleDaily = useMemo(() => {
    return daily.filter((row) => {
      if (row?.future) return false;
      if (!row?.day || !todayKey) return true;
      return String(row.day) <= String(todayKey);
    });
  }, [daily, todayKey]);
  const {
    rows: trendRows,
    from: trendFrom,
    to: trendTo,
    loading: trendLoading,
    refresh: refreshTrend,
  } = useTrendData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    period,
    from,
    to,
    months: 24,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone: trendTimeZone,
    tzOffsetMinutes: trendTzOffsetMinutes,
    now: mockNow,
    sharedRows: shareDailyToTrend ? daily : null,
    sharedRange: shareDailyToTrend ? { from, to } : null,
  });

  const {
    daily: heatmapDaily,
    heatmap,
    loading: heatmapLoading,
    refresh: refreshHeatmap,
  } = useActivityHeatmap({
    baseUrl,
    accessToken: auth?.accessToken || null,
    weeks: 52,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
    now: mockNow,
  });

  const detailsDateKey = useMemo(() => {
    if (period === "day") return "hour";
    if (period === "total") return "month";
    return "day";
  }, [period]);
  const detailsColumns = useMemo(
    () => getDetailsSortColumns(detailsDateKey),
    [detailsDateKey]
  );
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
      return Array.isArray(trendRows)
        ? trendRows.filter((row) => row?.hour && !row?.future)
        : [];
    }
    if (period === "total") {
      const rows = Array.isArray(trendRows)
        ? trendRows.filter((row) => row?.month && !row?.future)
        : [];
      return trimLeadingZeroMonths(rows);
    }
    return visibleDaily;
  }, [period, trendRows, visibleDaily]);
  const sortedDetails = useMemo(
    () => sortDailyRows(detailsRows, effectiveSort),
    [detailsRows, effectiveSort]
  );
  const hasDetailsActual = useMemo(
    () => detailsRows.some((row) => !row?.missing && !row?.future),
    [detailsRows]
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
    if (useDailyTrend) return daily;
    if (period === "day") {
      return Array.isArray(trendRows)
        ? trendRows.filter((row) => row?.hour)
        : [];
    }
    return trendRows;
  }, [daily, period, trendRows, useDailyTrend]);
  const trendFromForDisplay = useDailyTrend ? from : trendFrom;
  const trendToForDisplay = useDailyTrend ? to : trendTo;

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
      if (prev.key === key)
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
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
    if (!signedIn && !mockEnabled) return 0;
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
    refreshHeatmap();
    refreshTrend();
    refreshModelBreakdown();
  }, [refreshHeatmap, refreshModelBreakdown, refreshTrend, refreshUsage]);

  const usageLoadingState =
    usageLoading || heatmapLoading || trendLoading || modelBreakdownLoading;
  const usageSourceLabel = useMemo(
    () =>
      copy("shared.data_source", {
        source: String(usageSource || "edge").toUpperCase(),
      }),
    [usageSource]
  );
  const identityLabel = useMemo(() => {
    const raw = auth?.name?.trim();
    if (!raw || raw.includes("@")) return copy("dashboard.identity.fallback");
    return raw;
  }, [auth?.name]);

  const identityHandle = useMemo(() => {
    return identityLabel.replace(/[^a-zA-Z0-9._-]/g, "_");
  }, [identityLabel]);
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
    const sources = Array.isArray(modelBreakdown?.sources)
      ? modelBreakdown.sources
      : [];
    let topSource = null;
    let topSourceTokens = 0;

    for (const source of sources) {
      const tokens = toFiniteNumber(
        source?.totals?.billable_total_tokens ?? source?.totals?.total_tokens
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
      agentName = topSource?.source
        ? String(topSource.source).toUpperCase()
        : placeholderShort;
      const models = Array.isArray(topSource?.models) ? topSource.models : [];
      let topModelTokens = 0;
      for (const model of models) {
        const tokens = toFiniteNumber(
          model?.totals?.billable_total_tokens ?? model?.totals?.total_tokens
        );
        if (!Number.isFinite(tokens) || tokens <= 0) continue;
        if (tokens > topModelTokens) {
          topModelTokens = tokens;
          modelName = model?.model ? String(model.model) : placeholderShort;
        }
      }
      if (topModelTokens > 0) {
        modelPercent = ((topModelTokens / topSourceTokens) * 100).toFixed(1);
      }
    }

    return { agentName, modelName, modelPercent };
  }, [modelBreakdown, placeholderShort]);
  const displayTotalTokens = toDisplayNumber(summaryTotalTokens);
  const twitterTotalTokens =
    displayTotalTokens === "-" ? placeholderShort : displayTotalTokens;
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
        backgroundColor: "#050505",
        pixelRatio: 2,
        cacheBust: true,
        width: scrollWidth,
        height: scrollHeight,
        style: {
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
        },
        filter: (node) =>
          !(node instanceof HTMLElement) ||
          node.dataset?.screenshotExclude !== "true",
      });
      if (blob) return blob;
      const dataUrl = await toPng(root, {
        backgroundColor: "#050505",
        pixelRatio: 2,
        cacheBust: true,
        width: scrollWidth,
        height: scrollHeight,
        style: {
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
        },
        filter: (node) =>
          !(node instanceof HTMLElement) ||
          node.dataset?.screenshotExclude !== "true",
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
  const periodsForDisplay = useMemo(
    () => (screenshotMode ? [] : PERIODS),
    [screenshotMode]
  );

  const metricsRows = useMemo(
    () => [
      {
        label: copy("usage.metric.total"),
        value: toDisplayNumber(summaryTotalTokens),
        valueClassName: "text-white",
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
    ]
  );

  const summaryCostValue = useMemo(() => {
    const formatted = formatUsdCurrency(summary?.total_cost_usd);
    if (!formatted || formatted === "-" || formatted.startsWith("$"))
      return formatted;
    return `$${formatted}`;
  }, [summary?.total_cost_usd]);

  const fleetData = useMemo(
    () => buildFleetData(modelBreakdown, { copyFn: copy }),
    [modelBreakdown]
  );

  const openCostModal = useCallback(() => setCostModalOpen(true), []);
  const closeCostModal = useCallback(() => setCostModalOpen(false), []);
  const costInfoEnabled =
    summaryCostValue && summaryCostValue !== "-" && fleetData.length > 0;

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
  const shouldShowInstall =
    !screenshotMode &&
    (forceInstall || (accessEnabled && !heatmapLoading && activeDays === 0));
  const installPrompt = copy("dashboard.install.prompt");

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

  const redirectUrl = useMemo(
    () => `${window.location.origin}/auth/callback`,
    []
  );
  const signInUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-in", redirectUrl }),
    [baseUrl, redirectUrl]
  );
  const signUpUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-up", redirectUrl }),
    [baseUrl, redirectUrl]
  );

  const dailyEmptyTemplate = useMemo(
    () => copy("dashboard.daily.empty", { cmd: "{{cmd}}" }),
    []
  );
  const [dailyEmptyPrefix, dailyEmptySuffix] = useMemo(() => {
    const parts = dailyEmptyTemplate.split("{{cmd}}");
    if (parts.length === 1) return [dailyEmptyTemplate, ""];
    return [parts[0], parts.slice(1).join("{{cmd}}")];
  }, [dailyEmptyTemplate]);

  const headerRight = (
    <div className="flex items-center gap-4">
      {showWrappedEntry ? (
        <MatrixButton
          as="a"
          href={wrappedEntryUrl}
          size="header"
          aria-label={wrappedEntryLabel}
          title={wrappedEntryLabel}
          className="matrix-header-action--ghost bg-transparent text-gold border-gold hover:border-gold hover:text-gold"
          style={{
            "--matrix-header-corner": "#FFD700",
            borderColor: "#FFD700",
            color: "#FFD700",
          }}
        >
          {wrappedEntryLabel}
        </MatrixButton>
      ) : null}
      <GithubStar isFixed={false} size="header" />

      {signedIn ? (
        <>
          <MatrixButton onClick={signOut} size="header">
            {copy("dashboard.sign_out")}
          </MatrixButton>
        </>
      ) : (
        <span className="text-[10px] opacity-60">
          {copy("dashboard.not_signed_in")}
        </span>
      )}
    </div>
  );

  if (!booted) {
    return <BootScreen onSkip={() => setBooted(true)} />;
  }

  const requireAuthGate = !signedIn && !mockEnabled && !sessionExpired;

  return (
    <>
      <MatrixShell
        hideHeader={screenshotMode}
        headerStatus={
          <BackendStatus
            baseUrl={baseUrl}
            accessToken={auth?.accessToken || null}
          />
        }
        headerRight={headerRight}
        footerLeft={
          footerLeftContent ? <span>{footerLeftContent}</span> : null
        }
        footerRight={
          <span className="font-bold">{copy("dashboard.footer.right")}</span>
        }
        contentClassName=""
        rootClassName={screenshotMode ? "screenshot-mode" : ""}
      >
        {sessionExpired ? (
          <div className="mb-6">
            <AsciiBox
              title={copy("dashboard.session_expired.title")}
              subtitle={copy("dashboard.session_expired.subtitle")}
              className="border-[#00FF41]/40"
            >
              <p className="text-[10px] mt-0 flex flex-wrap items-center gap-2">
                <span className="opacity-50">
                  {copy("dashboard.session_expired.body")}
                </span>
                <MatrixButton
                  className="px-2 py-1 text-[9px] normal-case"
                  onClick={handleCopySessionExpired}
                >
                  {sessionExpiredCopied
                    ? sessionExpiredCopiedLabel
                    : sessionExpiredCopyLabel}
                </MatrixButton>
                <span className="opacity-50">
                  {copy("dashboard.session_expired.body_tail")}
                </span>
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : null}
        {requireAuthGate ? (
          <div className="flex items-center justify-center">
            <AsciiBox
              title={copy("dashboard.auth_required.title")}
              subtitle={copy("dashboard.auth_required.subtitle")}
              className="w-full max-w-2xl"
            >
              <p className="text-[10px] opacity-50 mt-0">
                {copy("dashboard.auth_required.body")}
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <MatrixButton as="a" primary href={signInUrl}>
                  {copy("shared.button.sign_in")}
                </MatrixButton>
                <MatrixButton as="a" href={signUpUrl}>
                  {copy("shared.button.sign_up")}
                </MatrixButton>
              </div>
            </AsciiBox>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
              {screenshotMode ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-3xl md:text-4xl font-black text-white tracking-[-0.03em] leading-none glow-text">
                      {screenshotTitleLine1}
                    </span>
                    <span className="text-2xl md:text-3xl font-black text-white tracking-[-0.03em] leading-none glow-text">
                      {screenshotTitleLine2}
                    </span>
                  </div>
                </div>
              ) : null}
              <IdentityCard
                title={copy("dashboard.identity.title")}
                subtitle={copy("dashboard.identity.subtitle")}
                name={identityHandle}
                isPublic
                rankLabel={identityStartDate ?? copy("identity_card.rank_placeholder")}
                streakDays={activeDays}
                animateTitle={false}
                scrambleDurationMs={identityScrambleDurationMs}
              />

              {!screenshotMode && !signedIn ? (
                <AsciiBox
                  title={copy("dashboard.auth_optional.title")}
                  subtitle={copy("dashboard.auth_optional.subtitle")}
                >
                  <p className="text-[10px] opacity-50 mt-0">
                    {copy("dashboard.auth_optional.body")}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <MatrixButton as="a" primary href={signInUrl}>
                      {copy("shared.button.sign_in")}
                    </MatrixButton>
                    <MatrixButton as="a" href={signUpUrl}>
                      {copy("shared.button.sign_up")}
                    </MatrixButton>
                  </div>
                </AsciiBox>
              ) : null}

              {shouldShowInstall ? (
                <AsciiBox
                  title={copy("dashboard.install.title")}
                  subtitle={copy("dashboard.install.subtitle")}
                  className="relative"
                >
                  <div className="text-[12px] tracking-[0.16em] font-semibold text-[#00FF41]/90">
                    {installPrompt}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    <MatrixButton
                      onClick={handleCopyInstall}
                      aria-label={installCopied ? installCopiedLabel : installCopyLabel}
                      title={installCopied ? installCopiedLabel : installCopyLabel}
                      className="w-full justify-between gap-3 normal-case px-3"
                    >
                      <span className="font-mono text-[11px] md:text-[12px] tracking-[0.02em] normal-case text-left">
                        {installInitCmdDisplay}
                      </span>
                      <span className="inline-flex items-center justify-center w-7 h-7 border border-[#00FF41]/30 bg-black/30">
                        {installCopied ? (
                          <svg
                            viewBox="0 0 16 16"
                            className="w-4 h-4 text-[#00FF41]"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5-5L12.5 5z" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 16 16"
                            className="w-4 h-4 text-[#00FF41]"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M11 1H4a1 1 0 0 0-1 1v9h1V2h7V1z" />
                            <path d="M5 4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4zm1 0v9h6V4H6z" />
                          </svg>
                        )}
                      </span>
                    </MatrixButton>
                    {linkCodeLoading ? (
                      <span className="text-[12px] opacity-40">
                        {copy("dashboard.install.link_code.loading")}
                      </span>
                    ) : linkCodeError ? (
                      <span className="text-[12px] opacity-40">
                        {copy("dashboard.install.link_code.failed")}
                      </span>
                    ) : null}
                  </div>
                </AsciiBox>
              ) : null}

              {!screenshotMode ? (
                <TrendMonitor
                  rows={trendRowsForDisplay}
                  from={trendFromForDisplay}
                  to={trendToForDisplay}
                  period={period}
                  timeZoneLabel={trendTimeZoneLabel}
                  showTimeZoneLabel={false}
                  className="h-auto min-h-[220px]"
                />
              ) : null}

              {activityHeatmapBlock}
              {screenshotMode ? (
                <div
                  className="mt-4 flex flex-col items-center gap-2"
                  data-screenshot-exclude="true"
                  style={isCapturing ? { display: "none" } : undefined}
                >
                  <MatrixButton
                    type="button"
                    onClick={handleShareToX}
                    aria-label={screenshotTwitterLabel}
                    title={screenshotTwitterLabel}
                    className="h-12 md:h-14 px-6 text-base tracking-[0.25em]"
                    primary
                    disabled={isCapturing}
                  >
                    {screenshotTwitterButton}
                  </MatrixButton>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-matrix-muted">
                    {screenshotTwitterHint}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
              <UsagePanel
                title={copy("usage.panel.title")}
                period={period}
                periods={periodsForDisplay}
                onPeriodChange={setSelectedPeriod}
                metrics={metricsRows}
                showSummary={period === "total"}
                useSummaryLayout
                summaryLabel={summaryLabel}
                summaryValue={summaryValue}
                summaryCostValue={summaryCostValue}
                onCostInfo={costInfoEnabled ? openCostModal : null}
                breakdownCollapsed={
                  allowBreakdownToggle ? coreIndexCollapsed : true
                }
                onToggleBreakdown={
                  allowBreakdownToggle
                    ? () => setCoreIndexCollapsed((value) => !value)
                    : null
                }
                collapseLabel={
                  allowBreakdownToggle ? coreIndexCollapseLabel : undefined
                }
                expandLabel={
                  allowBreakdownToggle ? coreIndexExpandLabel : undefined
                }
                collapseAriaLabel={
                  allowBreakdownToggle ? coreIndexCollapseAria : undefined
                }
                expandAriaLabel={
                  allowBreakdownToggle ? coreIndexExpandAria : undefined
                }
                onRefresh={screenshotMode ? null : refreshAll}
                loading={usageLoadingState}
                error={usageError}
                rangeLabel={screenshotMode ? null : rangeLabel}
                rangeTimeZoneLabel={timeZoneRangeLabel}
                statusLabel={screenshotMode ? null : usageSourceLabel}
                summaryScrambleDurationMs={identityScrambleDurationMs}
                summaryAnimate={false}
              />

              <NeuralDivergenceMap
                fleetData={fleetData}
                className="min-w-0"
                footer={null}
              />

              {!screenshotMode ? (
                <AsciiBox
                  title={copy("dashboard.daily.title")}
                  subtitle={copy("dashboard.daily.subtitle")}
                >
                  {!hasDetailsActual ? (
                    <div className="text-[10px] opacity-40 mb-2">
                      {dailyEmptyPrefix}
                      <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                        {installSyncCmd}
                      </code>
                      {dailyEmptySuffix}
                    </div>
                  ) : null}
                  <div
                    className="overflow-auto max-h-[520px] border border-[#00FF41]/10"
                    role="region"
                    aria-label={copy("daily.table.aria_label")}
                    tabIndex={0}
                  >
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-black/90">
                        <tr className="border-b border-[#00FF41]/10">
                          {detailsColumns.map((c) => (
                            <th
                              key={c.key}
                              aria-sort={ariaSortFor(c.key)}
                              className="text-left p-0"
                            >
                              <button
                                type="button"
                                onClick={() => toggleSort(c.key)}
                                title={c.title}
                                className="w-full px-3 py-2 text-left text-[9px] uppercase tracking-widest font-black opacity-70 hover:opacity-100 hover:bg-[#00FF41]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF41]/30 flex items-center justify-start"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>{c.label}</span>
                                  <span className="opacity-40">
                                    {sortIconFor(c.key)}
                                  </span>
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDetails.map((r) => (
                          <tr
                            key={String(
                              r?.[detailsDateKey] ||
                                r?.day ||
                                r?.hour ||
                                r?.month ||
                                ""
                            )}
                            className={`border-b border-[#00FF41]/5 hover:bg-[#00FF41]/5 ${
                              r.missing
                                ? "text-[#00FF41]/50"
                                : r.future
                                ? "text-[#00FF41]/30"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-[12px] opacity-80 font-mono">
                              {renderDetailDate(r)}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-mono">
                              {renderDetailCell(r, "total_tokens")}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-mono">
                              {renderDetailCell(r, "input_tokens")}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-mono">
                              {renderDetailCell(r, "output_tokens")}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-mono">
                              {renderDetailCell(r, "cached_input_tokens")}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-mono">
                              {renderDetailCell(r, "reasoning_output_tokens")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {DETAILS_PAGED_PERIODS.has(period) && detailsPageCount > 1 ? (
                    <div className="flex items-center justify-between mt-3 text-[9px] uppercase tracking-widest font-black">
                      <MatrixButton
                        type="button"
                        onClick={() =>
                          setDetailsPage((prev) => Math.max(0, prev - 1))
                        }
                        disabled={detailsPage === 0}
                      >
                        {copy("details.pagination.prev")}
                      </MatrixButton>
                      <span className="opacity-50">
                        {copy("details.pagination.page", {
                          page: detailsPage + 1,
                          total: detailsPageCount,
                        })}
                      </span>
                      <MatrixButton
                        type="button"
                        onClick={() =>
                          setDetailsPage((prev) =>
                            Math.min(detailsPageCount - 1, prev + 1)
                          )
                        }
                        disabled={detailsPage + 1 >= detailsPageCount}
                      >
                        {copy("details.pagination.next")}
                      </MatrixButton>
                    </div>
                  ) : null}
                </AsciiBox>
              ) : null}
            </div>
          </div>
          </>
        )}
      </MatrixShell>
      <CostAnalysisModal
        isOpen={costModalOpen}
        onClose={closeCostModal}
        fleetData={fleetData}
      />
    </>
  );
}
