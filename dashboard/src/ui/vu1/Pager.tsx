import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
} from "@ui-sdk/react/pagination";

import { copy } from "#src/lib/copy.ts";
import { Icon } from "#src/ui/hardware/icon.tsx";

import { KeyTip } from "./KeyTip";
import "./blocks.css";

type PagerProps = { page: number; pageCount: number; onPageChange: (page: number) => void };

export function Pager({ page, pageCount, onPageChange }: PagerProps) {
  return (
    <Pagination
      data-kit="pagination"
      data-vu1="pager"
      aria-label={copy("vu1.pager.aria")}
      page={page}
      pageCount={pageCount}
      onPageChange={(next) => onPageChange(next)}
    >
      <PaginationList data-kit="pagination-list">
        {({ items }) => (
          <>
            <PaginationItem>
              <KeyTip label={copy("vu1.pager.prev")}>
                <PaginationPrevious data-kit="page" aria-label={copy("vu1.pager.prev")}>
                  <Icon name="prev" />
                </PaginationPrevious>
              </KeyTip>
            </PaginationItem>
            {items.map((item, i) => (
              <PaginationItem key={`${item}-${i}`}>
                {typeof item === "number" ? (
                  <PaginationLink data-kit="page" page={item} />
                ) : (
                  <PaginationEllipsis data-kit="page-gap" />
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <KeyTip label={copy("vu1.pager.next")}>
                <PaginationNext data-kit="page" aria-label={copy("vu1.pager.next")}>
                  <Icon name="next" />
                </PaginationNext>
              </KeyTip>
            </PaginationItem>
          </>
        )}
      </PaginationList>
    </Pagination>
  );
}
