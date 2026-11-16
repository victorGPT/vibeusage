const fields = '[data-skin="hardware"] :is(input, textarea)[data-kit="input"]'
const copied = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "fontFeatureSettings",
  "letterSpacing", "wordSpacing", "lineHeight", "textTransform", "textIndent", "tabSize",
] as const

function installBlockCaret() {
  if (typeof CSS === "undefined" || CSS.supports("caret-shape", "block")) return

  const block = document.createElement("span")
  block.setAttribute("aria-hidden", "true")
  block.dataset.blockCaret = ""
  Object.assign(block.style, {
    position: "absolute",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "none",
    whiteSpace: "pre",
    textAlign: "center",
    overflow: "hidden",
  })
  const copy = document.createElement("div")
  Object.assign(copy.style, { position: "absolute", top: "0", left: "-9999px", visibility: "hidden", overflow: "hidden" })
  const marker = document.createElement("span")
  document.body.append(block, copy)

  let field: HTMLInputElement | HTMLTextAreaElement | null = null
  let ownCaret = ""

  const place = () => {
    if (!field || document.activeElement !== field) return hide()
    const { selectionStart: start, selectionEnd: end, value } = field
    if (start === null || start !== end) return void (block.style.display = "none")
    const style = getComputedStyle(field)
    const multiline = field instanceof HTMLTextAreaElement
    for (const name of copied) copy.style[name] = style[name]
    copy.style.whiteSpace = multiline ? "pre-wrap" : "pre"
    copy.style.overflowWrap = multiline ? "break-word" : "normal"
    copy.style.height = "auto"
    const under = value[start] && value[start] !== "\n" ? value[start] : " "
    copy.textContent = value.slice(0, start)
    marker.textContent = under
    copy.append(marker)

    const box = field.getBoundingClientRect()
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    const height = Math.round(parseFloat(style.fontSize) * 1.25)
    const left = box.left + marker.offsetLeft - field.scrollLeft
    const top = multiline
      ? box.top + marker.offsetTop - field.scrollTop + (lineHeight - height) / 2
      : box.top + (box.height - height) / 2
    Object.assign(block.style, {
      display: "block",
      // Viewport coordinates, measured, turned into page coordinates.
      left: `${left + window.scrollX}px`,
      top: `${top + window.scrollY}px`,
      width: `${marker.offsetWidth}px`,
      height: `${height}px`,
      lineHeight: `${height}px`,
      font: style.font,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      background: ownCaret,
      color: style.backgroundColor === "rgba(0, 0, 0, 0)" ? "#000" : style.backgroundColor,
    })
    block.textContent = under
    // Restart the blink on every move, as a native caret does.
    block.getAnimations().forEach((animation) => (animation.currentTime = 0))
    const inside = left >= box.left && left + marker.offsetWidth <= box.right && top >= box.top && top + height <= box.bottom
    block.style.visibility = inside ? "visible" : "hidden"
  }

  const hide = () => {
    block.style.display = "none"
    if (field) field.style.caretColor = ""
    field = null
  }

  document.addEventListener("focusin", (event) => {
    const target = event.target as Element
    if (!target.matches?.(fields)) return
    field = target as HTMLInputElement | HTMLTextAreaElement
    ownCaret = getComputedStyle(field).caretColor
    field.style.caretColor = "transparent"
    requestAnimationFrame(place)
  })
  document.addEventListener("focusout", (event) => event.target === field && hide())
  document.addEventListener("selectionchange", () => requestAnimationFrame(place))
  document.addEventListener("input", () => requestAnimationFrame(place), true)
  document.addEventListener("scroll", () => requestAnimationFrame(place), true)
  window.addEventListener("resize", () => requestAnimationFrame(place))
  window.visualViewport?.addEventListener("resize", () => requestAnimationFrame(place))
  window.visualViewport?.addEventListener("scroll", () => requestAnimationFrame(place))
}

export { installBlockCaret }
