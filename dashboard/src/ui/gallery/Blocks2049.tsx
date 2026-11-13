import { useState } from "react";
import type { ReactNode } from "react";

import { formatDateUTC } from "../../lib/date-range";
import {
  getMockLeaderboard,
  getMockNow,
  getMockProjectUsageSummary,
  getMockUsageDaily,
  getMockUsageHeatmap,
  getMockUsageModelBreakdown,
  getMockUsageSummary,
} from "../../lib/mock-data";
import { Heading } from "../2049/base/Heading";
import { Label } from "../2049/base/Label";
import { PageHeader } from "../2049/base/PageHeader";
import { DailyTable } from "../2049/blocks/DailyTable";
import { DotHeatmap } from "../2049/blocks/DotHeatmap";
import { Features } from "../2049/blocks/Features";
import { IdentityBar } from "../2049/blocks/IdentityBar";
import { LandingHero } from "../2049/blocks/LandingHero";
import { LeaderboardFilters } from "../2049/blocks/LeaderboardFilters";
import { Models } from "../2049/blocks/Models";
import { MyRank } from "../2049/blocks/MyRank";
import { Projects } from "../2049/blocks/Projects";
import { RankList } from "../2049/blocks/RankList";
import { RankRail } from "../2049/blocks/RankRail";
import { RankTable } from "../2049/blocks/RankTable";
import { Readout } from "../2049/blocks/Readout";
import { StateScreen, type StateVariant } from "../2049/blocks/StateScreen";
import { TopNav } from "../2049/blocks/TopNav";
import { Trend } from "../2049/blocks/Trend";
import type { LeaderboardEntry, LeaderboardMetric, LeaderboardPeriod, UsagePeriod } from "../2049/blocks/types";

// Every 2049 block rendered from src/lib/mock-data, laid out like the Dashboard, Leaderboard,
// Landing and States boards. Each block sits in a [data-block] section so lanes can find it.
// Dev-only; fixture strings here are JS values, never page copy.

// The mock clock is unset unless ?mock_now= is given, so fall back to the boards' own "today".
const NOW = getMockNow() ?? new Date(Date.UTC(2026, 10, 12, 12));
function day(offset: number) {
  return formatDateUTC(new Date(NOW.getTime() + offset * 86_400_000));
}
const TO = day(0);
const FROM: Record<UsagePeriod, string> = { day: TO, week: day(-6), month: day(-29), total: day(-364) };
const TOTALS = Object.fromEntries(
  (Object.keys(FROM) as UsagePeriod[]).map((p) => [p, getMockUsageSummary({ from: FROM[p], to: TO }).totals]),
) as Record<UsagePeriod, Record<string, number | string>>;
const ROLLING = getMockUsageSummary({ from: FROM.month, to: TO }).rolling;
const DAILY_30 = getMockUsageDaily({ from: FROM.month, to: TO }).data;
const DAILY_YEAR = getMockUsageDaily({ from: FROM.total, to: TO }).data;
const HEATMAP = getMockUsageHeatmap({ to: TO });
const BREAKDOWN = getMockUsageModelBreakdown({ from: FROM.total, to: TO });
const PROJECTS = getMockProjectUsageSummary({ limit: 10 }).entries;
const PROJECTS_TOTAL = PROJECTS.reduce((sum: number, e: { billable_total_tokens: string }) => sum + Number(e.billable_total_tokens), 0);
const BOARD = getMockLeaderboard({ period: "week" });
const ME = { ...BOARD.me, delta: -2 };
const HANDLE = "your_handle";
const HREF = "#__2049";
const PROFILE = (e: LeaderboardEntry) => (e.user_id ? HREF : null);
const PAGE_SIZE = 20;

// The board pages' flex rows: a 12-column grid with 16px gutters, as flex-basis.
const COL_8 = "min-w-[min(100%,480px)] flex-[1_1_calc((100%-176px)*8/12+112px)]";
const COL_6 = "min-w-[min(100%,420px)] flex-[1_1_calc((100%-176px)*6/12+80px)]";
const COL_4 = "min-w-[min(100%,300px)] flex-[1_1_calc((100%-176px)*4/12+48px)]";

const STATES: [StateVariant, string][] = [
  ["install", "Not signed in or not installed"],
  ["expired", "Session expired"],
  ["invalid", "Share link broken"],
  ["empty", "Installed, no data yet"],
  ["loading", "Loading"],
  ["error", "Service error"],
];

function Block({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <section data-block={name} className={className}>
      {children}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6" data-gallery-group={title}>
      <Heading text={title} size="s" />
      {children}
    </div>
  );
}

function ReadoutDemo() {
  const [period, setPeriod] = useState("total" as UsagePeriod);
  return (
    <Readout
      period={period}
      onPeriodChange={setPeriod}
      totals={TOTALS[period]}
      from={FROM[period]}
      to={TO}
      handle={HANDLE}
      onCostBreakdown={() => {}}
    />
  );
}

