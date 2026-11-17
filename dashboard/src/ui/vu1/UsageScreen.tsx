import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import { copy } from "#src/lib/copy.ts";
import { BarGraph } from "#src/ui/hardware/bar-graph.tsx";

import { KeyTip } from "./KeyTip";

import { stepDay } from "./derive";
import { abbr, cost, num, tokens } from "./format";
import { pointLabel } from "./labels";
import type { DailyRow, DateKey, Heatmap, HeatmapCell, UsageTotals } from "./types";
import "./blocks.css";

type Tab = "usage" | "activity";

// Change against the previous period: tokens as a fraction (0.18 is +18%), cost in USD, rank
// in places climbed (negative fell).
export type UsageDelta = { tokens?: number; cost?: number; rank?: number };

type UsageScreenProps = {
  range: string;
  totals: UsageTotals;
  rank: number | null;
  delta?: UsageDelta;
  rows: DailyRow[];
  dateKey?: DateKey;
  heatmap: Heatmap;
};

const LEVELS = [0, 1, 2, 3, 4];
const SIGNS = ["−", "", "+"];
const sign = (value: number) => SIGNS[Math.sign(value) + 1];
const lit = (row: DailyRow) => (row.future ? 0 : tokens(row));

function readings(totals: UsageTotals, rank: number | null, delta: UsageDelta = {}) {
  const rankDelta = delta.rank ?? 0;
  return [
    {
      key: "tokens",
      label: copy("vu1.usage.tokens"),
      value: abbr(tokens(totals)),
      delta: delta.tokens == null ? "" : copy("vu1.usage.delta_vs_prev", { value: `${sign(delta.tokens)}${Math.round(Math.abs(delta.tokens) * 100)}%` }),
      up: (delta.tokens ?? 0) > 0,
    },
    {
      key: "cost",
      label: copy("vu1.usage.cost"),
      hint: copy("vu1.usage.cost_hint"),
      value: cost(totals.total_cost_usd),
      delta: delta.cost == null ? "" : `${sign(delta.cost)}${cost(Math.abs(delta.cost))}`,
      up: false,
    },
    {
      key: "rank",
      label: copy("vu1.usage.rank"),
      value: rank == null ? copy("shared.placeholder.short") : `#${rank}`,
      delta: rankDelta > 0 ? copy("vu1.usage.rank_up", { n: rankDelta }) : rankDelta < 0 ? copy("vu1.usage.rank_down", { n: -rankDelta }) : "",
      up: false,
    },
  ];
}

// At most five labels under the bars, first and last always among them.
function axis(rows: DailyRow[], dateKey: DateKey) {
  const count = Math.min(rows.length, rows.length <= 7 ? 7 : 5);
  if (count < 2) return rows.map((row) => pointLabel(row, dateKey));
  return Array.from({ length: count }, (_, i) => pointLabel(rows[Math.round((i * (rows.length - 1)) / (count - 1))], dateKey));
}

// One slot per unit of the period, so a week is always seven; days still to come stay unlit.
function UsageBars({ rows, dateKey }: { rows: DailyRow[]; dateKey: DateKey }) {
  const values = rows.map(lit);
  const max = Math.max(0, ...values);
  return (
    <div data-vu1="chart">
      <BarGraph
        label={copy("vu1.usage.bars_aria", { value: abbr(max) })}
        values={values.map((value) => (max ? value / max : 0))}
        segments={30}
      />
      <div data-vu1="axis" aria-hidden>
        {axis(rows, dateKey).map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

// Week-major LEDs like the board: arrow keys step a day up or down and a week left or right,
// Home and End jump to the ends, and the line under the dots reads the day out, the latest day until one is picked.
function ActivityDots({ heatmap }: { heatmap: Heatmap }) {
  const [active, setActive] = useState(null as number | null);
  const cells = heatmap.weeks.flatMap((week) => Array.from({ length: 7 }, (_, d) => week[d] ?? null));
  const current = cells[active ?? stepDay(cells, 0, "End") ?? -1];
  const dayText = (cell: HeatmapCell) => {
    if (!num(cell.value)) return copy("vu1.heat.day_none", { date: cell.day });
    return copy("vu1.heat.day", { date: cell.day, value: abbr(cell.value) });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = stepDay(cells, active ?? cells.length - 1, event.key);
    if (next == null) return;
    event.preventDefault();
    setActive(next);
  };
  return (
    <div data-vu1="heat" className="flex flex-col gap-s2">
      <div data-vu1="heat-scroll">
        <div
          role="img"
          tabIndex={0}
          aria-label={copy("vu1.heat.aria")}
          data-vu1="heat-grid"
          onFocus={() => setActive((at) => at ?? stepDay(cells, 0, "End"))}
          onKeyDown={onKeyDown}
        >
          {cells.map((cell, i) => (
            <i
              key={i}
              data-level={cell ? Math.min(4, Math.max(0, cell.level)) : undefined}
              data-cur={i === active || undefined}
              onMouseEnter={() => {
                if (cell) setActive(i);
              }}
            />
          ))}
        </div>
      </div>
      <div data-vu1="heat-read" data-vu1-cap="">
        <span aria-live="polite">{current ? dayText(current) : null}</span>
        <span data-vu1="heat-legend" aria-hidden>
          {copy("vu1.heat.less")}
          {LEVELS.map((level) => (
            <i key={level} data-level={level} />
          ))}
          {copy("vu1.heat.more")}
        </span>
      </div>
    </div>
  );
}

export function UsageScreen({ range, totals, rank, delta, rows, dateKey = "day", heatmap }: UsageScreenProps) {
  const [tab, setTab] = useState("usage" as Tab);
  return (
    <section data-vu1="screen" aria-label={copy("vu1.usage.tabs_aria")}>
      <Tabs value={tab} onValueChange={(next: unknown) => setTab(next as Tab)} data-vu1="screen-body">
        <div data-vu1="screen-head" data-vu1-cap="">
          <TabsList data-vu1="screen-tabs" aria-label={copy("vu1.usage.tabs_aria")}>
            <TabsTab value="usage">{copy("vu1.usage.tab_usage")}</TabsTab>
            <TabsTab value="activity">{copy("vu1.usage.tab_activity")}</TabsTab>
          </TabsList>
          <span data-vu1="range">{tab === "activity" ? copy("vu1.usage.range_activity") : range}</span>
        </div>
        <dl data-vu1="reads" data-vu1-cap="" className="m-0">
          {readings(totals, rank, delta).map((read) => (
            <div key={read.key} data-vu1="read">
              <dt>
                {read.hint ? (
                  <KeyTip label={read.hint}>
                    <span tabIndex={0} data-vu1="hint">
                      {read.label}
                    </span>
                  </KeyTip>
                ) : (
                  read.label
                )}
              </dt>
              <dd data-vu1="read-value">{read.value}</dd>
              <dd data-vu1="read-delta" data-up={read.up || undefined}>
                {read.delta}
              </dd>
            </div>
          ))}
        </dl>
        <TabsPanel value="usage">
          <UsageBars rows={rows} dateKey={dateKey} />
        </TabsPanel>
        <TabsPanel value="activity">
          <ActivityDots heatmap={heatmap} />
        </TabsPanel>
      </Tabs>
    </section>
  );
}
