import { cn } from "#src/lib/utils.ts";

const TONE = {
  muted: "text-muted-foreground",
  accent: "text-primary",
  alert: "text-destructive",
  teal: "text-teal",
} as const;

export type LabelTone = keyof typeof TONE;

// SSOT: design/2049/source/Label.dc.html. One line like the source, but it ends in an ellipsis
// instead of spilling, so a long meta line cannot scroll a 390px page sideways.
export function Label({ text, tone = "muted" }: { text: string; tone?: LabelTone }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate font-sans text-label/none font-semibold tracking-label uppercase",
        TONE[tone],
      )}
    >
      {text}
    </span>
  );
}
