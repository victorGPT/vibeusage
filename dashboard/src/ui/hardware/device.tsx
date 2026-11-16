import * as React from "react"
import "#src/ui/hardware/hardware/devices.css"

// A device's body: one molded off-white shell with its model printed small in
// the corner beside a power LED. Each demo lays out its controls inside.
//
// A device keeps its own size, as hardware does. Where the page is narrower,
// as on a phone, the whole device is zoomed down to fit rather than
// reflowed, so its layout stays as designed. Zoom changes layout, so the
// page's height follows.
// The maker's plate: a power LED, the model and the name, printed small. A
// device prints it in its top corner, or, given `plate="none"`, places it
// itself, as `under` a screen, centered, the way a handheld is marked.
function DevicePlate({ model, name, on = true, under }: { model: string; name: string; on?: boolean; under?: boolean }) {
  return (
    <header data-device-plate data-under={under || undefined}>
      <span data-device-power data-on={on || undefined} aria-hidden />
      <strong>{model}</strong>
      <span>{name}</span>
    </header>
  )
}

function Device({
  model,
  name,
  on = true,
  plate = "top",
  children,
}: {
  model: string
  name: string
  on?: boolean
  /** "none" when the device places its own <DevicePlate>. */
  plate?: "top" | "none"
  children: React.ReactNode
}) {
  const body = React.useRef<HTMLElement>(null)
  React.useLayoutEffect(() => {
    const el = body.current!
    const page = el.parentElement!
    el.style.maxWidth = "none"
    let width = -1
    const fit = () => {
      // Only a change of the page's width refits; zooming changes its height.
      if (page.clientWidth === width) return
      width = page.clientWidth
      el.style.zoom = ""
      const style = getComputedStyle(page)
      const room = width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (room > 0 && el.offsetWidth > room) el.style.zoom = String(room / el.offsetWidth)
    }
    fit()
    // Refits wait a frame: zooming inside the observer's callback would
    // resize the page it's watching before the callback returns.
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    })
    observer.observe(page)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return (
    <section ref={body} data-device aria-label={name}>
      {plate === "top" && <DevicePlate model={model} name={name} on={on} />}
      {children}
    </section>
  )
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

export { Device, DevicePlate, clock }
