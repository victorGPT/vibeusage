// Runtime color constants — JS-side mirror of DESIGN.md §2 (colors).
// SSOT for any case where hex / rgba strings must be emitted at runtime
// (canvas fillStyle, SVG fill, html-to-image backgroundColor, filter rules).

export const COLORS = {
  /** data ink — `#00FF41` — mirrors `--ink`, `text-ink`. */
  MATRIX: "#00FF41",
  /** emphasis — `#E8FFE9` — mirrors `--ink-bright`, `text-ink-bright`. */
  MATRIX_BRIGHT: "#E8FFE9",
  /** gold accent — `#FFD700` — mirrors `--gold`. */
  GOLD: "#FFD700",
  /** page bg — `#050505` — mirrors `--surface`, `bg-surface`. */
  SURFACE: "#050505",
  /** anonymous-user fallback (not in main palette — anonymized avatars only). */
  ANON: "#333",
};

/** RGB channel strings for `rgba(${CHANNELS}, ${α})` construction at runtime. */
export const INK_RGB = "0, 255, 65";
export const GOLD_RGB = "255, 215, 0";
export const SURFACE_RGB = "5, 5, 5";

export const TEXTURES = [
  // Texture palette uses 8-digit hex for inline alpha (runtime-only usage).
  { bg: `${COLORS.MATRIX}99`, pattern: "none" },
  {
    bg: "transparent",
    pattern: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${COLORS.MATRIX}33 2px, ${COLORS.MATRIX}33 4px)`,
  },
  {
    bg: "transparent",
    pattern: `radial-gradient(${COLORS.MATRIX}33 1px, transparent 1px)`,
    size: "4px 4px",
  },
  {
    bg: "transparent",
    pattern: `linear-gradient(90deg, ${COLORS.MATRIX}1A 1px, transparent 1px)`,
    size: "3px 100%",
  },
];
