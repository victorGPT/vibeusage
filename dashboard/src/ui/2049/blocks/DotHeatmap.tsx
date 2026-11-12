import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { monthLabels } from "./derive";
import { abbr, range } from "./format";
import type { Heatmap, HeatmapCell } from "./types";

// Dot diameter per level: 2 3 5 7 9 px.
const DOT = ["size-0.5", "size-0.75", "size-1.25", "size-1.75", "size-2.25"];
const LEGEND = ["size-0.5 bg-input", "size-1 bg-primary", "size-1.5 bg-primary", "size-2.25 bg-primary"];

// SSOT: design/2049/source/DotHeatmap.dc.html. Rows are 14px with no gap, the board's 12px dot
// pitch plus its 2px gap.
export function DotHeatmap({ heatmap, handle }: { heatmap: Heatmap; handle: string }) {
  const [hover, setHover] = useState(null as HeatmapCell | null);
  const title = copy("ui2049.dot_heatmap.title");
  const hoverText = (cell: HeatmapCell) => {
    return copy("ui2049.dot_heatmap.hover", { date: cell.day, value: abbr(cell.value) });
  };
  return (
    <Card role="region" aria-label={title} className="gap-3">
      <Label text={title} />
      <div className="overflow-x-auto">
        <div className="flex min-w-120 flex-col gap-2">
          <div className="grid grid-cols-12">
            {monthLabels(heatmap.weeks).map((month, i) => (
              <Label key={i} text={month} />
            ))}
          </div>
          <div
            role="img"
            aria-label={copy("ui2049.dot_heatmap.img_aria")}
            className="grid auto-cols-fr grid-flow-col grid-rows-[repeat(7,14px)]"
            onMouseLeave={() => setHover(null)}
          >
            {heatmap.weeks.flatMap((week, w) =>
              Array.from({ length: 7 }, (_, d) => {
                const cell = week[d];
                return (
                  <span
                    key={`${w}-${d}`}
                    className="flex items-center justify-center"
                    title={cell ? hoverText(cell) : undefined}
                    onMouseEnter={() => setHover(cell ?? null)}
                  >
                    {cell ? (
                      <i className={cn("rounded-full", DOT[cell.level] ?? DOT[4], cell.level ? "bg-primary" : "bg-input")} />
                    ) : null}
                  </span>
                );
              }),
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label text={hover ? hoverText(hover) : copy("ui2049.dot_heatmap.legend")} />
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
