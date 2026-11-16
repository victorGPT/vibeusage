import { Pagination as SdkPagination, PaginationEllipsis, PaginationItem, PaginationLink, PaginationList, PaginationNext, PaginationPrevious } from "@ui-sdk/react/pagination"
import { Icon } from "#src/ui/hardware/icon.tsx"

function Pagination({ pageCount }: { pageCount: number }) {
  return (
    <SdkPagination data-kit="pagination" aria-label="Pages" pageCount={pageCount}>
      <PaginationList data-kit="pagination-list">
        {({ items }) => (
          <>
            <PaginationItem>
              <PaginationPrevious data-kit="page" aria-label="Previous page">
                <Icon name="prev" />
              </PaginationPrevious>
            </PaginationItem>
            {items.map((item) => (
              <PaginationItem key={item}>
                {typeof item === "number" ? (
                  <PaginationLink data-kit="page" page={item} />
                ) : (
                  <PaginationEllipsis data-kit="page-gap">…</PaginationEllipsis>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext data-kit="page" aria-label="Next page">
                <Icon name="next" />
              </PaginationNext>
            </PaginationItem>
          </>
        )}
      </PaginationList>
    </SdkPagination>
  )
}

export { Pagination }
