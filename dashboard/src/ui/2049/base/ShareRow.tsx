import { Progress } from "#src/ui/shadcn/progress.tsx";

import { Text } from "./Text";

type ShareRowProps = {
  label: string;
  value: string;
  pctText: string;
  bar: number;
  sub?: string;
};

// SSOT: design/2049/source/ShareRow.dc.html. One line of a share-of-total list.
export function ShareRow({ label, value, pctText, bar, sub }: ShareRowProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-border py-3 font-sans">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-auto truncate text-copy-m/[1.2] font-semibold text-hero">{label}</span>
        <span className="font-display text-copy-m/none font-normal tabular-nums text-muted-foreground">
          {value}
        </span>
        <span className="w-16 text-right font-display text-value-s/none font-normal tabular-nums text-hero">
          {pctText}
        </span>
      </div>
      <Progress value={bar} aria-label={label} />
      {sub ? <Text text={sub} size="s" tone="muted" /> : null}
    </div>
  );
}
