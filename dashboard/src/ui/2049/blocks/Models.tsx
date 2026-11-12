import { useState } from "react";

import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { ShareRow } from "#src/ui/2049/base/ShareRow.tsx";
import { Stamp } from "#src/ui/2049/base/Stamp.tsx";
import { Card } from "#src/ui/shadcn/card.tsx";

import { abbr, pct, range } from "./format";
import { groupByCli, groupByModel } from "./grouping";
import { cliNames } from "./shared";
import { Tabs } from "./Tabs";
import type { ModelBreakdown } from "./types";

type GroupBy = "cli" | "model";

type ModelsProps = { breakdown: ModelBreakdown; periodLabel: string; from: string; to: string; handle: string };

// SSOT: design/2049/source/Models.dc.html. The page sets the min height; rows sit flush because
// ShareRow's own padding and top rule already space the groups 24 apart.
export function Models({ breakdown, periodLabel, from, to, handle }: ModelsProps) {
  const [by, setBy] = useState("cli" as GroupBy);
  const kicker = copy("ui2049.models.kicker", { period: periodLabel });
  const byCli = by === "cli";
  const rows = byCli ? groupByCli(breakdown, cliNames()) : groupByModel(breakdown, cliNames());
  const sum = rows.reduce((total, row) => {
    return total + row.tokens;
  }, 0);
  const max = rows[0]?.tokens || 1;
  return (
    <Card role="region" aria-label={kicker} className="gap-1">
      <div className="flex items-center gap-3 pb-2">
        <Label text={kicker} />
        <div className="ml-auto">
          <Tabs
            label={copy("ui2049.models.group_aria")}
            value={by}
            items={[
              { value: "cli", label: copy("ui2049.models.by_cli") },
              { value: "model", label: copy("ui2049.models.by_model") },
            ]}
            onChange={setBy}
          />
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <ShareRow
            key={row.key}
            label={row.label}
            value={abbr(row.tokens)}
            pctText={pct(sum ? (row.tokens / sum) * 100 : 0)}
            bar={(row.tokens / max) * 100}
            sub={byCli ? row.detail.join("   ") : copy("ui2049.models.via", { names: row.detail.join(", ") })}
          />
        ))}
      </div>
      <div className="mt-auto pt-2">
        <Stamp handle={handle} range={`${periodLabel} · ${range(from, to)}`} />
      </div>
    </Card>
  );
}
