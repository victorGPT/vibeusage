import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Stat } from "#src/ui/2049/base/Stat.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { axisLabel, trendPath } from "./derive";
import { abbr, num, tokens } from "./format";
import { periodLabel } from "./shared";
import type { DailyRow, DateKey, UsagePeriod, UsageRolling } from "./types";

type TrendProps = { rows: DailyRow[]; dateKey?: DateKey; period: UsagePeriod; rolling?: UsageRolling };

// SSOT: design/2049/source/Trend.dc.html. Rolling windows come from the API when it sends them.
export function Trend({ rows, dateKey = "day", period, rolling }: TrendProps) {
  const kicker = copy("ui2049.trend.kicker", { period: periodLabel(period) });
  const shown = rows.filter((r) => !r.future);
  const values = shown.map(tokens);
  const sum = (list: number[]) => list.reduce((total, v) => total + v, 0);
  // Without rolling windows only daily rows can stand in for them; hours and months cannot.
  const days = dateKey === "day" ? values.slice(-30) : null;
  const last7 = rolling?.last_7d?.totals?.billable_total_tokens ?? (days && sum(days.slice(-7)));
  const last30 = rolling?.last_30d?.totals?.billable_total_tokens ?? (days && sum(days));
  const avg =
    rolling?.last_30d?.avg_per_active_day ?? (days && num(last30) / Math.max(1, days.filter(Boolean).length));
  const stat = (value: unknown) => (value == null ? copy("shared.placeholder.short") : abbr(value));
  const peakAt = values.indexOf(Math.max(0, ...values));
  const peak = abbr(values[peakAt] ?? 0);
  const label = (row: DailyRow | undefined) => {
    return axisLabel(String(row?.[dateKey] ?? ""), dateKey);
  };
  const { line, area } = trendPath(values);
  return (
    <Card role="region" aria-label={kicker}>
      <Label text={kicker} />
      <div className="grid grid-cols-3 gap-x-4">
        <Stat label={copy("ui2049.trend.last_7")} value={stat(last7)} />
        <Stat label={copy("ui2049.trend.last_30")} value={stat(last30)} divider />
        <Stat label={copy("ui2049.trend.avg")} value={stat(avg)} divider />
      </div>
      <svg
        viewBox="0 0 560 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={copy("ui2049.trend.img_aria", { value: peak })}
        className="block min-h-44 w-full flex-auto"
      >
        <line x1="0" y1="40" x2="560" y2="40" className="stroke-border" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="80" x2="560" y2="80" className="stroke-border" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="119" x2="560" y2="119" className="stroke-input" vectorEffect="non-scaling-stroke" />
        <path d={area} className="fill-primary/10" />
        <path d={line} className="fill-none stroke-primary" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between gap-2">
        <Label text={label(shown[0])} />
        <Label text={copy("ui2049.trend.peak", { value: peak, date: label(shown[peakAt]) })} />
        <Label text={label(shown[shown.length - 1])} />
      </div>
    </Card>
  );
}
