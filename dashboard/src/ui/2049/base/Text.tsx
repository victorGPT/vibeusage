import { cn } from "#src/lib/utils.ts";

const SIZE = { s: "text-copy-s/normal", m: "text-copy-m/normal", l: "text-copy-l/normal" } as const;
const TONE = { body: "text-foreground", muted: "text-muted-foreground", light: "text-hero" } as const;

type TextProps = {
  text: string;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  weight?: 500 | 600;
  maxCh?: number;
};

// SSOT: design/2049/source/Text.dc.html.
export function Text({ text, size = "m", tone = "body", weight = 500, maxCh }: TextProps) {
  return (
    <p
      className={cn(
        "m-0 font-sans wrap-anywhere",
        SIZE[size],
        TONE[tone],
        weight === 600 ? "font-semibold" : "font-medium",
      )}
      style={maxCh ? { maxWidth: `${maxCh}ch` } : undefined}
    >
      {text}
    </p>
  );
}
