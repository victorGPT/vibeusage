import React from "react";

import { copy } from "../../../lib/copy.js";
import { formatCompactNumber } from "../../../lib/format.js";
import { TEXTURES } from "./MatrixConstants.js";

export const NeuralAdaptiveFleet = React.memo(function NeuralAdaptiveFleet({
  label,
  totalPercent,
  usage = 0,
  models = [],
}) {
  const percentSymbol = copy("shared.unit.percent");
  const thousandSuffix = copy("shared.unit.thousand_abbrev");
  const millionSuffix = copy("shared.unit.million_abbrev");
  const billionSuffix = copy("shared.unit.billion_abbrev");
  const usageValue = formatCompactNumber(usage, {
    thousandSuffix,
    millionSuffix,
    billionSuffix,
    decimals: 1,
  });
  const usageLabel = copy("dashboard.model_breakdown.usage_label", {
    value: usageValue,
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-baseline border-b border-matrix-ghost pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-heading font-black text-matrix-primary uppercase">
            {label}
          </span>
          <span className="text-caption text-matrix-muted">
            {usageLabel}
          </span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-body font-black text-matrix-primary">
            {totalPercent}
          </span>
          <span className="text-caption text-matrix-dim font-bold">
            {percentSymbol}
          </span>
        </div>
      </div>

      <div className="h-1 w-full bg-matrix-panel flex overflow-hidden relative">
        {models.map((model, index) => {
          const styleConfig = TEXTURES[index % TEXTURES.length];
          const modelKey = model?.id ? String(model.id) : `${model.name}-${index}`;
          return (
            <div
              key={modelKey}
              className="h-full relative transition-all duration-1000 ease-out border-r border-black last:border-none"
              style={{
                width: `${model.share}%`,
                backgroundColor: styleConfig.bg,
                backgroundImage: styleConfig.pattern,
                backgroundSize: styleConfig.size || "auto",
                boxShadow: index === 0 ? "0 0 10px rgba(0,255,65,0.2)" : "none",
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-6 pl-1">
        {models.map((model, index) => {
          const styleConfig = TEXTURES[index % TEXTURES.length];
          const modelKey = model?.id ? String(model.id) : `${model.name}-${index}`;
          return (
            <div
              key={modelKey}
              className="flex items-center space-x-2"
            >
              <div
                className="w-2 h-2 border border-matrix-ghost shrink-0"
                style={{
                  backgroundColor: styleConfig.bg,
                  backgroundImage: styleConfig.pattern,
                  backgroundSize: styleConfig.size || "auto",
                }}
              />
              <div className="flex items-baseline space-x-2 min-w-0">
                <span
                  className="text-caption truncate uppercase text-matrix-primary font-bold"
                  title={model.name}
                >
                  {model.name}
                </span>
                <span className="text-caption text-matrix-muted font-bold">
                  {model.share}
                  {percentSymbol}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
