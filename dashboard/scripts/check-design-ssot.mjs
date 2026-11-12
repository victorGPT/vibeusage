#!/usr/bin/env node
// VibeUsage design SSOT guardrail.
// v1 files: DESIGN.md §7 (forbidden) and §8 (migration map).
// 2049 files: no literal colors, spacing only on the scale in design/2049/source/Main.dc.html.
// Exits 1 on any violation under dashboard/src.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.resolve(ROOT, "src");

const EXTS = new Set([".jsx", ".tsx", ".js", ".ts"]);

// Files allowed to contain raw color literals — runtime JS constant SSOT
// and third-party SVG path data. Nothing else bypasses the guardrail.
const EXCLUDE = new Set(
  [
    "src/ui/matrix-a/components/MatrixConstants.ts",
    "src/ui/matrix-a/components/ClientLogos.jsx",
  ].map((p) => path.resolve(ROOT, p)),
);

const CHECKS = [
  {
    label: "matrix-* legacy token namespace (DESIGN.md §8 deleted)",
    pattern: /\b(?:text|bg|border|font|shadow|fill|stroke|ring|from|via|to)-matrix-/,
  },
  {
    label: "raw [#hex] color in className (use ink/surface/gold token)",
    pattern: /\[#[0-9a-fA-F]{3,6}\]/,
  },
  {
    label:
      "text-[Npx] typography bracket (use text-micro|caption|data|body|heading|display-*)",
    pattern: /text-\[[0-9]+px\]/,
  },
  {
    label: "tracking-[Xem] bracket (use tracking-tight|data|label|caps)",
    pattern: /tracking-\[[-0-9.]+em\]/,
  },
  {
    label: "shadow-[…] / drop-shadow-[…] inline (use shadow-glow* / shadow-gold*)",
    pattern: /(?:shadow-\[|drop-shadow-\[)/,
  },
  {
    label: "tailwind default text-Nxl (use DESIGN.md §3 typography token)",
    pattern:
      /\b(?:text-xs|text-sm|text-base|text-lg|text-xl|text-2xl|text-3xl|text-4xl|text-5xl|text-6xl|text-7xl|text-8xl|text-9xl)\b/,
  },
  {
    label: "text-white|text-black|bg-white|bg-black (use ink-bright / surface)",
    pattern: /\b(?:text-white|text-black|bg-white|bg-black)\b/,
  },
  {
    label: "redundant /N on rgba-backed ink token (Tailwind ignores it)",
    pattern: /\b(?:border|bg|text|ring|from|via|to)-ink-(?:faint|line|muted|text)\/[0-9]+/,
  },
  {
    label:
      "legacy matrix-* CSS class (deleted in v1 — use btn-chip, fx-scanline, Panel variant)",
    pattern:
      /\bmatrix-(?:header-chip|header-action|panel|panel-strong|scanlines|scan-sweep|scanline-overlay|shell-content|scrollbar)\b/,
  },
];

// The 2049 UI replaces the v1 rules with its own. dialog and tooltip predate 2049 and still
// style v1 pages with v1 tokens, so they keep the v1 rules until a later PR restyles them.
const SCOPE_2049 = ["src/ui/2049/", "src/ui/shadcn/", "src/ui/gallery/"];
const LEGACY_V1 = new Set(["src/ui/shadcn/dialog.tsx", "src/ui/shadcn/tooltip.tsx"]);

// Tailwind --spacing is 4px, so these steps are 0 4 8 12 16 24 32 48 64.
const SPACING_STEPS = "0|1|2|3|4|6|8|12|16";
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const CHECKS_2049 = [
  {
    label: "2049: literal color (use a token from src/styles/2049.css)",
    pattern: new RegExp(
      `#[0-9a-fA-F]{3,8}\\b|(?:rgba?|hsla?|oklch|oklab)\\(|\\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:(?:white|black|(?:${PALETTE})-\\d{2,3})\\b|\\[(?!(?:transparent|currentcolor|inherit)\\])[a-zA-Z]+\\])`,
    ),
  },
  {
    label: "2049: spacing off the 4 8 12 16 24 32 48 64 scale",
    pattern: new RegExp(
      `(?<![\\w-])-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-(?!(?:${SPACING_STEPS})(?![\\w.]))(?:[\\d[]|px(?![\\w-]))`,
    ),
  },
];

function checksFor(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (LEGACY_V1.has(rel)) return CHECKS;
  return SCOPE_2049.some((dir) => rel.startsWith(dir)) ? CHECKS_2049 : CHECKS;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.resolve(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && EXTS.has(path.extname(full))) yield full;
  }
}

const violations = [];
for (const file of walk(SRC)) {
  if (EXCLUDE.has(file)) continue;
  const checks = checksFor(file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const check of checks) {
      if (check.pattern.test(line)) {
        violations.push({
          check: check.label,
          file: path.relative(ROOT, file),
          line: i + 1,
          text: line.trim().slice(0, 180),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("✓ DESIGN.md SSOT: all guardrail checks pass");
  process.exit(0);
}

const byCheck = new Map();
for (const v of violations) {
  if (!byCheck.has(v.check)) byCheck.set(v.check, []);
  byCheck.get(v.check).push(v);
}

for (const [label, items] of byCheck) {
  console.error(`\n❌  ${label}`);
  for (const v of items.slice(0, 10)) {
    console.error(`   ${v.file}:${v.line}  ${v.text}`);
  }
  if (items.length > 10) {
    console.error(`   … ${items.length - 10} more`);
  }
}

console.error(
  `\n${violations.length} SSOT violation(s) across ${byCheck.size} check(s).`,
);
console.error(
  "Reference: dashboard/DESIGN.md §7 (forbidden) / §8 (migration map); 2049: dashboard/src/styles/2049.css.",
);
process.exit(1);
