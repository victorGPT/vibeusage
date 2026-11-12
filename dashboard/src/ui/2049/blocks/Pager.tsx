import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  paginationRange,
} from "#src/ui/shadcn/pagination.tsx";

type PagerProps = { summary: string; page: number; pageCount: number; onPageChange: (page: number) => void };

// SSOT: design/2049/source/Pagination.dc.html. The wrapper takes the margin, so Pagination keeps
// its -m-1 p-1 room for the focus ring.
export function Pager({ summary, page, pageCount, onPageChange }: PagerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label text={summary} />
      <div className="ml-auto max-w-full min-w-0">
        <Pagination aria-label={summary}>
          <PaginationContent className="w-auto flex-wrap justify-end">
            <PaginationItem>
              <PaginationLink disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                {copy("details.pagination.prev")}
              </PaginationLink>
            </PaginationItem>
            {paginationRange(page, pageCount).map((item, i) => (
              <PaginationItem key={`${item}-${i}`}>
                {item === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink isActive={item === page} onClick={() => onPageChange(item)}>
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationLink disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
                {copy("details.pagination.next")}
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
