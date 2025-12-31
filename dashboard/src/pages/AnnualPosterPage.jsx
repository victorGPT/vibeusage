import React, { useMemo } from "react";

import { copy } from "../lib/copy.js";
import { formatUsdCurrency, toDisplayNumber } from "../lib/format.js";
import { useActivityHeatmap } from "../hooks/use-activity-heatmap.js";
import { useTrendData } from "../hooks/use-trend-data.js";
import { useUsageData } from "../hooks/use-usage-data.js";
import { isMockEnabled } from "../lib/mock-data.js";
import {
  formatTimeZoneLabel,
  formatTimeZoneShortLabel,
  getBrowserTimeZone,
  getBrowserTimeZoneOffsetMinutes,
} from "../lib/timezone.js";
import { ActivityHeatmap } from "../ui/matrix-a/components/ActivityHeatmap.jsx";
import { IdentityCard } from "../ui/matrix-a/components/IdentityCard.jsx";
import { TrendMonitor } from "../ui/matrix-a/components/TrendMonitor.jsx";
import { UsagePanel } from "../ui/matrix-a/components/UsagePanel.jsx";

const POSTER_YEAR = 2025;
const POSTER_FROM = `${POSTER_YEAR}-01-01`;
const POSTER_TO = `${POSTER_YEAR}-12-31`;
const POSTER_WEEK_START = "mon";

