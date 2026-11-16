import * as React from "react"

// A segmented bar graph, the kind an LED meter shows on a dark screen: a row
// of columns, each a stack of short segments. Each value, from 0 to 1, lights
// that share of its column, snapped to whole segments, and the unlit segments
// above stay faintly visible, as they do on a real display. It's one image,
// named by its label.
function BarGraph({
  values,
  label,
  segments = 18,
}: {
  values: number[]
  label: string
  /** How many segments a full column has. */
  segments?: number
}) {
  return (
    <div
      data-kit="bar-graph"
      role="img"
      aria-label={label}
      style={{ "--columns": values.length, "--segments": segments } as React.CSSProperties}
    >
      {values.map((value, i) => (
        <span key={i} data-kit="bar-graph-bar" style={{ "--v": Math.min(1, Math.max(0, value)) } as React.CSSProperties} />
      ))}
    </div>
  )
}

export { BarGraph }
