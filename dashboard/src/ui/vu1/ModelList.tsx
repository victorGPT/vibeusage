import type { CSSProperties } from "react";

import { copy } from "#src/lib/copy.ts";

import { abbr, cost } from "./format";
import { groupByModel } from "./grouping";
import { sourceLabel } from "./labels";
import type { ModelBreakdown } from "./types";
import "./blocks.css";

// Share is of every model, not just the ones shown.
export function ModelList({ breakdown, limit = 5 }: { breakdown: ModelBreakdown; limit?: number }) {
  const names = Object.fromEntries((breakdown.sources ?? []).map((s) => [s.source ?? "", sourceLabel(s.source ?? "")]));
  const groups = groupByModel(breakdown, names);
  let total = 0;
  for (const group of groups) {
    total += group.tokens;
  }
  return (
    <div data-vu1="lcd">
      <table data-vu1="list" data-vu1-cap="" aria-label={copy("vu1.models.aria")}>
        <thead className="sr-only">
          <tr>
            <th scope="col">{copy("vu1.models.model")}</th>
            <th scope="col" data-minor="">
              {copy("vu1.models.cli")}
            </th>
            <th scope="col" data-num="">
              {copy("vu1.models.tokens")}
            </th>
            <th scope="col" data-num="">
              {copy("vu1.models.cost")}
            </th>
            <th scope="col">{copy("vu1.models.share")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.slice(0, limit).map((group, i) => {
            const share = total ? group.tokens / total : 0;
            return (
              <tr key={group.key} data-me={i === 0 || undefined}>
                <td data-name="">{group.label}</td>
                <td data-minor="">{group.detail.join(", ")}</td>
                <td data-num="">{abbr(group.tokens)}</td>
                <td data-num="">{cost(group.cost)}</td>
                <td>
                  <span data-vu1="meter" data-minor="" aria-hidden style={{ "--share": share } as CSSProperties} />
                  {`${Math.round(share * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
