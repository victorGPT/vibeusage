import { useState } from "react";
import type { KeyboardEvent } from "react";

import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { monthLabels, stepDay } from "./derive";
import { abbr, range } from "./format";
import type { Heatmap, HeatmapCell } from "./types";

// Dot diameter per level: 2 3 5 7 9 px.
const DOT = ["size-0.5", "size-0.75", "size-1.25", "size-1.75", "size-2.25"];
const LEGEND = ["size-0.5 bg-input", "size-1 bg-primary", "size-1.5 bg-primary", "size-2.25 bg-primary"];

// SSOT: design/2049/source/DotHeatmap.dc.html. Rows are 14px with no gap, the board's 12px dot
// pitch plus its 2px gap. The grid is one tab stop; arrow keys walk the days and the legend line
// reads out the day under the pointer or the keyboard.
export function DotHeatmap({ heatmap, handle }: { heatmap: Heatmap; handle: string }) {
  const [active, setActive] = useState(null as number | null);
  const title = copy("ui2049.dot_heatmap.title");
  const cells = heatmap.weeks.flatMap((week) => Array.from({ length: 7 }, (_, d) => week[d] ?? null));
  const current = active == null ? null : cells[active];
  const dayText = (cell: HeatmapCell) => {
    return copy("ui2049.dot_heatmap.hover", { date: cell.day, value: abbr(cell.value) });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = stepDay(cells, active ?? cells.length - 1, event.key);
    if (next == null) return;
    event.preventDefault();
    setActive(next);
  };
  return (
    <Card role="region" aria-label={title} className="gap-3">
      <Label text={title} />
      <div className="-m-1 overflow-x-auto p-1">
        <div className="flex min-w-120 flex-col gap-2">
          <div className="grid grid-cols-12">
            {monthLabels(heatmap.weeks).map((month, i) => (
              <Label key={i} text={month} />
            ))}
          </div>
          <div
            role="img"
            tabIndex={0}
            aria-label={copy("ui2049.dot_heatmap.img_aria")}
            className="grid auto-cols-fr grid-flow-col grid-rows-[repeat(7,14px)] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(stepDay(cells, 0, "End"))}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            {cells.map((cell, i) => (
              <span
                key={i}
                className="flex items-center justify-center"
                title={cell ? dayText(cell) : undefined}
                onMouseEnter={() => setActive(cell ? i : null)}
              >
                {cell ? (
                  <i
                    className={cn(
                      "rounded-full",
                      DOT[cell.level] ?? DOT[4],
                      cell.level ? "bg-primary" : "bg-input",
                      i === active && "outline-1 outline-offset-2 outline-hero outline-solid",
                    )}
                  />
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span aria-live="polite" className="min-w-0">
          <Label text={current ? dayText(current) : copy("ui2049.dot_heatmap.legend")} />
        </span>
        <span aria-hidden="true" className="inline-flex items-center gap-2">
          {LEGEND.map((dot) => (
            <i key={dot} className={cn("rounded-full", dot)} />
          ))}
        </span>
      </div>
      <Stamp handle={handle} range={range(heatmap.from, heatmap.to)} />
    </Card>
  );
}
