import * as React from "react"

// A gray reflective LCD, the kind on a calculator or a kitchen timer: a
// recessed window of gray glass with dark print. A tag can be printed on
// the glass. Black screens show content; this one shows a reading.
function Lcd({
  tag,
  size = "md",
  children,
  ...props
}: { tag?: React.ReactNode; size?: "sm" | "md" | "lg"; children: React.ReactNode } & React.ComponentProps<"div">) {
  return (
    <div data-kit="lcd" data-size={size} {...props}>
      {tag && <span data-kit="lcd-tag">{tag}</span>}
      <div data-kit="lcd-body">{children}</div>
    </div>
  )
}

// Digits on the LCD, with their unlit segments showing faintly behind them,
// as on a real segment display. The ghost defaults to every digit as 8.
function LcdDigits({ value, ghost, ...props }: { value: string; ghost?: string } & React.ComponentProps<"span">) {
  return (
    <span data-kit="lcd-digits" {...props}>
      <span data-kit="lcd-ghost" aria-hidden>
        {ghost ?? value.replace(/[0-9]/g, "8")}
      </span>
      <span data-kit="lcd-lit">{value}</span>
    </span>
  )
}

export { Lcd, LcdDigits }
