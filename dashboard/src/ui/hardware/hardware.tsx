import * as React from "react"
import { installHardware } from "#src/ui/hardware/lib/install.ts"
import "#src/ui/hardware/hardware/skin.css"

// The root of the hardware skin. Everything inside it is styled by the skin,
// and the page-wide behaviors it relies on (haptics, sounds, keyboard-only
// focus rings, the block caret) are installed once.
//
// The key color is an OKLCH lightness, chroma and hue, as `--theme-l`,
// `--theme-c` and `--theme-h`; without them the keys are black.
function Hardware({
  keyColor,
  style,
  ...props
}: React.ComponentProps<"div"> & { keyColor?: { l: number; c: number; h: number } }) {
  React.useEffect(installHardware, [])
  const theme = keyColor && ({ "--theme-l": keyColor.l, "--theme-c": keyColor.c, "--theme-h": keyColor.h } as React.CSSProperties)
  return <div data-skin="hardware" style={{ ...theme, ...style }} {...props} />
}

export { Hardware }
