import * as React from "react"

type BarProps = React.ComponentProps<"span"> & { "data-kit": "bar-graph-bar" }

// A segmented bar graph, the kind an LED meter shows on a dark screen: a row
// of columns, each a stack of short segments. Each value, from 0 to 1, lights
// that share of its column, snapped to whole segments, and the unlit segments
// above stay faintly visible, as they do on a real display. It's one image,
// named by its label. With `bar`, each column is drawn by the caller, like a
// trigger that reads out its value, and the graph is a group of them.
function BarGraph({
  values,
  label,
  segments = 18,
  bar,
}: {
  values: number[]
  label: string
  /** How many segments a full column has. */
  segments?: number
  bar?: (props: BarProps, i: number) => React.ReactElement
}) {
  return (
    <div
      data-kit="bar-graph"
      role={bar ? "group" : "img"}
      aria-label={label}
      style={{ "--columns": values.length, "--segments": segments } as React.CSSProperties}
    >
      {values.map((value, i) => {
        const props: BarProps = { "data-kit": "bar-graph-bar", style: { "--v": Math.min(1, Math.max(0, value)) } as React.CSSProperties }
        return bar ? <React.Fragment key={i}>{bar(props, i)}</React.Fragment> : <span key={i} {...props} />
      })}
    </div>
  )
}

export { BarGraph }
