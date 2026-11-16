import { useState } from "react";

import { copy } from "../../lib/copy";
import { Device } from "../hardware/device";
import { InstallCommand } from "../vu1/InstallCommand";
import { InstallKey, ShareKey } from "../vu1/Keys";
import { ModelList } from "../vu1/ModelList";
import { MyRankLcd } from "../vu1/MyRankLcd";
import { Pager } from "../vu1/Pager";
import { PeriodSwitch } from "../vu1/PeriodSwitch";
import { RankScreen } from "../vu1/RankScreen";
import { Segment, SourceSegment } from "../vu1/SourceSegment";
import { periodOptions, pointLabel } from "../vu1/labels";
import { StateScreen } from "../vu1/StateScreen";
import { StatMinis } from "../vu1/StatMinis";
import { TopBar } from "../vu1/TopBar";
import type { DailyRow, Heatmap, LeaderboardEntry, ModelBreakdown, UsagePeriod } from "../vu1/types";
import { UpgradeToast } from "../vu1/UpgradeToast";
import { UsageScreen } from "../vu1/UsageScreen";

// Example data for the VU1 blocks, shaped like the hooks' output and laid out like the
// Dashboard and Leaderboard devices in the VU1 mock.

function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

const END = Date.UTC(2026, 10, 16);
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const ROWS: DailyRow[] = (() => {
  const next = seeded(11);
  return Array.from({ length: 7 }, (_, i) => ({ day: iso(END - (6 - i) * DAY), total_tokens: Math.round((25 + next() * 120) * 1e6) }));
})();

const HEATMAP: Heatmap = (() => {
  const next = seeded(77);
  const start = END - 363 * DAY;
  const weeks = Array.from({ length: 52 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const i = w * 7 + d;
      const x = next() * (new Date(start + i * DAY).getUTCDay() % 6 === 0 ? 0.45 : 1) * (0.5 + i / 700);
      const level = [0.12, 0.3, 0.5, 0.72].filter((cut) => x >= cut).length;
      return { day: iso(start + i * DAY), value: level ? Math.round(x * 150) * 1e6 : 0, level };
    }),
  );
  return { from: iso(start), to: iso(END), weeks };
})();

const BREAKDOWN: ModelBreakdown = {
  sources: [
    {
      source: "claude",
      totals: { total_tokens: 268e6 },
      models: [
        { model_id: "claude-opus-4-7", display_model: "Claude Opus 4.7", totals: { total_tokens: 168.9e6, total_cost_usd: 321.4 } },
        { model_id: "claude-sonnet-4-6", display_model: "Claude Sonnet 4.6", totals: { total_tokens: 86.5e6, total_cost_usd: 98.6 } },
        { model_id: "claude-haiku-4-5", display_model: "Claude Haiku 4.5", totals: { total_tokens: 12.4e6, total_cost_usd: 6.2 } },
      ],
    },
    { source: "codex", totals: { total_tokens: 98.9e6 }, models: [{ model_id: "gpt-5.2-codex", display_model: "GPT-5.2 Codex", totals: { total_tokens: 98.9e6, total_cost_usd: 108.8 } }] },
    { source: "gemini", totals: { total_tokens: 33e6 }, models: [{ model_id: "gemini-3-pro", display_model: "Gemini 3 Pro", totals: { total_tokens: 33e6, total_cost_usd: 29.7 } }] },
    { source: "kimi", totals: { total_tokens: 12.4e6 }, models: [{ model_id: "kimi-k2", display_model: "Kimi K2", totals: { total_tokens: 12.4e6, total_cost_usd: 6.2 } }] },
  ],
};

const HANDLES = ["karpathy_fan", "0xmerge", "tabs_not_spaces", "late.night.diff", "rustacean42", "yak_shaver", "ada", "prompt_goblin", "segfault_sam", "monorepo_mo"];
const ENTRIES: LeaderboardEntry[] = HANDLES.map((name, i) => {
  const total = (520 - i * 11.3) * 1e6;
  const split = [0.2, 0.7, 0.1, 0.6, 0.8, 0.3, 0.1, 0.2, 0.75, 0.25][i];
  return {
    rank: 31 + i,
    display_name: name,
    is_me: name === "ada",
    total_tokens: total,
    gpt_tokens: total * split,
    claude_tokens: total * (0.9 - split),
    other_tokens: total * 0.1,
  };
});
const ME = ENTRIES[HANDLES.indexOf("ada")];

const SOURCES = ["all", "claude", "codex", "gemini", "other"];
const SCALE: Record<string, number> = { all: 1, claude: 0.62, codex: 0.27, gemini: 0.08, other: 0.03 };
const PERIOD_SCALE: Record<UsagePeriod, number> = { day: 0.15, week: 1, month: 4.4, total: 23.6 };
const BOARDS = periodOptions().filter((option) => option.value !== "day");
const HREFS = { home: "#landing", dashboard: "#dashboard", leaderboard: "#leaderboard" };

