import * as React from "react"
import { bindRepeat } from "@ui-sdk/core"
import { Button } from "@ui-sdk/react/button"
import { haptic } from "#src/ui/hardware/lib/haptics.ts"

type Part = { label: string; content: React.ReactNode; onPress: () => void; repeat?: boolean }

// Several buttons on one physical cap, like the + and − of a remote: each
// zone is its own button, divided by an engraved line. The cap is one rigid
// piece on a base, so pressing an end tilts the whole cap toward it. Zones
// marked `repeat` keep firing while held.
//
// Each zone is a UI SDK button. A repeating zone steps through core's
// bindRepeat (direct-manipulation/repeat): once on the press, then every
// 80ms after 380ms held; keys are left to the button, one press each.
function RepeatPart({ part }: { part: Part }) {
  const el = React.useRef<HTMLButtonElement>(null)
  const latest = React.useRef(part)
  latest.current = part
  React.useEffect(
    () =>
      bindRepeat(el.current!, {
        delay: 380,
        repeat: 80,
        keys: [],
        onStep: ({ count }) => {
          // Each repeat while held is felt, like a key auto-repeating; the
          // press itself is felt from its click.
          if (count > 1) haptic("selection")
          latest.current.onPress()
        },
      }),
    [],
  )
  return (
    <Button ref={el} data-kit="rocker-part" aria-label={part.label}>
      {part.content}
    </Button>
  )
}

function ButtonGroup({
  label,
  parts,
  orientation = "horizontal",
  tone = "secondary",
}: {
  label: string
  parts: Part[]
  orientation?: "horizontal" | "vertical"
  tone?: "primary" | "secondary"
}) {
  const root = React.useRef<HTMLDivElement>(null)
  // The tilt is worked out from the cap's width, so every cap's ends travel
  // the same distance whatever its length.
  React.useLayoutEffect(() => {
    const el = root.current!
    const measure = () => el.style.setProperty("--cap-w", `${el.offsetWidth}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={root} data-kit="rocker" data-orientation={orientation} data-tone={tone} role="group" aria-label={label}>
      <div data-kit="rocker-cap">
        {parts.map((part) =>
          part.repeat ? (
            <RepeatPart key={part.label} part={part} />
          ) : (
            <Button key={part.label} data-kit="rocker-part" aria-label={part.label} onClick={() => part.onPress()}>
              {part.content}
            </Button>
          ),
        )}
      </div>
    </div>
  )
}

export { ButtonGroup }
