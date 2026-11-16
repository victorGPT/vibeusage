const navigationKeys = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])

function installInputModality() {
  document.addEventListener("pointerdown", () => (document.documentElement.dataset.modality = "pointer"), true)
  document.addEventListener(
    "keydown",
    (event) => {
      const typing = (event.target as HTMLElement).matches?.("input, textarea, [contenteditable]")
      if (event.key === "Tab" || (navigationKeys.has(event.key) && !typing)) document.documentElement.dataset.modality = "keyboard"
    },
    true,
  )
}

export { installInputModality }