export function BlocksVu1() {
  const [period, setPeriod] = useState("week" as UsagePeriod);
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(3);
  const [board, setBoard] = useState("week" as UsagePeriod);
  const [signedIn, setSignedIn] = useState(true);
  const k = SCALE[source] * PERIOD_SCALE[period];
  const totals = { total_tokens: 412e6 * k, total_cost_usd: 648.3 * k };
  const rows = ROWS.map((row) => ({ ...row, total_tokens: Number(row.total_tokens) * k }));
  const none = () => {};
  return (
    <div data-vu1-blocks className="col-span-12 flex flex-col gap-s7">
      <section aria-label="TopBar" data-vu1-specimen="topbar">
        <TopBar
          active="dashboard"
          signedIn={signedIn}
          hrefs={HREFS}
          githubHref={copy("vu1.top.github_href")}
          stars={130}
          onSignIn={() => setSignedIn(true)}
          onSignOut={() => setSignedIn(false)}
        />
      </section>

      <div className="grid-page">
        <div data-vu1-specimen="dashboard" className="col-span-12 lg:col-start-2 lg:col-end-12 [--device-w:100%]">
          <Device model={copy("vu1.device.model")} name={copy("vu1.device.name")}>
            <div className="grid-device gap-y-s5">
              <div className="col-span-12 flex items-center justify-center min-[761px]:col-span-2">
                <PeriodSwitch value={period} onChange={setPeriod} />
              </div>
              <div className="col-span-12 min-[761px]:col-span-8">
                <UsageScreen
                  range={`${pointLabel(ROWS[0], "day")} – ${pointLabel(ROWS[ROWS.length - 1], "day")}`}
                  totals={totals}
                  rank={37}
                  delta={{ tokens: 0.09, cost: 52.8 * k, rank: 3 }}
                  rows={rows}
                  heatmap={HEATMAP}
                />
              </div>
              <div className="col-span-12 flex items-center justify-center gap-s5 min-[761px]:col-span-2 min-[761px]:flex-col">
                <ShareKey onPress={none} />
                <InstallKey onPress={none} />
              </div>
              <div className="col-span-12 min-[761px]:col-start-3 min-[761px]:col-end-11">
                <SourceSegment sources={SOURCES} value={source} onChange={setSource} />
              </div>
              <div className="col-span-12">
                <StatMinis
                  rows={rows}
                  rolling={{
                    last_7d: { totals: { billable_total_tokens: 412e6 * SCALE[source] } },
                    last_30d: { totals: { billable_total_tokens: 1.84e9 * SCALE[source] }, avg_per_active_day: 63.4e6 * SCALE[source] },
                  }}
                />
              </div>
              <div className="col-span-12">
                <ModelList breakdown={BREAKDOWN} />
              </div>
            </div>
          </Device>
        </div>
      </div>

      <div className="grid-page">
        <div data-vu1-specimen="leaderboard" className="col-span-12 lg:col-start-3 lg:col-end-11 [--device-w:100%]">
          <Device model={copy("vu1.device.model")} name={copy("vu1.device.name")}>
            <div className="grid-device gap-y-s5">
              <div className="col-span-12 min-[761px]:col-span-6">
                <Segment label={copy("vu1.period.label")} options={BOARDS} value={board} onChange={setBoard} />
              </div>
              <div className="col-span-12 flex items-center min-[761px]:col-span-6 min-[761px]:justify-end">
                <MyRankLcd me={ME} entries={ENTRIES} />
              </div>
              <div className="col-span-12">
                <RankScreen entries={ENTRIES} me={ME} handle="ada" />
              </div>
              <div className="col-span-12">
                <Pager page={page} pageCount={392} onPageChange={setPage} />
              </div>
            </div>
          </Device>
        </div>
      </div>

      <div className="grid-page gap-y-s5">
        <section aria-label="InstallCommand" data-vu1-specimen="install" className="col-span-12 min-[761px]:col-span-6">
          <InstallCommand command={copy("landing.install.command")} />
        </section>
        <div className="col-span-12 min-[761px]:col-span-6" />
        {(["loading", "empty", "error", "signed-out"] as const).map((variant) => (
          <div key={variant} data-vu1-specimen={`state-${variant}`} className="col-span-12 min-[761px]:col-span-6">
            <StateScreen variant={variant} onRetry={none} onSignIn={none} />
          </div>
        ))}
      </div>

      <UpgradeToast requiredVersion="0.9.2" />
    </div>
  );
}
