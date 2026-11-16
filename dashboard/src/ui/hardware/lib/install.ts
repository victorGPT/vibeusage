import { installBlockCaret } from "#src/ui/hardware/lib/block-caret.ts"
import { installHaptics } from "#src/ui/hardware/lib/haptics.ts"
import { installInputModality } from "#src/ui/hardware/lib/input-modality.ts"
import { installSafariTabbing } from "#src/ui/hardware/lib/safari-tabbing.ts"
import { installSound } from "#src/ui/hardware/lib/sound.ts"

// The page-wide behaviors the skin relies on: the block caret, haptics and
// sounds, keyboard-only focus rings and Safari's Tab order. Each listens at
// the document, so they're installed once, however many roots there are.
let installed = false

function installHardware() {
  if (installed || typeof document === "undefined") return
  installed = true
  installBlockCaret()
  installHaptics()
  installSound()
  installSafariTabbing()
  installInputModality()
}

export { installHardware }
