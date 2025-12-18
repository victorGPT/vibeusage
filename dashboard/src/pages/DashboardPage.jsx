import React, { useEffect, useMemo, useState } from "react";

import { buildAuthUrl } from "../lib/auth-url.js";
import { computeActiveStreakDays } from "../lib/activity-heatmap.js";
import { getDefaultRange } from "../lib/date-range.js";
import { DAILY_SORT_COLUMNS, sortDailyRows } from "../lib/daily.js";
import { toDisplayNumber } from "../lib/format.js";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap.js";
import { useUsageData } from "../hooks/use-usage-data.js";
import { Sparkline } from "../components/Sparkline.jsx";
import { AsciiBox } from "../ui/matrix-a/components/AsciiBox.jsx";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { BootScreen } from "../ui/matrix-a/components/BootScreen.jsx";
import { DataRow } from "../ui/matrix-a/components/DataRow.jsx";
import { IdentityPanel } from "../ui/matrix-a/components/IdentityPanel.jsx";
import { MatrixButton } from "../ui/matrix-a/components/MatrixButton.jsx";
import { MatrixInput } from "../ui/matrix-a/components/MatrixInput.jsx";
import { MatrixShell } from "../ui/matrix-a/layout/MatrixShell.jsx";

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

  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const { daily, summary, loading, error, refresh } = useUsageData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    from,
    to,
  });

  const {
    range: heatmapRange,
    daily: heatmapDaily,
    heatmap,
  } = useActivityHeatmap({
    baseUrl,
    accessToken: auth?.accessToken || null,
    weeks: 52,
  });

  const [sort, setSort] = useState(() => ({ key: "day", dir: "desc" }));
  const sortedDaily = useMemo(() => sortDailyRows(daily, sort), [daily, sort]);
  const sparklineRows = useMemo(
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
    if (!signedIn) return 0;
    const serverStreak = Number(heatmap?.streak_days);
    if (Number.isFinite(serverStreak)) return serverStreak;
    return computeActiveStreakDays({ dailyRows: heatmapDaily, to: heatmapRange.to });
  }, [signedIn, heatmap?.streak_days, heatmapDaily, heatmapRange.to]);

  const heatmapFrom = heatmap?.from || heatmapRange.from;
  const heatmapTo = heatmap?.to || heatmapRange.to;

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

  return (
    <MatrixShell
      headerRight={headerRight}
      footerLeft={
        signedIn ? <span>UTC aggregates • click Refresh to reload</span> : <span>Sign in to view usage</span>
      }
      footerRight={<span className="font-bold">VibeScore_Dashboard</span>}
    >
      {!signedIn ? (
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
          <div className="lg:col-span-4 flex flex-col gap-6">
            <AsciiBox title="Architect_Identity" subtitle="Authorized">
              <IdentityPanel auth={auth} streakDays={streakDays} rankLabel="—" />
            </AsciiBox>

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

            <AsciiBox title="Query" subtitle="UTC">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MatrixInput
                    label="From"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <MatrixInput
                    label="To"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <MatrixButton primary disabled={loading} onClick={refresh}>
                    {loading ? "Loading…" : "Refresh"}
                  </MatrixButton>
                  <span className="text-[9px] opacity-40 font-mono">
                    {baseUrl.replace(/^https?:\/\//, "")}
                  </span>
                </div>

                {error ? (
                  <div className="text-[10px] text-red-400/90">
                    Error: {error}
                  </div>
                ) : null}
              </div>
            </AsciiBox>

            <AsciiBox title="Metrics" subtitle="Totals">
              <div className="space-y-0.5">
                <DataRow
                  label="TOTAL"
                  value={toDisplayNumber(summary?.total_tokens)}
                  valueClassName="text-white"
                />
                <DataRow label="INPUT" value={toDisplayNumber(summary?.input_tokens)} />
                <DataRow label="OUTPUT" value={toDisplayNumber(summary?.output_tokens)} />
                <DataRow
                  label="CACHED_INPUT"
                  value={toDisplayNumber(summary?.cached_input_tokens)}
                />
                <DataRow
                  label="REASONING_OUTPUT"
                  value={toDisplayNumber(summary?.reasoning_output_tokens)}
                />
              </div>
            </AsciiBox>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            <AsciiBox
              title="Activity_Matrix"
              subtitle={signedIn ? "52W_UTC" : "—"}
            >
              <ActivityHeatmap heatmap={heatmap} />
              <div className="mt-3 text-[8px] opacity-30 uppercase tracking-widest font-black">
                Range: {heatmapFrom}..{heatmapTo}
              </div>
            </AsciiBox>

            <AsciiBox title="Sparkline" subtitle={`${from}..${to}`}>
              <Sparkline rows={sparklineRows} />
            </AsciiBox>

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
          </div>
        </div>
      )}
    </MatrixShell>
  );
}
