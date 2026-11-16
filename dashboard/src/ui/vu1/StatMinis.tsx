import { copy } from "#src/lib/copy.ts";

import { abbr, num, tokens } from "./format";
import { pointLabel } from "./labels";
import type { DailyRow, DateKey, UsageRolling } from "./types";
import "./blocks.css";

type StatMinisProps = { rows: DailyRow[]; dateKey?: DateKey; rolling?: UsageRolling };

const sum = (list: number[]) => list.reduce((total, value) => total + value, 0);

// Rolling windows come from the API when it sends them; otherwise only daily rows can stand in
// for them.
export function StatMinis({ rows, dateKey = "day", rolling }: StatMinisProps) {
  const shown = rows.filter((row) => !row.future);
  const values = shown.map(tokens);
  const days = dateKey === "day" && values.length ? values.slice(-30) : null;
  const last7 = rolling?.last_7d?.totals?.billable_total_tokens ?? (days && sum(days.slice(-7)));
  const last30 = rolling?.last_30d?.totals?.billable_total_tokens ?? (days && sum(days));
  const avg = rolling?.last_30d?.avg_per_active_day ?? (days && num(last30) / Math.max(1, days.filter(Boolean).length));
  const peakAt = values.indexOf(Math.max(0, ...values));
  const stat = (value: unknown) => (value == null ? copy("shared.placeholder.short") : abbr(value));
  const minis = [
    [copy("vu1.stats.last_7"), stat(last7)],
    [copy("vu1.stats.last_30"), stat(last30)],
    [copy("vu1.stats.avg"), stat(avg)],
    [copy("vu1.stats.peak", { date: pointLabel(shown[peakAt], dateKey) }), abbr(values[peakAt] ?? 0)],
  ];
  return (
    <div className="grid-device gap-y-s4">
      {minis.map(([label, value]) => (
        <dl key={label} data-vu1="mini" data-vu1-cap="" className="col-span-6 m-0 min-[761px]:col-span-3">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </dl>
      ))}
    </div>
  );
}
