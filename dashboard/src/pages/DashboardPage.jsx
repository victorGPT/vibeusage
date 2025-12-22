import React, { useCallback, useEffect, useMemo, useState } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { computeActiveStreakDays } from "../lib/activity-heatmap.js";
import { formatDateUTC, getRangeForPeriod } from "../lib/date-range.js";
import { DAILY_SORT_COLUMNS, sortDailyRows } from "../lib/daily.js";
import { toDisplayNumber } from "../lib/format.js";
import { copy } from "../lib/copy.js";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap.js";
import { useTrendData } from "../hooks/use-trend-data.js";
import { useUsageData } from "../hooks/use-usage-data.js";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { AsciiBox } from "../ui/matrix-a/components/AsciiBox.jsx";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { BootScreen } from "../ui/matrix-a/components/BootScreen.jsx";
import { IdentityCard } from "../ui/matrix-a/components/IdentityCard.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { TypewriterText } from "../ui/matrix-a/components/TypewriterText.jsx";
import { TrendMonitor } from "../ui/matrix-a/components/TrendMonitor.jsx";
import { UsagePanel } from "../ui/matrix-a/components/UsagePanel.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";
import { isMockEnabled } from "../lib/mock-data.js";

export function DashboardPage({ baseUrl, auth, signedIn, signOut }) {
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const t = window.setInterval(
      () => setTime(new Date().toLocaleTimeString()),
      1000
    );
    return () => window.clearInterval(t);
  }, []);

  const periods = useMemo(
    () => [
      { key: "day", label: copy("dashboard.period.day") },
      { key: "week", label: copy("dashboard.period.week") },
      { key: "month", label: copy("dashboard.period.month") },
      { key: "total", label: copy("dashboard.period.total") },
    ],
    []
  );

  const [period, setPeriod] = useState("week");
  const range = useMemo(() => getRangeForPeriod(period), [period]);
  const from = range.from;
  const to = range.to;
  const mockEnabled = isMockEnabled();
  const accessEnabled = signedIn || mockEnabled;

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
  });

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
  });

  const [sort, setSort] = useState(() => ({ key: "day", dir: "desc" }));
  const sortedDaily = useMemo(() => sortDailyRows(daily, sort), [daily, sort]);
  const dailyTableRows = useMemo(
    () => sortedDaily.filter((row) => !row?.future),
    [sortedDaily]
  );
  const hasDailyActual = useMemo(
    () => daily.some((row) => !row?.missing && !row?.future),
    [daily]
  );
  const dailyPlaceholder = copy("shared.placeholder");

  function renderDailyCell(row, key) {
    if (row?.future) return dailyPlaceholder;
    if (row?.missing) return toDisplayNumber(0);
    return toDisplayNumber(row?.[key]);
  }

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { key, dir: "desc" };
    });
  }

  function ariaSortFor(key) {
    if (sort.key !== key) return "none";
    return sort.dir === "asc" ? "ascending" : "descending";
  }

  function sortIconFor(key) {
    if (sort.key !== key) return "";
    return sort.dir === "asc" ? "^" : "v";
  }

  const streakDays = useMemo(() => {
    if (!signedIn && !mockEnabled) return 0;
    const serverStreak = Number(heatmap?.streak_days);
    if (Number.isFinite(serverStreak)) return serverStreak;
    return computeActiveStreakDays({ dailyRows: heatmapDaily, to: heatmapRange.to });
  }, [signedIn, mockEnabled, heatmap?.streak_days, heatmapDaily, heatmapRange.to]);

  const refreshAll = useCallback(() => {
    refreshUsage();
    refreshHeatmap();
    refreshTrend();
  }, [refreshHeatmap, refreshTrend, refreshUsage]);

  const usageLoadingState = usageLoading || heatmapLoading || trendLoading;
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

  const identityHandle = useMemo(() => {
    const fallback = copy("dashboard.identity.fallback");
    const raw = (auth?.name || auth?.email || fallback).trim();
    const base = raw.includes("@") ? raw.split("@")[0] : raw;
    return base.replace(/[^a-zA-Z0-9._-]/g, "_");
  }, [auth?.email, auth?.name]);

  const heatmapFrom = heatmap?.from || heatmapRange.from;
  const heatmapTo = heatmap?.to || heatmapRange.to;

  const rangeLabel = useMemo(() => {
    const today = formatDateUTC(new Date());
    const displayTo = to && to > today ? today : to;
    return `${from}..${displayTo}`;
  }, [from, to]);

  const summaryLabel =
    period === "total"
      ? copy("usage.summary.total_system_output")
      : copy("usage.summary.total");

  const metricsRows = useMemo(
    () => [
      {
        key: "TOTAL",
        label: copy("usage.metric.total"),
        value: toDisplayNumber(summary?.total_tokens),
        valueClassName: "text-white",
      },
      {
        key: "INPUT",
        label: copy("usage.metric.input"),
        value: toDisplayNumber(summary?.input_tokens),
      },
      {
        key: "OUTPUT",
        label: copy("usage.metric.output"),
        value: toDisplayNumber(summary?.output_tokens),
      },
      {
        key: "CACHED_INPUT",
        label: copy("usage.metric.cached_input"),
        value: toDisplayNumber(summary?.cached_input_tokens),
      },
      {
        key: "REASONING_OUTPUT",
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

  const isLocalhost = useMemo(() => {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  }, []);
  const installInitCmd = isLocalhost
    ? "node bin/tracker.js init"
    : "npx --yes @vibescore/tracker init";
  const installSyncCmd = isLocalhost
    ? "node bin/tracker.js sync"
    : "npx --yes @vibescore/tracker sync";
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
  const installIsEmpty = !hasDailyActual;
  const shouldAnimateInstall = installIsEmpty || !installSeen;
  const installHeadline = copy("dashboard.install.headline");
  const installHeadlineDelayMs = 240;
  const installHeadlineSpeedMs = 45;
  const installBodySpeedMs = 48;
  const installBodyDelayMs =
    installHeadlineDelayMs + installHeadline.length * installHeadlineSpeedMs + 240;
  const installSegments = useMemo(
    () => [
      { text: `${copy("dashboard.install.step1")} ` },
      {
        text: installInitCmd,
        className: "px-1 py-0.5 bg-black/40 border border-[#00FF41]/20",
      },
      {
        text: `\n${copy("dashboard.install.step2")}\n${copy("dashboard.install.step3")} `,
      },
      {
        text: installSyncCmd,
        className: "px-1 py-0.5 bg-black/40 border border-[#00FF41]/20",
      },
      { text: ` ${copy("dashboard.install.step3_suffix")}` },
    ],
    [installInitCmd, installSyncCmd]
  );

  const redirectUrl = useMemo(() => `${window.location.origin}/auth/callback`, []);
  const signInUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-in", redirectUrl }),
    [baseUrl, redirectUrl]
  );
  const signUpUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-up", redirectUrl }),
    [baseUrl, redirectUrl]
  );

  const dailyEmptyParts = useMemo(() => {
    const marker = "__CMD__";
    const template = copy("dashboard.daily.empty", { cmd: marker });
    const parts = template.split(marker);
    return {
      before: parts[0] ?? template,
      after: parts.length > 1 ? parts.slice(1).join(marker) : "",
    };
  }, []);

  const headerRight = (
    <div className="flex items-center gap-4">
      <div className="hidden sm:flex text-[#00FF41] font-bold bg-[#00FF41]/5 px-3 py-1 border border-[#00FF41]/20 items-center space-x-4">
        <span className="opacity-40 font-normal uppercase text-[8px]">
          {copy("dashboard.session.label")}
        </span>
        <span className="text-white tracking-widest">{time}</span>
      </div>

      {signedIn ? (
        <>
          <span className="hidden md:block text-[10px] opacity-60 max-w-[240px] truncate">
            {auth?.email || auth?.name || copy("dashboard.signed_in.fallback")}
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
    <MatrixShell
      headerStatus={<BackendStatus baseUrl={baseUrl} accessToken={auth?.accessToken || null} />}
      headerRight={headerRight}
      footerLeft={
        accessEnabled ? (
          <span>{copy("dashboard.footer.active")}</span>
        ) : (
          <span>{copy("dashboard.footer.auth")}</span>
        )
      }
      footerRight={<span className="font-bold">{copy("dashboard.footer.right")}</span>}
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
              email={auth?.email || null}
              userId={auth?.userId || null}
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
                className="text-[10px] opacity-50 mt-2 whitespace-pre"
                segments={installSegments}
                startDelayMs={installBodyDelayMs}
                speedMs={installBodySpeedMs}
                cursor={false}
                active={shouldAnimateInstall}
              />
            </AsciiBox>

            <AsciiBox
              title={copy("dashboard.activity.title")}
              subtitle={accessEnabled ? copy("dashboard.activity.subtitle") : copy("shared.placeholder")}
              className="min-w-0 overflow-hidden"
            >
              <ActivityHeatmap heatmap={heatmap} />
              <div className="mt-3 text-[8px] opacity-30 uppercase tracking-widest font-black">
                {copy("dashboard.activity.range", { from: heatmapFrom, to: heatmapTo })}
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
              periods={periods}
              onPeriodChange={setPeriod}
              metrics={metricsRows}
              showSummary={period === "total"}
              useSummaryLayout
              summaryLabel={summaryLabel}
              summaryValue={toDisplayNumber(summary?.total_tokens)}
              onRefresh={refreshAll}
              loading={usageLoadingState}
              error={usageError}
              rangeLabel={rangeLabel}
              statusLabel={usageSourceLabel}
            />

            <TrendMonitor rows={trendRows} from={trendFrom} to={trendTo} period={period} />

            {period !== "total" ? (
              <AsciiBox
                title={copy("dashboard.daily.title")}
                subtitle={copy("dashboard.daily.subtitle")}
              >
                {!hasDailyActual ? (
                  <div className="text-[10px] opacity-40 mb-2">
                    {dailyEmptyParts.before}{" "}
                    <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                      {installSyncCmd}
                    </code>
                    {dailyEmptyParts.after}
                  </div>
                ) : null}
                <div
                  className="overflow-auto max-h-[520px] border border-[#00FF41]/10"
                  role="region"
                  aria-label={copy("daily.table.aria_label")}
                  tabIndex={0}
                >
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-black/90 backdrop-blur">
                      <tr className="border-b border-[#00FF41]/10">
                        {DAILY_SORT_COLUMNS.map((c) => (
                          <th
                            key={c.key}
                            aria-sort={ariaSortFor(c.key)}
                            className="text-left p-0"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(c.key)}
                              title={c.title}
                              className="w-full px-3 py-2 text-[9px] uppercase tracking-widest font-black opacity-70 hover:opacity-100 hover:bg-[#00FF41]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF41]/30"
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
                      {dailyTableRows.map((r) => (
                        <tr
                          key={String(r.day)}
                          className={`border-b border-[#00FF41]/5 hover:bg-[#00FF41]/5 ${
                            r.missing
                              ? "text-[#00FF41]/50"
                              : r.future
                              ? "text-[#00FF41]/30"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 text-[10px] opacity-80 font-mono">
                            {String(r.day)}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDailyCell(r, "total_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDailyCell(r, "input_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDailyCell(r, "output_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDailyCell(r, "cached_input_tokens")}
                          </td>
                          <td className="px-3 py-2 text-[10px] font-mono">
                            {renderDailyCell(r, "reasoning_output_tokens")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AsciiBox>
            ) : null}
          </div>
        </div>
      )}
    </MatrixShell>
  );
}
