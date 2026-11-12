import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Display } from "#src/ui/2049/base/Display.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { RankRow } from "#src/ui/2049/base/RankRow.tsx";
import { ScreenFx } from "#src/ui/2049/base/ScreenFx.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Stat } from "#src/ui/2049/base/Stat.tsx";
import { Text } from "#src/ui/2049/base/Text.tsx";
import { Button } from "#src/ui/shadcn/button.tsx";

import { abbr, cost, daysBetween, full, num, pct, range, tokens } from "./format";
import { displayName, periodItems, periodLabel, SCREEN_FILL } from "./shared";
import { Tabs } from "./Tabs";
import type { LeaderboardEntry, UsagePeriod, UsageTotals } from "./types";

type ReadoutProps = {
  period: UsagePeriod;
  onPeriodChange?: (period: UsagePeriod) => void;
  totals: UsageTotals;
  from: string;
  to: string;
  // The last day with data (yyyy-mm-dd); week and month ranges end in the future.
  asOf?: string;
  handle: string;
  onCostBreakdown?: () => void;
  mode?: "dashboard" | "sample";
  board?: LeaderboardEntry[];
};

// SSOT: design/2049/source/Readout.dc.html.
export function Readout(props: ReadoutProps) {
  const { period, onPeriodChange, totals, from, to, asOf = to, handle, onCostBreakdown, mode = "dashboard" } = props;
  const sample = mode === "sample";
  const kicker = sample ? copy("ui2049.readout.sample_kicker") : copy("ui2049.readout.kicker", { period: periodLabel(period) });
  const total = tokens(totals);
  const days = Math.max(1, daysBetween(from, asOf < to ? asOf : to));
  const kinds = [
    [copy("daily.sort.input.label"), totals.input_tokens],
    [copy("daily.sort.output.label"), totals.output_tokens],
    [copy("ui2049.readout.cached"), totals.cached_input_tokens],
    [copy("daily.sort.reasoning.label"), totals.reasoning_output_tokens],
  ] as const;

  return (
    <section aria-label={kicker}>
      <ScreenFx className={cn("min-h-96", SCREEN_FILL)}>
        <div className="flex flex-auto flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Label text={kicker} />
            {sample || !onPeriodChange ? null : (
              <div className="ml-auto">
                <Tabs
                  label={copy("ui2049.readout.period_aria")}
                  value={period}
                  items={periodItems(["day", "week", "month", "total"])}
                  onChange={onPeriodChange}
                />
              </div>
            )}
          </div>
          <Display text={full(total)} size={76} />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <Display text={cost(totals.total_cost_usd)} size={28} weight={300} tone="amber" glow={false} />
            <Label text={copy("ui2049.readout.cost_label")} />
            {sample || !onCostBreakdown ? null : (
              <Button variant="outline" onClick={onCostBreakdown}>
                {copy("ui2049.readout.cost_breakdown")}
              </Button>
            )}
          </div>
          {sample ? null : <Text text={copy("ui2049.readout.per_day", { value: abbr(total / days) })} />}
          {sample ? (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <Label text={copy("ui2049.readout.board")} />
              {(props.board ?? []).slice(0, 3).map((entry) => (
                <RankRow
                  key={entry.rank}
                  rank={`#${entry.rank}`}
                  user={displayName(entry)}
                  value={abbr(entry.total_tokens)}
                  lead={entry.rank === 1}
                />
              ))}
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-4">
              {kinds.map(([label, value], i) => {
                const share = total ? (num(value) / total) * 100 : 0;
                return (
                  <div
                    key={label}
                    className={cn(
                      "min-w-0",
                      i % 2 === 1 && "border-l border-border pl-4",
                      i === 2 && "sm:border-l sm:border-border sm:pl-4",
                    )}
                  >
                    <Stat label={label} value={abbr(value)} sub={pct(share)} pct={Math.min(100, share)} />
                  </div>
                );
              })}
            </div>
          )}
          <Stamp handle={handle} range={range(from, to)} />
        </div>
      </ScreenFx>
    </section>
  );
}
