import type { ComponentProps } from "react";

import { cn } from "#src/lib/utils.ts";

// SSOT: the panel style shared by design/2049/source/{Trend,Models,Projects,DailyTable}.dc.html:
// flat glass, one 1px line, 8px radius, 24px padding.
function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col gap-4 rounded-md border border-border bg-card p-6 text-foreground", className)}
      {...props}
    />
  );
}

export { Card };
