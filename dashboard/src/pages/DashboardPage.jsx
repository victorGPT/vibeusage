import React, { useCallback, useEffect, useMemo, useState } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { computeActiveStreakDays } from "../lib/activity-heatmap.js";
import { copy } from "../lib/copy.js";
import { getRangeForPeriod } from "../lib/date-range.js";
import { getDetailsSortColumns, sortDailyRows } from "../lib/daily.js";
import {
  DETAILS_PAGE_SIZE,
  paginateRows,
  trimLeadingZeroMonths,
} from "../lib/details.js";
import {
  formatUsdCurrency,
  toDisplayNumber,
} from "../lib/format.js";
import { requestInstallLinkCode } from "../lib/vibescore-api.js";
import { buildFleetData } from "../lib/model-breakdown.js";
import { safeWriteClipboard } from "../lib/safe-browser.js";
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
import { TypewriterText } from "../ui/matrix-a/components/TypewriterText.jsx";
import { TrendMonitor } from "../ui/matrix-a/components/TrendMonitor.jsx";
import { UsagePanel } from "../ui/matrix-a/components/UsagePanel.jsx";
import { NeuralDivergenceMap } from "../ui/matrix-a/components/NeuralDivergenceMap.jsx";
import { CostAnalysisModal } from "../ui/matrix-a/components/CostAnalysisModal.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";
import { GithubStar } from "../ui/matrix-a/components/GithubStar.jsx";
import { isMockEnabled } from "../lib/mock-data.js";

const PERIODS = ["day", "week", "month", "total"];
const DETAILS_DATE_KEYS = new Set(["day", "hour", "month"]);
const DETAILS_PAGED_PERIODS = new Set(["day", "total"]);

