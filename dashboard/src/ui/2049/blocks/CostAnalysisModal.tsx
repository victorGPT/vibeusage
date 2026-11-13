import { copy } from "#src/lib/copy.ts";
import { formatUsdCurrency, toFiniteNumber } from "#src/lib/format.ts";
import { Display } from "#src/ui/2049/base/Display.tsx";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { buttonVariants } from "#src/ui/shadcn/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "#src/ui/shadcn/dialog.tsx";

type FleetModel = { id?: string; name?: string; share?: number | string | null; calc?: string | null };
type Fleet = { label?: string; usd?: number | string | null; models?: FleetModel[] };

function usd(value: number) {
  const formatted = Number.isFinite(value) ? formatUsdCurrency(value.toFixed(6)) : "-";
  return formatted === "-" ? copy("shared.placeholder.short") : formatted;
}

function finite(value: unknown) {
  const n = toFiniteNumber(value);
  return Number.isFinite(n) ? (n as number) : null;
}

export function CostAnalysisModal({
  isOpen,
  onClose,
  fleetData = [],
}: {
  isOpen: boolean;
  onClose?: () => void;
  fleetData?: Fleet[];
}) {
  const title = copy("dashboard.cost_breakdown.title");
  const fleets = (Array.isArray(fleetData) ? fleetData : []).map((fleet) => ({
    label: fleet?.label ? String(fleet.label) : "",
    usd: finite(fleet?.usd) ?? 0,
    models: (Array.isArray(fleet?.models) ? fleet.models : []).map((model) => {
      const share = finite(model?.share);
      const calc = typeof model?.calc === "string" ? model.calc.trim() : "";
      return {
        id: model?.id ? String(model.id) : "",
        name: model?.name ? String(model.name) : "",
        share: share === null ? copy("shared.placeholder.short") : `${share}${copy("shared.unit.percent")}`,
        calc: calc ? calc.toUpperCase() : copy("dashboard.cost_breakdown.calc_dynamic"),
      };
    }),
  }));
  let total = 0;
  for (const fleet of fleets) total += fleet.usd;

  return (
    <Dialog open={!!isOpen} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent aria-label={title} className="max-w-2xl">
        <DialogTitle>{title}</DialogTitle>
        <div className="flex flex-col gap-2 border-b border-border pb-6">
          <Label text={copy("dashboard.cost_breakdown.total_label")} />
          <Display text={usd(total)} size={28} weight={300} tone="amber" glow={false} />
        </div>
        <div className="flex max-h-[45vh] flex-col gap-6 overflow-y-auto">
          {fleets.map((fleet, index) => (
            <div key={`${fleet.label}-${index}`} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
                <span className="font-sans text-copy-m/normal font-semibold tracking-label text-hero uppercase">
                  {fleet.label}
                </span>
                <span className="font-command text-copy-m/normal text-primary tabular-nums">{usd(fleet.usd)}</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {fleet.models.map((model, modelIndex) => (
                  <li
                    key={model.id || `${model.name}-${modelIndex}`}
                    className="flex justify-between gap-4 font-sans text-copy-s/normal font-medium"
                  >
                    <span className="text-foreground">{`${model.name} (${model.share})`}</span>
                    <span className="text-muted-foreground">
                      {copy("dashboard.cost_breakdown.calc_prefix")} {model.calc}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <DialogClose className={buttonVariants({ variant: "outline" })}>
            {copy("dashboard.cost_breakdown.close")}
          </DialogClose>
          <Label text={copy("dashboard.cost_breakdown.footer")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
