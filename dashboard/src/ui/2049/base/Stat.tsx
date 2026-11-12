import { cn } from "#src/lib/utils.ts";
import { Progress } from "#src/ui/shadcn/progress.tsx";

import { Label } from "./Label";

type StatProps = {
  label?: string;
  value: string;
  sub?: string;
  size?: "L" | "S";
  tone?: "light" | "amber";
  divider?: boolean;
  pct?: number;
};

// SSOT: design/2049/source/Stat.dc.html.
export function Stat({ label, value, sub, size = "L", tone = "light", divider = false, pct }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 font-sans", divider && "border-l border-border pl-4")}>
      {label ? <Label text={label} /> : null}
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "font-display whitespace-nowrap tabular-nums",
            size === "S" ? "text-value-s/none font-normal" : "text-value-l/none font-light",
            tone === "amber" ? "text-primary" : "text-hero",
          )}
        >
          {value}
        </span>
        {sub ? (
          <span className="font-display text-copy-m/none font-normal whitespace-nowrap text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </div>
      {pct === undefined ? null : <Progress value={pct} aria-label={label} />}
    </div>
  );
}
