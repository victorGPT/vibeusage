import React from "react";

import { copy } from "../../../lib/copy.js";
import { AsciiBox } from "./AsciiBox.jsx";

export const TopModelsPanel = React.memo(function TopModelsPanel({
  rows = [],
  className = "",
}) {
  const placeholder = copy("shared.placeholder.short");
  const percentSymbol = copy("shared.unit.percent");
  const displayRows = rows.length
    ? rows
    : Array.from({ length: 3 }, () => ({
        id: "",
        name: placeholder,
        percent: placeholder,
      }));

  return (
    <AsciiBox
      title={copy("dashboard.top_models.title")}
      subtitle={copy("dashboard.top_models.subtitle")}
      className={className}
    >
      <div className="flex flex-col gap-2">
        {displayRows.map((row, index) => {
          const rankLabel = String(index + 1).padStart(2, "0");
          const name = row?.name ? String(row.name) : placeholder;
          const percent = row?.percent ? String(row.percent) : placeholder;
          const showPercentSymbol = percent !== placeholder;
          const rowKey = row?.id ? String(row.id) : `${name}-${index}`;

          return (
            <div
              key={rowKey}
              className="flex items-center justify-between border-b border-matrix-ghost py-2 px-2 last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-caption text-matrix-dim font-bold tracking-[0.28em]">
                  {rankLabel}
                </span>
                <span
                  className="text-body font-black text-matrix-primary uppercase truncate"
                  title={name}
                >
                  {name}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-body font-black text-matrix-bright">
                  {percent}
                </span>
                {showPercentSymbol ? (
                  <span className="text-caption text-matrix-dim font-bold">
                    {percentSymbol}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </AsciiBox>
  );
});
