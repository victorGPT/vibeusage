export const DETAILS_PAGE_SIZE = 12;

export function paginateRows(rows: any, page: any, pageSize = DETAILS_PAGE_SIZE) {
  const items = Array.isArray(rows) ? rows : [];
  const size = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DETAILS_PAGE_SIZE;
  const index = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const start = index * size;
  return items.slice(start, start + size);
}
