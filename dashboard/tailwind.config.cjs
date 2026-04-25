/** @type {import("tailwindcss").Config} */
// VibeUsage Design System v1 — Operations Deck
// SSOT: dashboard/DESIGN.md. Do not add values that are not documented there.

const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Geist Mono"', ...defaultTheme.fontFamily.mono],
        katakana: [
          '"Hiragino Sans"',
          '"Yu Gothic"',
          '"MS Gothic"',
          '"Geist Mono"',
          ...defaultTheme.fontFamily.mono,
        ],
      },
      fontSize: {
        "display-0": [
          "96px",
          { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "900" },
        ],
        "display-1": [
          "60px",
          { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "900" },
        ],
        "display-2": [
          "40px",
          { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "900" },
        ],
        "display-3": [
          "28px",
          { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "900" },
        ],
        heading: [
          "14px",
          { lineHeight: "1.25", letterSpacing: "0.12em", fontWeight: "700" },
        ],
        body: ["13px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "500" }],
        data: ["12px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
        caption: [
          "11px",
          { lineHeight: "1.3", letterSpacing: "0.12em", fontWeight: "600" },
        ],
        micro: [
          "10px",
          { lineHeight: "1.2", letterSpacing: "0.22em", fontWeight: "700" },
        ],
      },
      letterSpacing: {
        tight: "-0.02em",
        data: "0",
        label: "0.12em",
        caps: "0.22em",
      },
      colors: {
        ink: {
          DEFAULT: "#00FF41",
          bright: "#E8FFE9",
          text: "rgba(0, 255, 65, 0.60)",
          muted: "rgba(0, 255, 65, 0.35)",
          line: "rgba(0, 255, 65, 0.18)",
          faint: "rgba(0, 255, 65, 0.08)",
        },
        surface: {
          DEFAULT: "#050505",
          raised: "rgba(0, 10, 0, 0.70)",
          strong: "rgba(0, 10, 0, 0.82)",
        },
        gold: "#FFD700",
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(0, 255, 65, 0.08), 0 18px 40px rgba(0, 0, 0, 0.45)",
        "glow-xs": "0 0 6px rgba(0, 255, 65, 0.35)",
        "glow-sm": "0 0 10px rgba(0, 255, 65, 0.35)",
        glow: "0 0 24px rgba(0, 255, 65, 0.35)",
        "glow-faint": "0 0 15px rgba(0, 255, 65, 0.1)",
        gold: "0 0 18px rgba(255, 215, 0, 0.35)",
        "gold-sm": "0 0 10px rgba(255, 215, 0, 0.3)",
        "gold-faint": "0 0 20px rgba(255, 215, 0, 0.1)",
      },
      dropShadow: {
        glow: "0 0 8px rgba(0, 255, 65, 0.8)",
        "glow-sm": "0 0 5px rgba(0, 255, 65, 0.6)",
        "glow-faint": "0 0 10px rgba(0, 255, 65, 0.22)",
        gold: "0 0 10px rgba(255, 215, 0, 0.5)",
        crown: [
          "0 0 8px rgba(255, 215, 0, 0.8)",
          "0 0 15px rgba(255, 255, 255, 0.5)",
        ],
      },
      backdropBlur: {
        panel: "10px",
      },
    },
  },
  plugins: [],
};
