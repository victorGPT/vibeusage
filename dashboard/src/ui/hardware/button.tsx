import * as React from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"

type Tone = "primary" | "secondary"

function Button({
  tone = "secondary",
  round,
  ...props
}: React.ComponentProps<typeof SdkButton> & { tone?: Tone; round?: boolean }) {
  return <SdkButton data-kit="button" data-tone={tone} data-shape={round ? "round" : undefined} {...props} />
}

export { Button }
