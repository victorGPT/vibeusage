import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Meter.dc.html, a flat 3px amber bar on the border color.
function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn("w-full", className)} {...props}>
      <ProgressPrimitive.Track data-slot="progress-track" className="block h-0.75 w-full bg-border">
        <ProgressPrimitive.Indicator data-slot="progress-indicator" className="block h-full bg-primary" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
