import * as React from "react"

// A screen set in a device: a thick bezel around bright content. Anything
// goes inside: an image, a video, a canvas, a whole interface. An aspect of
// "auto" lets the content size the screen.
function Display({
  label,
  aspect = "16 / 10",
  children,
}: {
  label?: string
  aspect?: string
  children: React.ReactNode
}) {
  return (
    <figure data-kit="display">
      <div data-kit="display-bezel">
        <div data-kit="display-screen" style={aspect === "auto" ? undefined : { aspectRatio: aspect }}>
          {children}
        </div>
      </div>
      {label && <figcaption data-kit="display-label">{label}</figcaption>}
    </figure>
  )
}

export { Display }
