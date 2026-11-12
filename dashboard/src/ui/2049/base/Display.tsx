import { cn } from "#src/lib/utils.ts";

const SIZE = {
  88: "text-screen-xl/none",
  76: "text-screen-l/none",
  72: "text-screen-m/none",
  64: "text-screen-s/none",
  28: "text-value-l/none",
} as const;

const WEIGHT = { 200: "font-extralight", 300: "font-light", 400: "font-normal" } as const;

const TONE = {
  light: ["text-hero", "text-shadow-display-glow"],
  amber: ["text-primary", "text-shadow-display-glow-amber"],
  alert: ["text-destructive", "text-shadow-display-glow-alert"],
} as const;

type DisplayProps = {
  text: string;
  size?: keyof typeof SIZE;
  weight?: keyof typeof WEIGHT;
  tone?: keyof typeof TONE;
  glow?: boolean;
};

// SSOT: design/2049/source/Display.dc.html. The one big number on a main screen.
export function Display({ text, size = 76, weight = 200, tone = "light", glow = true }: DisplayProps) {
  const [color, shadow] = TONE[tone];
  return (
    <div
      className={cn(
        "font-display tracking-[0.01em] tabular-nums wrap-anywhere",
        SIZE[size],
        WEIGHT[weight],
        color,
        glow && shadow,
      )}
    >
      {text}
    </div>
  );
}
