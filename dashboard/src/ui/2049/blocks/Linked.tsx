import type { ReactNode } from "react";

import { cn } from "#src/lib/utils.ts";

// A link when there is somewhere to go, a plain box otherwise.
export function Linked({ href, className, children }: { href?: string | null; className?: string; children: ReactNode }) {
  return href ? (
    <a
      href={href}
      className={cn(
        "block min-w-0 no-underline outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </a>
  ) : (
    <div className="min-w-0">{children}</div>
  );
}
