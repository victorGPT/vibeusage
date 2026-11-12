import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the DESIGN.md tokens so twMerge reads `text-micro` as a font size and
// `text-ink` as a color. Unregistered, both look like colors and one gets dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-0",
        "display-1",
        "display-2",
        "display-3",
        "heading",
        "body",
        "data",
        "caption",
        "micro",
        "badge",
        "label",
        "label-lg",
        "copy-s",
        "copy-m",
        "copy-l",
        "value-s",
        "value-l",
        "heading-xs",
        "heading-s",
        "heading-m",
        "heading-l",
        "heading-xl",
        "title",
        "screen-s",
        "screen-m",
        "screen-l",
        "screen-xl",
      ],
      color: [
        "ink",
        "ink-bright",
        "ink-text",
        "ink-muted",
        "ink-line",
        "surface",
        "surface-raised",
        "surface-strong",
        "gold",
        "warn",
        "err",
      ],
      tracking: ["data", "label", "caps"],
      font: ["katakana"],
      shadow: [
        "panel",
        "glow-xs",
        "glow-sm",
        "glow",
        "glow-faint",
        "gold",
        "gold-sm",
        "gold-faint",
        "warn-glow",
        "err-glow",
      ],
      "drop-shadow": ["glow", "glow-sm", "glow-faint", "gold", "crown"],
      blur: ["panel"],
    },
  },
});

// shadcn convention: cn() merges tailwind classes resolving conflicts.
// Required by every shadcn component. SSOT remains DESIGN.md — this is just
// the className composer, not a token policy escape hatch.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