function IdentityDemo() {
  const [on, setOn] = useState(true);
  const [copied, setCopied] = useState(false);
  return (
    <IdentityBar
      handle={HANDLE}
      since={FROM.total}
      activeDays={HEATMAP.active_days}
      owner
      publicEnabled={on}
      onPublicChange={setOn}
      onCopyShareLink={() => setCopied(true)}
      shareCopied={copied}
    />
  );
}

function ProjectsDemo() {
  const [limit, setLimit] = useState(3);
  return <Projects entries={PROJECTS} totalTokens={PROJECTS_TOTAL} limit={limit} onLimitChange={setLimit} />;
}

function FiltersDemo() {
  const [period, setPeriod] = useState("week" as LeaderboardPeriod);
  const [metric, setMetric] = useState("all" as LeaderboardMetric);
  return <LeaderboardFilters period={period} onPeriodChange={setPeriod} metric={metric} onMetricChange={setMetric} />;
}

function RankTableDemo() {
  const [page, setPage] = useState(2);
  const data = getMockLeaderboard({ period: "week", limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  return (
    <RankTable
      entries={data.entries}
      me={data.me}
      handle={HANDLE}
      page={page}
      totalPages={data.total_pages}
      totalEntries={data.total_entries}
      period="week"
      onPageChange={setPage}
      onJumpToMe={() => setPage(Math.ceil((data.me.rank ?? 1) / PAGE_SIZE))}
      profileHref={PROFILE}
    />
  );
}

export function Blocks() {
  const nav = { dashboardHref: HREF, leaderboardHref: HREF, githubHref: HREF };
  return (
    <div className="flex flex-col gap-16" data-gallery="blocks">
      <Group title="Blocks · Dashboard">
        <Block name="TopNav">
          <TopNav active="dashboard" signedIn {...nav} />
        </Block>
        <Block name="IdentityBar">
          <IdentityDemo />
        </Block>
        <div className="flex flex-wrap items-stretch gap-4">
          <Block name="Readout" className={COL_8}>
            <ReadoutDemo />
          </Block>
          <Block name="RankRail" className={COL_4}>
            <RankRail
              me={ME}
              entries={BOARD.entries}
              totalEntries={BOARD.total_entries}
              from={FROM.week}
              to={TO}
              handle={HANDLE}
              leaderboardHref={HREF}
            />
          </Block>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <Block name="Models" className={`${COL_6} *:min-h-176`}>
            <Models breakdown={BREAKDOWN} periodLabel="Total" from={FROM.total} to={TO} handle={HANDLE} />
          </Block>
          <div className={`${COL_6} flex flex-col gap-4`}>
            <Block name="DotHeatmap" className="*:min-h-66">
              <DotHeatmap heatmap={HEATMAP} handle={HANDLE} />
            </Block>
            <Block name="Trend" className="*:min-h-106">
              <Trend rows={DAILY_30} period="month" rolling={ROLLING} />
            </Block>
          </div>
        </div>
        <Block name="Projects">
          <ProjectsDemo />
        </Block>
        <Block name="DailyTable">
          <DailyTable rows={DAILY_YEAR} />
        </Block>
      </Group>

      <Group title="Blocks · Leaderboard">
        <TopNav active="leaderboard" signedIn {...nav} />
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="min-w-0 flex-[1_1_360px]">
            <PageHeader title="Leaderboard" meta={`${FROM.week} → ${TO}`} />
          </div>
          <Block name="LeaderboardFilters">
            <FiltersDemo />
          </Block>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <Block name="MyRank" className={COL_8}>
            <MyRank
              me={ME}
              entries={BOARD.entries}
              totalEntries={BOARD.total_entries}
              period="week"
              from={FROM.week}
              to={TO}
              handle={HANDLE}
            />
          </Block>
          <Block name="RankList" className={COL_4}>
            <RankList entries={BOARD.entries} period="week" handle={HANDLE} profileHref={PROFILE} />
          </Block>
        </div>
        <Block name="RankTable">
          <RankTableDemo />
        </Block>
      </Group>

      <Group title="Blocks · Landing">
        <TopNav active={null} signedIn={false} {...nav} />
        <div className="flex flex-wrap items-center gap-4">
          <Block name="LandingHero" className={COL_6}>
            <LandingHero signInHref={HREF} />
          </Block>
          <Block name="Readout-sample" className={COL_6}>
            <Readout
              mode="sample"
              period="week"
              totals={TOTALS.week}
              from={FROM.week}
              to={TO}
              handle={HANDLE}
              board={BOARD.entries}
            />
          </Block>
        </div>
        <Block name="Features">
          <Features />
        </Block>
      </Group>

      <Group title="Blocks · States">
        <Block name="StateScreen" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] gap-x-4 gap-y-8">
          {STATES.map(([variant, caption]) => (
            <div key={variant} className="flex min-w-0 flex-col gap-2" data-state={variant}>
              <Label text={caption} />
              <StateScreen
                variant={variant}
                compact
                linkCode="K7Q-2049"
              />
            </div>
          ))}
        </Block>
      </Group>
    </div>
  );
}
