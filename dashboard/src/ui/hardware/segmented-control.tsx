import * as React from "react"
import { haptic } from "#src/ui/hardware/lib/haptics.ts"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control"

// Drag the pill across the segments: it follows the pointer, the segment
// under it is chosen as it passes, and it snaps into place on release. A
// press without movement is left to the segment's own click.
function useSegmentDrag(select: (value: string) => void) {
  const drag = React.useRef<{ x: number; id: number; moved: boolean } | null>(null)
  const segments = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-kit="segment"]')]

  const follow = (root: HTMLElement, clientX: number) => {
    const all = segments(root)
    if (!all.length) return
    const x = clientX - root.getBoundingClientRect().left
    const under = all.find((segment) => x < segment.offsetLeft + segment.offsetWidth) ?? all[all.length - 1]
    const first = all[0].offsetLeft
    const last = all[all.length - 1].offsetLeft
    const left = Math.min(last, Math.max(first, x - under.offsetWidth / 2))
    root.style.setProperty("--drag-left", `${left}px`)
    if (under.dataset.value) select(under.dataset.value)
  }

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      drag.current = { x: event.clientX, id: event.pointerId, moved: false }
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const current = drag.current
      if (!current || current.id !== event.pointerId) return
      const root = event.currentTarget
      if (!current.moved) {
        if (Math.abs(event.clientX - current.x) < 4) return
        current.moved = true
        root.setPointerCapture(event.pointerId)
        root.dataset.dragging = ""
      }
      follow(root, event.clientX)
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const root = event.currentTarget
      if (drag.current?.moved) root.releasePointerCapture(event.pointerId)
      drag.current = null
      delete root.dataset.dragging
      root.style.removeProperty("--drag-left")
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
      drag.current = null
      delete event.currentTarget.dataset.dragging
    },
  }
}

function Segmented({
  label,
  options,
  defaultValue,
  onValueChange,
}: {
  label: string
  options: string[]
  defaultValue: string
  onValueChange?: (value: string) => void
}) {
  const [value, setValue] = React.useState(defaultValue)
  const select = (next: string) => {
    setValue(next)
    if (next === value) return
    haptic("selection")
    onValueChange?.(next)
  }
  const drag = useSegmentDrag(select)
  return (
    <Field data-kit="field">
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SegmentedControl
        data-kit="segmented"
        value={value}
        onValueChange={(next) => next && select(next)}
        {...drag}
      >
        <SegmentedControlIndicator data-kit="segmented-indicator" />
        {options.map((option) => (
          <SegmentedControlItem key={option} value={option} data-kit="segment" data-value={option}>
            <span data-kit="led" aria-hidden />
            {option}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  )
}

export { Segmented }
