import type { ReactNode } from "react";

import { copy } from "#src/lib/copy.ts";
import { cn } from "#src/lib/utils.ts";

// A link when there is somewhere safe to go, a plain box otherwise. Hrefs can come from uploaded
// data, so only http(s) and same-site paths become links; off-site links open in a new tab.
export function Linked({ href, className, children }: { href?: string | null; className?: string; children: ReactNode }) {
  const external = /^https?:\/\//i.test(href ?? "");
  const safe = external || /^\/(?![/\\])/.test(href ?? "");
  return safe ? (
    <a
      href={href ?? undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "block min-w-0 no-underline outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring",
        className,
      )}
    >
      {children}
      {external ? <span className="sr-only">{` ${copy("ui2049.top_nav.new_tab")}`}</span> : null}
    </a>
  ) : (
    <div className="min-w-0">{children}</div>
  );
}