export function DashboardPage({ baseUrl, auth, signedIn, signOut }) {
  const [booted, setBooted] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState(null);
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState(null);
  const [linkCodeLoading, setLinkCodeLoading] = useState(false);
  const [linkCodeError, setLinkCodeError] = useState(null);
  const [linkCodeExpiryTick, setLinkCodeExpiryTick] = useState(0);
  const [installCopied, setInstallCopied] = useState(false);
  const [userIdCopied, setUserIdCopied] = useState(false);
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
  }, [baseUrl, mockEnabled, signedIn, auth?.accessToken]);
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
    return () => window.clearTimeout(timeoutId);
  }, [linkCodeExpiresAt]);

  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const tzOffsetMinutes = useMemo(() => getBrowserTimeZoneOffsetMinutes(), []);
  const [period, setPeriod] = useState("week");
  const range = useMemo(
    () =>
      getRangeForPeriod(period, { timeZone, offsetMinutes: tzOffsetMinutes }),
    [period, timeZone, tzOffsetMinutes]
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
        date: new Date(),
      }),
    [timeZone, tzOffsetMinutes]
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
    deriveSummaryFromDaily: false,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
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
    sharedRows: shareDailyToTrend ? daily : null,
    sharedRange: shareDailyToTrend ? { from, to } : null,
  });

  const {
    range: heatmapRange,
    daily: heatmapDaily,
    heatmap,
    source: heatmapSource,
    loading: heatmapLoading,
    refresh: refreshHeatmap,
  } = useActivityHeatmap({
    baseUrl,
    accessToken: auth?.accessToken || null,
    weeks: 52,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
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

  const streakDays = useMemo(() => {
    if (!signedIn && !mockEnabled) return 0;
    const serverStreak = Number(heatmap?.streak_days);
    if (Number.isFinite(serverStreak)) return serverStreak;
    return computeActiveStreakDays({
      dailyRows: heatmapDaily,
      to: heatmapRange.to,
    });
  }, [
    signedIn,
    mockEnabled,
    heatmap?.streak_days,
    heatmapDaily,
    heatmapRange.to,
  ]);

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
  const heatmapSourceLabel = useMemo(
    () =>
      copy("shared.data_source", {
        source: String(heatmapSource || "edge").toUpperCase(),
      }),
    [heatmapSource]
  );

  const identityLabel = useMemo(() => {
    const raw = auth?.name?.trim();
    if (!raw || raw.includes("@")) return copy("dashboard.identity.fallback");
    return raw;
  }, [auth?.name]);

  const identityHandle = useMemo(() => {
    return identityLabel.replace(/[^a-zA-Z0-9._-]/g, "_");
  }, [identityLabel]);

  const heatmapFrom = heatmap?.from || heatmapRange.from;
  const heatmapTo = heatmap?.to || heatmapRange.to;

  const rangeLabel = useMemo(() => {
    return `${from}..${to}`;
  }, [from, period, to]);

  const summaryLabel =
    period === "total"
      ? copy("usage.summary.total_system_output")
      : copy("usage.summary.total");

  const metricsRows = useMemo(
    () => [
      {
        label: copy("usage.metric.total"),
        value: toDisplayNumber(summary?.total_tokens),
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
      summary?.total_tokens,
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
  const linkCodeExpired = useMemo(() => {
    if (!linkCodeExpiresAt) return false;
    const ts = Date.parse(linkCodeExpiresAt);
    if (!Number.isFinite(ts)) return false;
    const now = linkCodeExpiryTick || Date.now();
    return ts <= now;
  }, [linkCodeExpiresAt, linkCodeExpiryTick]);
  const resolvedLinkCode = !linkCodeExpired ? linkCode : null;
  const linkCodeMasked = resolvedLinkCode ? maskSecret(resolvedLinkCode) : null;
  const installInitCmdDisplay = resolvedLinkCode
    ? copy("dashboard.install.cmd.init_link_code", {
        link_code: linkCodeMasked,
      })
    : installInitCmdBase;
  const installInitCmdCopy = resolvedLinkCode
    ? copy("dashboard.install.cmd.init_link_code", {
        link_code: resolvedLinkCode,
      })
    : installInitCmdBase;
  const installSyncCmd = copy("dashboard.install.cmd.sync");
  const installCopyLabel = copy("dashboard.install.copy");
  const installCopiedLabel = copy("dashboard.install.copied");
  const userIdLabel = copy("dashboard.install.user_id.label");
  const userIdCopyLabel = copy("dashboard.install.user_id.copy");
  const userIdCopiedLabel = copy("dashboard.install.user_id.copied");
  const installSeenKey = "vibescore.dashboard.install.seen.v1";
  const [installSeen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(installSeenKey) === "1";
    } catch (_e) {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (installSeen) return;
    try {
      window.localStorage.setItem(installSeenKey, "1");
    } catch (_e) {
      // ignore write errors (quota/private mode)
    }
  }, [installSeen, installSeenKey]);
  const installIsEmpty = visibleDaily.length === 0;
  const shouldAnimateInstall = installIsEmpty || !installSeen;
  const installHeadline = copy("dashboard.install.headline");
  const installHeadlineDelayMs = 240;
  const installHeadlineSpeedMs = 45;
  const installBodySpeedMs = 48;
  const installBodyDelayMs =
    installHeadlineDelayMs +
    installHeadline.length * installHeadlineSpeedMs +
    240;
  const installSegments = useMemo(
    () => [
      { text: `${copy("dashboard.install.step1")} ` },
      {
        text: installInitCmdDisplay,
        className: "px-1 py-0.5 bg-black/40 border border-[#00FF41]/20",
      },
      {
        text: `\n${copy("dashboard.install.step2")}\n${copy(
          "dashboard.install.step3"
        )} `,
      },
      {
        text: installSyncCmd,
        className: "px-1 py-0.5 bg-black/40 border border-[#00FF41]/20",
      },
      { text: copy("dashboard.install.step3_suffix") },
    ],
    [installInitCmdDisplay, installSyncCmd]
  );
  const userIdMasked = auth?.userId ? maskSecret(auth.userId) : null;

  const handleCopyInstall = useCallback(async () => {
    if (!installInitCmdCopy) return;
    const didCopy = await safeWriteClipboard(installInitCmdCopy);
    if (!didCopy) return;
    setInstallCopied(true);
    window.setTimeout(() => setInstallCopied(false), 2000);
  }, [installInitCmdCopy]);

  const handleCopyUserId = useCallback(async () => {
    if (!auth?.userId) return;
    const didCopy = await safeWriteClipboard(auth.userId);
    if (!didCopy) return;
    setUserIdCopied(true);
    window.setTimeout(() => setUserIdCopied(false), 2000);
  }, [auth?.userId]);

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
      <GithubStar isFixed={false} />

      {signedIn ? (
        <>
          <span className="hidden md:block text-[10px] opacity-60 max-w-[240px] truncate">
            {identityLabel}
          </span>
          <MatrixButton onClick={signOut}>
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

  const requireAuthGate = !signedIn && !mockEnabled;

  return (
    <>
      <MatrixShell
        headerStatus={
          <BackendStatus
            baseUrl={baseUrl}
            accessToken={auth?.accessToken || null}
          />
        }
        headerRight={headerRight}
        footerLeft={
          accessEnabled ? (
            <span>
              {copy("dashboard.footer.active", { range: timeZoneRangeLabel })}
            </span>
          ) : (
            <span>{copy("dashboard.footer.auth")}</span>
          )
        }
        footerRight={
          <span className="font-bold">{copy("dashboard.footer.right")}</span>
        }
      >
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
              <IdentityCard
                title={copy("dashboard.identity.title")}
                subtitle={copy("dashboard.identity.subtitle")}
                name={identityHandle}
                isPublic
                rankLabel={copy("identity_card.rank_placeholder")}
                streakDays={streakDays}
              />

              {!signedIn ? (
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

              <AsciiBox
                title={copy("dashboard.install.title")}
                subtitle={copy("dashboard.install.subtitle")}
                className="relative"
              >
                <div className="text-[9px] uppercase tracking-[0.25em] font-black text-[#00FF41]">
                  <TypewriterText
                    text={installHeadline}
                    startDelayMs={installHeadlineDelayMs}
                    speedMs={installHeadlineSpeedMs}
                    cursor={false}
                    active={shouldAnimateInstall}
                  />
                </div>
                <TypewriterText
                  className="text-[10px] opacity-50 mt-2"
                  segments={installSegments}
                  startDelayMs={installBodyDelayMs}
                  speedMs={installBodySpeedMs}
                  cursor={false}
                  wrap
                  active={shouldAnimateInstall}
                />
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MatrixButton onClick={handleCopyInstall}>
                      {installCopied ? installCopiedLabel : installCopyLabel}
                    </MatrixButton>
                    {linkCodeLoading ? (
                      <span className="text-[9px] opacity-40">
                        {copy("dashboard.install.link_code.loading")}
                      </span>
                    ) : linkCodeError ? (
                      <span className="text-[9px] opacity-40">
                        {copy("dashboard.install.link_code.failed")}
                      </span>
                    ) : null}
                  </div>
                  {signedIn && userIdMasked ? (
                    <div className="flex flex-wrap items-center gap-2 text-[9px] opacity-60">
                      <span className="font-mono">{userIdLabel}</span>
                      <span className="font-mono">{userIdMasked}</span>
                      <MatrixButton onClick={handleCopyUserId}>
                        {userIdCopied ? userIdCopiedLabel : userIdCopyLabel}
                      </MatrixButton>
                    </div>
                  ) : null}
                </div>
              </AsciiBox>

              <AsciiBox
                title={copy("dashboard.activity.title")}
                subtitle={
                  accessEnabled ? copy("dashboard.activity.subtitle") : "—"
                }
                className="min-w-0 overflow-hidden"
              >
                <ActivityHeatmap
                  heatmap={heatmap}
                  timeZoneLabel={timeZoneLabel}
                  timeZoneShortLabel={timeZoneShortLabel}
                />
                <div className="mt-3 text-[8px] opacity-30 uppercase tracking-widest font-black">
                  {copy("dashboard.activity.range", {
                    from: heatmapFrom,
                    to: heatmapTo,
                  })}{" "}
                  {timeZoneRangeLabel}
                </div>
                <div className="mt-1 text-[8px] opacity-30 uppercase tracking-widest font-black">
                  {heatmapSourceLabel}
                </div>
              </AsciiBox>
            </div>

            <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
              <UsagePanel
                title={copy("usage.panel.title")}
                period={period}
                periods={PERIODS}
                onPeriodChange={setPeriod}
                metrics={metricsRows}
                showSummary={period === "total"}
                useSummaryLayout
                summaryLabel={summaryLabel}
                summaryValue={toDisplayNumber(summary?.total_tokens)}
                summaryCostValue={summaryCostValue}
                onCostInfo={costInfoEnabled ? openCostModal : null}
                onRefresh={refreshAll}
                loading={usageLoadingState}
                error={usageError}
                rangeLabel={rangeLabel}
                rangeTimeZoneLabel={timeZoneRangeLabel}
                statusLabel={usageSourceLabel}
              />

              <NeuralDivergenceMap fleetData={fleetData} className="min-w-0" />

              <TrendMonitor
                rows={trendRowsForDisplay}
                from={trendFromForDisplay}
                to={trendToForDisplay}
                period={period}
                timeZoneLabel={trendTimeZoneLabel}
                showTimeZoneLabel={false}
              />

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
                          <td className="px-3 py-2 text-[10px] opacity-80 font-mono">
                            {renderDetailDate(r)}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDetailCell(r, "total_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDetailCell(r, "input_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDetailCell(r, "output_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDetailCell(r, "cached_input_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
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
            </div>
          </div>
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

function maskSecret(value) {
  if (typeof value !== "string") return "";
  const s = value.trim();
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}
