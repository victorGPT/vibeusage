import * as React from "react"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { haptic } from "#src/ui/hardware/lib/haptics.ts"
import { Radio, RadioGroup } from "@ui-sdk/react/radio"

// A multi-position slide switch, like a radio's band selector or a pedal's
// three-way switch: a slot with a detent per option, each labeled, and a
// ribbed lever that snaps to the chosen one. Click a position, use the
// arrow keys, or drag the lever along the slot. For a few short options set
// once; it's a radio group underneath, so each position has its name.
function SlideSwitch({
  label,
  options,
  value: controlled,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  side = "end",
}: {
  label: string
  options: string[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
  /** Which side of the slot the labels print on: below or right ("end"),
   *  above or left ("start"). */
  side?: "start" | "end"
}) {
  const [stored, setStored] = React.useState(defaultValue ?? options[0])
  const value = controlled ?? stored
  const index = Math.max(0, options.indexOf(value))
  const [drag, setDrag] = React.useState<number | null>(null)
  // A tick at each detent the lever reaches, clicked or dragged.
  const choose = (next: string) => {
    setStored(next)
    if (next === value) return
    haptic("selection")
    onValueChange?.(next)
  }
  // Where the pointer is along the slot, in positions: 0 at the first
  // detent, n - 1 at the last.
  const at = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const share =
      orientation === "vertical" ? (event.clientY - box.top) / box.height : (event.clientX - box.left) / box.width
    return Math.min(options.length - 1, Math.max(0, share * options.length - 0.5))
  }
  return (
    <Field data-kit="field">
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <RadioGroup
        data-kit="slide-switch"
        data-orientation={orientation}
        data-side={orientation === "vertical" || side === "start" ? side : undefined}
        data-dragging={drag !== null || undefined}
        value={value}
        onValueChange={(next) => next && choose(String(next))}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDrag(at(event))
        }}
        onPointerMove={(event) => {
          if (drag === null) return
          const pos = at(event)
          setDrag(pos)
          choose(options[Math.round(pos)])
        }}
        onPointerUp={(event) => {
          if (drag === null) return
          choose(options[Math.round(at(event))])
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
        style={{ "--n": options.length, "--i": drag ?? index } as React.CSSProperties}
      >
        <span data-kit="slide-switch-lever" aria-hidden />
        {options.map((option) => (
          <Radio key={option} value={option} data-kit="slide-switch-stop">
            {option}
          </Radio>
        ))}
      </RadioGroup>
    </Field>
  )
}

export { SlideSwitch }
