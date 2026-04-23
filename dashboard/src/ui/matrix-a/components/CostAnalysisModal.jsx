import { Dialog } from "@base-ui/react/dialog";
import React from "react";
import { copy } from "../../../lib/copy";
import { formatUsdCurrency, toFiniteNumber } from "../../../lib/format";
import { AsciiBox } from "../../foundation/AsciiBox.jsx";

function formatUsdValue(value) {
  if (!Number.isFinite(value)) return copy("shared.placeholder.short");
  const formatted = formatUsdCurrency(value.toFixed(6));
  return formatted === "-" ? copy("shared.placeholder.short") : formatted;
}

export const CostAnalysisModal = React.memo(function CostAnalysisModal({
  isOpen,
  onClose,
  fleetData = [],
}) {
  if (!isOpen) return null;

  const percentSymbol = copy("shared.unit.percent");
  const calcPrefix = copy("dashboard.cost_breakdown.calc_prefix");
  const calcFallback = copy("dashboard.cost_breakdown.calc_dynamic");

  const normalizedFleet = (Array.isArray(fleetData) ? fleetData : []).map((fleet) => {
    const usdValue = toFiniteNumber(fleet?.usd);
    const normalizedUsd = Number.isFinite(usdValue) ? usdValue : 0;
    const models = Array.isArray(fleet?.models) ? fleet.models : [];
    return {
      label: fleet?.label ? String(fleet.label) : "",
      usdValue: normalizedUsd,
      usdLabel: formatUsdValue(normalizedUsd),
      models: models.map((model) => {
        const shareValue = toFiniteNumber(model?.share);
        const shareLabel = Number.isFinite(shareValue)
          ? `${shareValue}${percentSymbol}`
          : copy("shared.placeholder.short");
        const calcRaw = typeof model?.calc === "string" ? model.calc.trim() : "";
        const calcValue = calcRaw ? calcRaw.toUpperCase() : calcFallback;
        return {
          id: model?.id ? String(model.id) : "",
          name: model?.name ? String(model.name) : "",
          shareLabel,
          calcValue,
          calcRaw,
        };
      }),
    };
  });

  const totalUsd = normalizedFleet.reduce((acc, fleet) => acc + fleet.usdValue, 0);
  const totalUsdLabel = formatUsdValue(totalUsd);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-[100] bg-surface/95 backdrop-blur-md"
          data-cost-analysis-backdrop="true"
        />
        <Dialog.Viewport className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <Dialog.Popup className="w-full max-w-2xl transform animate-in fade-in zoom-in duration-200">
            <AsciiBox title={copy("dashboard.cost_breakdown.title")}>
              <div className="space-y-8 py-4">
                <div className="text-center pb-6 border-b border-ink-faint">
                  <div className="text-caption text-ink-text uppercase mb-2 font-bold">
                    {copy("dashboard.cost_breakdown.total_label")}
                  </div>
                  <div className="text-body font-black text-gold tracking-tight glow-text-gold">
                    {totalUsdLabel}
                  </div>
                </div>

                <div className="space-y-6 max-h-[45vh] overflow-y-auto no-scrollbar pr-2">
                  {normalizedFleet.map((fleet, index) => (
                    <div key={`${fleet.label}-${index}`} className="space-y-3">
                      <div className="flex justify-between items-baseline border-b border-ink-faint pb-2">
                        <span className="text-body font-black text-ink-bright uppercase tracking-caps">
                          {fleet.label}
                        </span>
                        <span className="text-body font-bold text-gold">{fleet.usdLabel}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {fleet.models.map((model, modelIndex) => {
                          const modelKey = model?.id || `${model.name}-${modelIndex}`;
                          return (
                            <div
                              key={modelKey}
                              className="flex justify-between text-caption text-ink-text"
                            >
                              <span>
                                {model.name} ({model.shareLabel})
                              </span>
                              <span className="opacity-40">
                                {calcPrefix} {model.calcValue}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-ink-faint flex justify-between items-center">
                  <Dialog.Close
                    className="text-caption font-bold uppercase text-ink border border-ink-muted px-6 py-2 hover:bg-ink hover:text-surface transition-all"
                    type="button"
                  >
                    {copy("dashboard.cost_breakdown.close")}
                  </Dialog.Close>
                  <p className="text-caption text-ink-muted uppercase">
                    {copy("dashboard.cost_breakdown.footer")}
                  </p>
                </div>
              </div>
            </AsciiBox>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
