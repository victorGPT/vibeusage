import type { CSSProperties } from "react";

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

// Main-screen totals step down to fit their card on one line; ranks are short and sit beside a Delta.
const FIT = { 76: "--text-screen-l", 64: "--text-screen-s" } as const;

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
  const fit = size in FIT ? FIT[size as keyof typeof FIT] : null;
  const number = (
    <div
      className={cn(
        "font-display tracking-[0.01em] tabular-nums wrap-anywhere",
        SIZE[size],
        fit && "text-[length:min(var(--fit-max),calc(100cqi/var(--fit-chars)*1.6))]/none",
        WEIGHT[weight],
        color,
        glow && shadow,
      )}
      style={fit ? ({ "--fit-max": `var(${fit})`, "--fit-chars": text.length } as CSSProperties) : undefined}
    >
      {text}
    </div>
  );
  return fit ? <div className="@container w-full">{number}</div> : number;
}
