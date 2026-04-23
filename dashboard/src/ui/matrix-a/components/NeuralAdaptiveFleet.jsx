import React from "react";
import { copy } from "../../../lib/copy";
import { formatCompactNumber } from "../../../lib/format";
import { TEXTURES } from "./MatrixConstants";

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
      <div className="flex justify-between items-baseline border-b border-ink-faint pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-heading font-black text-ink uppercase">{label}</span>
          <span className="text-caption text-ink-text">{usageLabel}</span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className="text-body font-black text-ink">{totalPercent}</span>
          <span className="text-caption text-ink-muted font-bold">{percentSymbol}</span>
        </div>
      </div>

      <div className="h-1 w-full bg-surface-raised flex overflow-hidden relative">
        {models.map((model, index) => {
          const styleConfig = TEXTURES[index % TEXTURES.length];
          const modelKey = model?.id ? String(model.id) : `${model.name}-${index}`;
          return (
            <div
              key={modelKey}
              className={`h-full relative transition-all duration-1000 ease-out border-r border-surface last:border-none ${
                index === 0 ? "shadow-glow-sm" : ""
              }`}
              style={{
                width: `${model.share}%`,
                backgroundColor: styleConfig.bg,
                backgroundImage: styleConfig.pattern,
                backgroundSize: styleConfig.size || "auto",
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
            <div key={modelKey} className="flex items-center space-x-2">
              <div
                className="w-2 h-2 border border-ink-faint shrink-0"
                style={{
                  backgroundColor: styleConfig.bg,
                  backgroundImage: styleConfig.pattern,
                  backgroundSize: styleConfig.size || "auto",
                }}
              />
              <div className="flex items-baseline space-x-2 min-w-0">
                <span
                  className="text-caption truncate uppercase text-ink font-bold"
                  title={model.name}
                >
                  {model.name}
                </span>
                <span className="text-caption text-ink-text font-bold">
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
