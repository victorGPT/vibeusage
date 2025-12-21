import React, { useCallback, useEffect, useMemo, useState } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { computeActiveStreakDays } from "../lib/activity-heatmap.js";
import { getRangeForPeriod } from "../lib/date-range.js";
import { DAILY_SORT_COLUMNS, sortDailyRows } from "../lib/daily.js";
import { toDisplayNumber } from "../lib/format.js";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap.js";
import { useUsageData } from "../hooks/use-usage-data.js";
import { BackendStatus } from "../components/BackendStatus.jsx";
import { AsciiBox } from "../ui/matrix-a/components/AsciiBox.jsx";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { BootScreen } from "../ui/matrix-a/components/BootScreen.jsx";
import { IdentityCard } from "../ui/matrix-a/components/IdentityCard.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { TrendMonitor } from "../ui/matrix-a/components/TrendMonitor.jsx";
import { UsagePanel } from "../ui/matrix-a/components/UsagePanel.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";
import { isMockEnabled } from "../lib/mock-data.js";

const PERIODS = ["day", "week", "month", "total"];

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
    fetchedAt: usageFetchedAt,
    loading: usageLoading,
    error: usageError,
    refresh: refreshUsage,
  } = useUsageData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    from,
    to,
    includeDaily: period !== "total",
    cacheKey: auth?.userId || auth?.email || null,
  });

  const {
    range: heatmapRange,
    daily: heatmapDaily,
    heatmap,
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
  const trendRows = useMemo(
    () => sortDailyRows(daily, { key: "day", dir: "asc" }),
    [daily]
  );

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
  }, [refreshHeatmap, refreshUsage]);

  const usageLoadingState = usageLoading || heatmapLoading;

  const usageStatusLabel = useMemo(() => {
    if (usageSource !== "cache") return null;
    if (!usageFetchedAt) return "CACHE";
    const dt = new Date(usageFetchedAt);
    if (Number.isNaN(dt.getTime())) return "CACHE";
    const stamp = dt.toISOString().replace("T", " ").slice(0, 16);
    return `CACHE ${stamp} UTC`;
  }, [usageFetchedAt, usageSource]);

  const identityHandle = useMemo(() => {
    const raw = (auth?.name || auth?.email || "Anonymous").trim();
    const base = raw.includes("@") ? raw.split("@")[0] : raw;
    return base.replace(/[^a-zA-Z0-9._-]/g, "_");
  }, [auth?.email, auth?.name]);

  const heatmapFrom = heatmap?.from || heatmapRange.from;
  const heatmapTo = heatmap?.to || heatmapRange.to;

  const rangeLabel = useMemo(() => {
    if (period === "total") return `all-time..${to}`;
    return `${from}..${to}`;
  }, [from, period, to]);

  const summaryLabel = period === "total" ? "TOTAL_SYSTEM_OUTPUT" : "TOTAL";

  const metricsRows = useMemo(
    () => [
      {
        label: "TOTAL",
        value: toDisplayNumber(summary?.total_tokens),
        valueClassName: "text-white",
      },
      { label: "INPUT", value: toDisplayNumber(summary?.input_tokens) },
      { label: "OUTPUT", value: toDisplayNumber(summary?.output_tokens) },
      {
        label: "CACHED_INPUT",
        value: toDisplayNumber(summary?.cached_input_tokens),
      },
      {
        label: "REASONING_OUTPUT",
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

  const redirectUrl = useMemo(() => `${window.location.origin}/auth/callback`, []);
  const signInUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-in", redirectUrl }),
    [baseUrl, redirectUrl]
  );
  const signUpUrl = useMemo(
    () => buildAuthUrl({ baseUrl, path: "/auth/sign-up", redirectUrl }),
    [baseUrl, redirectUrl]
  );

  const headerRight = (
    <div className="flex items-center gap-4">
      <div className="hidden sm:flex text-[#00FF41] font-bold bg-[#00FF41]/5 px-3 py-1 border border-[#00FF41]/20 items-center space-x-4">
        <span className="opacity-40 font-normal uppercase text-[8px]">
          Session_Time:
        </span>
        <span className="text-white tracking-widest">{time}</span>
      </div>

      {signedIn ? (
        <>
          <span className="hidden md:block text-[10px] opacity-60 max-w-[240px] truncate">
            {auth?.email || auth?.name || "Signed in"}
          </span>
          <MatrixButton onClick={signOut}>Sign out</MatrixButton>
        </>
      ) : (
        <span className="text-[10px] opacity-60">Not signed in</span>
      )}
    </div>
  );

  if (!booted) {
    return <BootScreen onSkip={() => setBooted(true)} />;
  }

  const requireAuthGate = !signedIn && !mockEnabled;

  return (
    <MatrixShell
      headerStatus={<BackendStatus baseUrl={baseUrl} />}
      headerRight={headerRight}
      footerLeft={
        accessEnabled ? (
          <span>UTC aggregates • click Refresh to reload</span>
        ) : (
          <span>Sign in to view usage</span>
        )
      }
      footerRight={<span className="font-bold">VibeScore_Dashboard</span>}
    >
      {requireAuthGate ? (
        <div className="flex items-center justify-center">
          <AsciiBox
            title="Auth_Required"
            subtitle="Matrix_UI_A"
            className="w-full max-w-2xl"
          >
            <p className="text-[10px] opacity-50 mt-0">
              Sign in / sign up to view your daily token usage (UTC).
            </p>

            <div className="flex flex-wrap gap-3 mt-4">
              <MatrixButton as="a" primary href={signInUrl}>
                $ sign-in
              </MatrixButton>
              <MatrixButton as="a" href={signUpUrl}>
                $ sign-up
              </MatrixButton>
            </div>
          </AsciiBox>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
            <IdentityCard
              title="Architect_Identity"
              subtitle="Authorized"
              name={identityHandle}
              isPublic
              email={auth?.email || null}
              userId={auth?.userId || null}
              rankLabel="—"
              streakDays={streakDays}
            />

            {!signedIn ? (
              <AsciiBox title="Auth_Optional" subtitle="Connect">
                <p className="text-[10px] opacity-50 mt-0">
                  Sign in / sign up to sync real usage.
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <MatrixButton as="a" primary href={signInUrl}>
                    $ sign-in
                  </MatrixButton>
                  <MatrixButton as="a" href={signUpUrl}>
                    $ sign-up
                  </MatrixButton>
                </div>
              </AsciiBox>
            ) : null}

            <AsciiBox title="Install" subtitle="CLI">
              <p className="text-[10px] opacity-50 mt-0">
                1) run{" "}
                <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                  {installInitCmd}
                </code>
                <br />
                2) use Codex CLI normally
                <br />
                3) run{" "}
                <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                  {installSyncCmd}
                </code>{" "}
                (or wait for auto sync)
              </p>
            </AsciiBox>

            <AsciiBox
              title="Activity_Matrix"
              subtitle={accessEnabled ? "52W_UTC" : "—"}
              className="min-w-0 overflow-hidden"
            >
              <ActivityHeatmap heatmap={heatmap} />
              <div className="mt-3 text-[8px] opacity-30 uppercase tracking-widest font-black">
                Range: {heatmapFrom}..{heatmapTo}
              </div>
            </AsciiBox>

          </div>

          <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
            <UsagePanel
              title="Zion_Index"
              period={period}
              periods={PERIODS}
              onPeriodChange={setPeriod}
              metrics={metricsRows}
              showSummary={period === "total"}
              useSummaryLayout
              summaryLabel={summaryLabel}
              summaryValue={toDisplayNumber(summary?.total_tokens)}
              summarySubLabel={`SINCE ${rangeLabel}`}
              onRefresh={refreshAll}
              loading={usageLoadingState}
              error={usageError}
              rangeLabel={rangeLabel}
              statusLabel={usageStatusLabel}
            />

            <TrendMonitor
              rows={trendRows}
              label="TREND"
              from={from}
              to={to}
              period={period}
            />

            {period !== "total" ? (
              <AsciiBox title="Daily_Totals" subtitle="Sortable">
                {daily.length === 0 ? (
                  <div className="text-[10px] opacity-40">
                    No data yet. Use Codex CLI then run{" "}
                    <code className="px-1 py-0.5 bg-black/40 border border-[#00FF41]/20">
                      {installSyncCmd}
                    </code>
                    .
                  </div>
                ) : (
                  <div
                    className="overflow-auto max-h-[520px] border border-[#00FF41]/10"
                    role="region"
                    aria-label="Daily totals table"
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
                        {sortedDaily.map((r) => (
                          <tr
                            key={String(r.day)}
                            className="border-b border-[#00FF41]/5 hover:bg-[#00FF41]/5"
                          >
                            <td className="px-3 py-2 text-[10px] opacity-80 font-mono">
                              {String(r.day)}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono">
                              {toDisplayNumber(r.total_tokens)}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono">
                              {toDisplayNumber(r.input_tokens)}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono">
                              {toDisplayNumber(r.output_tokens)}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono">
                              {toDisplayNumber(r.cached_input_tokens)}
                            </td>
                            <td className="px-3 py-2 text-[10px] font-mono">
                              {toDisplayNumber(r.reasoning_output_tokens)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </AsciiBox>
            ) : null}
          </div>
        </div>
      )}
    </MatrixShell>
  );
}
