import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the custom tokens so twMerge reads `text-micro` as a font size and
// `text-ink` as a color. Unregistered, both look like colors and one gets dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-2",
        "display-3",
        "heading",
        "body",
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
      color: ["ink", "ink-bright", "ink-text", "ink-muted", "ink-line", "surface"],
      tracking: ["label", "caps"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
