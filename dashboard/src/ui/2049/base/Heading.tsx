import { cn } from "#src/lib/utils.ts";

const SIZE = {
  xl: "text-heading-xl/[0.95] font-extralight tracking-[0.01em]",
  l: "text-heading-l/none font-extralight tracking-[0.02em]",
  m: "text-heading-m/[1.1] font-extralight",
  s: "text-heading-s/[1.1] font-light",
  xs: "text-heading-xs/[1.2] font-light",
} as const;

const TONE = {
  light: "text-hero",
  amber: "text-primary",
  alert: "text-destructive",
} as const;

// Only the largest size glows, in the tone's own color.
const GLOW = {
  light: "text-shadow-heading-glow",
  amber: "text-shadow-heading-glow-amber",
  alert: "",
} as const;

type HeadingProps = {
  text: string;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  upper?: boolean;
  level?: 1 | 2 | 3;
};

// SSOT: design/2049/source/Heading.dc.html. A word wider than the column (LEADERBOARD at 52px on a
// 390px screen) breaks instead of scrolling the page; the source never meets that width.
export function Heading({ text, size = "s", tone = "light", upper = false, level = 2 }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      className={cn(
        "m-0 font-display text-balance wrap-break-word",
        SIZE[size],
        TONE[tone],
        upper && "uppercase",
        size === "xl" && GLOW[tone],
      )}
    >
      {text}
    </Tag>
  );
}