function parseIsoDate(yyyyMmDd) {
  if (typeof yyyyMmDd !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return Number.isFinite(date.getTime()) ? date : null;
}

function addUtcDays(date, days) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function diffUtcDays(a, b) {
  const ms =
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.floor(ms / 86400000);
}

function startOfWeekUtc(date, weekStartsOn) {
  const desired = weekStartsOn === "mon" ? 1 : 0;
  const dow = date.getUTCDay();
  return addUtcDays(date, -((dow - desired + 7) % 7));
}

function getWeeksForRange({ from, to, weekStartsOn }) {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 52;
  const startWeek = startOfWeekUtc(start, weekStartsOn);
  const endWeek = startOfWeekUtc(end, weekStartsOn);
  const diffDays = diffUtcDays(startWeek, endWeek);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

const POSTER_WEEKS = getWeeksForRange({
  from: POSTER_FROM,
  to: POSTER_TO,
  weekStartsOn: POSTER_WEEK_START,
});

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

export function AnnualPosterPage({ baseUrl, auth, signedIn }) {
  const mockEnabled = isMockEnabled();
  const accessEnabled = signedIn || mockEnabled;
  const posterTitle = copy("dashboard.poster.title");
  const posterAriaLabel = copy("dashboard.poster.aria_label");
  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const tzOffsetMinutes = useMemo(() => getBrowserTimeZoneOffsetMinutes(), []);
  const posterNow = useMemo(() => new Date(POSTER_YEAR, 11, 31, 12), []);

  const {
    summary,
  } = useUsageData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    from: POSTER_FROM,
    to: POSTER_TO,
    includeDaily: true,
    deriveSummaryFromDaily: false,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
    now: posterNow,
  });

  const {
    rows: trendRows,
    from: trendFrom,
    to: trendTo,
  } = useTrendData({
    baseUrl,
    accessToken: auth?.accessToken || null,
    period: "total",
    from: POSTER_FROM,
    to: POSTER_TO,
    months: 12,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
    now: posterNow,
  });

  const {
    daily: heatmapDaily,
    heatmap,
  } = useActivityHeatmap({
    baseUrl,
    accessToken: auth?.accessToken || null,
    weeks: POSTER_WEEKS,
    weekStartsOn: POSTER_WEEK_START,
    cacheKey: auth?.userId || auth?.email || "default",
    timeZone,
    tzOffsetMinutes,
    now: posterNow,
  });

  const timeZoneLabel = useMemo(
    () => formatTimeZoneLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes]
  );
  const timeZoneShortLabel = useMemo(
    () => formatTimeZoneShortLabel({ timeZone, offsetMinutes: tzOffsetMinutes }),
    [timeZone, tzOffsetMinutes]
  );

  const summaryLabel = copy("usage.summary.total");
  const summaryValue = useMemo(
    () => toDisplayNumber(summary?.total_tokens),
    [summary?.total_tokens]
  );

  const metricsRows = useMemo(
    () => [
      {
        label: copy("usage.metric.total"),
        value: toDisplayNumber(summary?.total_tokens),
        valueClassName: "text-white",
      },
    ],
    [summary?.total_tokens]
  );

  const summaryCostValue = useMemo(() => {
    const formatted = formatUsdCurrency(summary?.total_cost_usd);
    if (!formatted || formatted === "-" || formatted.startsWith("$")) {
      return formatted;
    }
    return `$${formatted}`;
  }, [summary?.total_cost_usd]);

  const activeDays = useMemo(() => {
    if (!accessEnabled) return 0;
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
        considerDay(row?.day, row?.total_tokens);
      }
    }

    const weeks = Array.isArray(heatmap?.weeks) ? heatmap.weeks : [];
    for (const week of weeks) {
      for (const cell of Array.isArray(week) ? week : []) {
        const value = cell?.value ?? cell?.total_tokens;
        considerDay(cell?.day, value, cell?.level);
      }
    }

    return count;
  }, [accessEnabled, heatmap?.active_days, heatmap?.weeks, heatmapDaily]);

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
        if (!hasUsageValue(row?.total_tokens)) continue;
        considerDay(row.day);
      }
    }

    const weeks = Array.isArray(heatmap?.weeks) ? heatmap.weeks : [];
    for (const week of weeks) {
      for (const cell of Array.isArray(week) ? week : []) {
        if (!cell?.day) continue;
        const value = cell?.value ?? cell?.total_tokens;
        const level = cell?.level;
        if (!hasUsageValue(value, level)) continue;
        considerDay(cell.day);
      }
    }

    return earliest;
  }, [heatmap?.weeks, heatmapDaily]);

  return (
    <div className="min-h-screen bg-matrix-dark text-matrix-primary font-matrix flex items-center justify-center p-6">
      <div
        id="annual-poster"
        role="img"
        aria-label={posterAriaLabel}
        className="poster-mode w-[1080px] h-[1350px] relative overflow-hidden rounded-3xl border border-matrix-ghost bg-[radial-gradient(circle_at_top,_rgba(0,255,65,0.12),_rgba(0,10,0,0.82)_45%,_rgba(0,0,0,0.96)_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute inset-0 opacity-35 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px)] bg-[length:100%_6px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,255,65,0.12),transparent_40%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(0,255,65,0.08),transparent_45%)]" />

        <div className="relative z-10 flex flex-col h-full p-10">
          <div className="flex flex-col gap-8 w-full max-w-[720px] mx-auto h-full">
            <header className="flex flex-col gap-3">
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-[-0.04em] glow-text">
                {posterTitle}
              </h1>
            </header>

            <div className="flex flex-col gap-8 flex-1">
              <div className="flex flex-col gap-8">
                <UsagePanel
                  title={copy("usage.panel.title")}
                  period="total"
                  periods={[]}
                  metrics={metricsRows}
                  showSummary
                  useSummaryLayout
                summaryLabel={summaryLabel}
                summaryValue={summaryValue}
                summaryCostValue={summaryCostValue}
                summaryAnimate={false}
                breakdownCollapsed
                hideHeader
                className="min-h-[360px]"
              />

                <div className="matrix-panel border border-matrix-ghost p-3 h-full min-h-[360px]">
                  <TrendMonitor
                    rows={trendRows}
                    from={trendFrom}
                    to={trendTo}
                    period="total"
                    timeZoneLabel={timeZoneLabel}
                    showTimeZoneLabel={false}
                    className="h-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <IdentityCard
                  title={copy("dashboard.identity.title")}
                  subtitle={copy("dashboard.identity.subtitle")}
                  name={identityHandle}
                  isPublic
                  rankLabel={
                    identityStartDate ?? copy("identity_card.rank_placeholder")
                  }
                  streakDays={activeDays}
                  animateTitle={false}
                  animate={false}
                  scanlines={false}
                  avatarSize={96}
                  className="min-h-[220px]"
                />

                <div className="matrix-panel border border-matrix-ghost p-3 flex-1">
                  <ActivityHeatmap
                    heatmap={heatmap}
                    timeZoneLabel={timeZoneLabel}
                    timeZoneShortLabel={timeZoneShortLabel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
