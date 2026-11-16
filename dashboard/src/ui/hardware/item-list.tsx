import * as React from "react"
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox"

type Column<T> = { key: string; label: string; render: (row: T) => React.ReactNode; align?: "start" | "end"; width?: string }

// A list of items laid out as a table: rows on engraved rules in a recessed
// tray, columns aligned to one grid. The current row can carry a progress,
// 0 to 1, which it shows by filling from its left edge with a playhead at
// the front, so the row itself is its progress bar. It's a single-select
// listbox: arrow keys, Home, End and typing move through it, and Enter or a
// click chooses a row.
function ItemList<T>({
  label,
  rows,
  columns,
  rowKey,
  value,
  onValueChange,
  progress,
}: {
  label: string
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  value: string
  onValueChange: (value: string) => void
  progress?: number
}) {
  const template = columns.map((column) => column.width ?? "auto").join(" ")
  return (
    <div data-kit="item-list" style={{ "--columns": template } as React.CSSProperties}>
      <div data-kit="item-list-head" aria-hidden>
        {columns.map((column) => (
          <span key={column.key} data-align={column.align}>
            {column.label}
          </span>
        ))}
      </div>
      <Listbox aria-label={label} data-kit="item-list-body" activation="manual" value={value} onValueChange={(next) => next && onValueChange(String(next))}>
        {rows.map((row) => {
          const key = rowKey(row)
          const current = key === value
          return (
            <ListboxItem
              key={key}
              value={key}
              data-kit="item-list-row"
              style={current && progress !== undefined ? ({ "--progress": progress } as React.CSSProperties) : undefined}
              data-progress={current && progress !== undefined ? "" : undefined}
            >
              {columns.map((column) => (
                <span key={column.key} data-align={column.align}>
                  {column.render(row)}
                </span>
              ))}
            </ListboxItem>
          )
        })}
      </Listbox>
    </div>
  )
}

export { ItemList, type Column }
