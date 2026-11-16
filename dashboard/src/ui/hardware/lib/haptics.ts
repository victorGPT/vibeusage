import { soundEnabled, soundFor } from "#src/ui/hardware/lib/sound.ts"

type Haptic = "selection" | "light" | "medium" | "heavy" | "soft" | "rigid" | "success" | "warning" | "error"

const patterns: Record<Haptic, number | number[]> = {
  selection: 8,
  light: 12,
  rigid: 14,
  soft: 18,
  medium: 22,
  heavy: 36,
  success: [14, 70, 22],
  warning: [24, 90, 24],
  error: [28, 60, 28, 60, 28],
}

const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function"

// Safari 17.4 added the switch; iOS 18 gave it its haptic. Where it's
// missing, the click below does nothing at all.
const hasSwitch = () => typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype

// The hidden switch, set up as iOS expects: a full-size switch inside a
// one-pixel label that clips it, nearly transparent, still in the render
// tree (iOS may skip the haptic for a switch that isn't drawn), and out of
// the way of pointers, focus and assistive technology.
let label: HTMLLabelElement | null = null
function tapSwitch() {
  if (!label) {
    label = document.createElement("label")
    label.dataset.hapticSwitch = ""
    label.inert = true
    label.setAttribute("aria-hidden", "true")
    label.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    input.tabIndex = -1
    label.append(input)
    document.body.append(label)
  }
  label.click()
}

let last = 0

// Two haptics within 30ms count as one, so a press that also moves a value,
// like clicking a slide switch's stop, is felt once, and a fast drag doesn't
// blur into a buzz, while a steady drag still ticks at every detent.
function haptic(kind: Haptic) {
  // vibeusage patch: haptics follow the key-sound switch, so both start off (VU1).
  if (typeof document === "undefined" || !soundEnabled()) return
  const now = performance.now()
  if (now - last < 30) return
  last = now
  // Every haptic also sounds (unless muted): see sound.ts.
  soundFor(kind)
  if (canVibrate()) {
    navigator.vibrate(patterns[kind])
  } else if (hasSwitch()) {
    // Outside a gesture iOS stays silent, so the switch is left alone.
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    tapSwitch()
  }
}

// Whether a value moving from `from` to `to` crosses into another step of
// `size`: a detent, for controls that turn or slide through many values.
const crosses = (from: number, to: number, size: number) => Math.floor(from / size) !== Math.floor(to / size)

// Discrete presses, felt from one listener on the page rather than in each
// part: the first selector the clicked element sits in decides the tap.
// Parts that step through values tick from their own change handlers too;
// the 30ms window keeps a click on one of them to a single tap.
const latch = (el: Element) => {
  const box = el.matches('[data-kit="checkbox"]') ? el : el.querySelector('[data-kit="checkbox"]')
  // Read before the click lands: checked now means it's about to come up.
  return box?.hasAttribute("data-checked") ? "soft" : "rigid"
}

// How far the pointer travelled between its press and the click, so a drag
// that ends on a track isn't also counted as a tap on it.
let pressed = { x: 0, y: 0 }
let moved = false

const presses: [string, Haptic | "none" | ((el: Element) => Haptic | "none")][] = [
  ['[data-kit="check"], [data-kit="checkbox"]', latch],
  ['[data-kit="switch"]', "medium"],
  ['[data-kit="dpad-zone"], [data-kit="rocker-part"]', "light"],
  ['[data-kit="jog-center"]', "medium"],
  // A tap on a slider's track or the page wheel jumps the value. Their drags
  // tick from their own handlers, and a drag's closing click isn't a tap.
  // Where the jump already ticked on the press (Android; iOS won't play a
  // haptic before the click), the click adds nothing.
  ['[data-kit="slider-control"], [data-kit="page-wheel"]', () => (moved || performance.now() - last < 200 ? "none" : "selection")],
  [
    [
      '[data-kit="segment"]',
      '[data-kit="tab"]',
      '[data-kit="radio"]',
      '[data-kit="slide-switch-stop"]',
      '[data-kit="mode-stop"]',
      '[data-kit="toggle"]',
      '[data-kit="page"]',
      '[data-kit="key-swatch"]',
      '[data-kit="item-list-row"]',
      '[data-kit="accordion-trigger"]',
      '[data-kit="menubar-trigger"]',
      '[data-kit="carousel-indicator"]',
      '[data-kit="navbar-link"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="option"]',
      '[role="gridcell"]',
    ].join(", "),
    "selection",
  ],
  ['[data-kit="button"], [data-kit="code-copy"]', (el) => (el.matches('[data-tone="primary"]') ? "medium" : "light")],
]

function installHaptics() {
  document.addEventListener(
    "pointerdown",
    (event) => {
      pressed = { x: event.clientX, y: event.clientY }
    },
    true,
  )
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null
      if (!target?.closest) return
      // The hidden switch's own clicks aren't presses.
      if (target.closest("[data-haptic-switch]")) return
      moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > 6
      for (const [selector, kind] of presses) {
        const el = target.closest(selector)
        if (!el) continue
        if (el.matches(':disabled, [aria-disabled="true"], [data-disabled]')) return
        const tap = typeof kind === "function" ? kind(el) : kind
        if (tap !== "none") haptic(tap)
        return
      }
    },
    true,
  )
}

export { crosses, haptic, installHaptics }
export type { Haptic }
