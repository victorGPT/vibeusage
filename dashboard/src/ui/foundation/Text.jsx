import React from "react";

// Text — SSOT: DESIGN.md §3 Typography + §6 Component Contracts.
// Enforces typography tokens at the component boundary.

const SIZE = {
  "display-1": "text-display-1",
  "display-2": "text-display-2",
  heading: "text-heading uppercase",
  body: "text-body",
  data: "text-data tabular-nums",
  caption: "text-caption uppercase",
  micro: "text-micro uppercase",
};

const TONE = {
  ink: "text-ink",
  "ink-bright": "text-ink-bright",
  "ink-text": "text-ink-text",
  "ink-muted": "text-ink-muted",
  "ink-line": "text-ink-line",
  "ink-faint": "text-ink-faint",
};

export function Text({
  size,
  as: Comp = "span",
  tone = "ink-text",
  glow = false,
  className = "",
  children,
  ...props
}) {
  const sizeClass = SIZE[size];
  if (!sizeClass) {
    throw new Error(
      `<Text> requires a valid size (one of ${Object.keys(SIZE).join(", ")}). Got: ${String(size)}`,
    );
  }
  const toneClass = TONE[tone] ?? TONE["ink-text"];
  const glowClass = glow ? "glow-text" : "";
  const finalClass = `${sizeClass} ${toneClass} ${glowClass} ${className}`.trim();
  return (
    <Comp className={finalClass} {...props}>
      {children}
    </Comp>
  );
}
