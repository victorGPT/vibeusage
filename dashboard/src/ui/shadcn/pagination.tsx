import type { ComponentProps } from "react";

import { cn } from "#src/lib/utils.ts";
import { Button } from "#src/ui/shadcn/button.tsx";

// SSOT: design/2049/source/Pagination.dc.html. Every page is a Button: the current page is
// `default`, the rest `outline`. Prev and Next disable on the first and last page.

type PageItem = number | "ellipsis";

// First, current ±1 and last, with an ellipsis wherever pages are skipped.
function paginationRange(page: number, total: number): PageItem[] {
  const pages = [...new Set([1, page - 1, page, page + 1, total])]
    .filter((n) => Math.min(Math.max(n, 1), total) === n)
    .sort((a, b) => a - b);
  return pages.flatMap((n, i): PageItem[] => (i > 0 && n - pages[i - 1] > 1 ? ["ellipsis", n] : [n]));
}

function Pagination({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav data-slot="pagination" className={cn("w-full overflow-x-auto", className)} {...props} />
  );
}

function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("flex w-max items-center gap-1", className)} {...props} />;
}

function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

function PaginationLink({
  isActive,
  ...props
}: ComponentProps<typeof Button> & { isActive?: boolean }) {
  return (
    <Button
      data-slot="pagination-link"
      variant={isActive ? "default" : "outline"}
      aria-current={isActive ? "page" : undefined}
      {...props}
    />
  );
}

function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "inline-flex h-control items-center border border-transparent px-4 font-sans text-[11px]/none font-semibold text-foreground opacity-45",
        className,
      )}
      {...props}
    >
      {"…"}
    </span>
  );
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, paginationRange };
export type { PageItem };
