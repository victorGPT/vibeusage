import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/ScreenFx.dc.html for the scanlines and grain, and the main-screen
// shell repeated in SpecLayout, Readout, MyRank and StateScreen for the vignette, border and
// 18px radius. One per page, around its most important number. The source has no motion.
export function ScreenFx({ children, className }: { children: ReactNode; className?: string }) {
  const grain = useId();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-input screen-shell p-6 inset-shadow-screen",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 screen-scanlines" />
        <svg className="absolute inset-0 size-full opacity-10">
          <filter id={grain}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${grain})`} />
        </svg>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
