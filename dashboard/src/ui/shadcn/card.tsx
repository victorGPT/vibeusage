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

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex items-center justify-between gap-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-sans text-[11px]/none font-semibold uppercase tracking-label text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={className} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
