#!/usr/bin/env node
// VibeUsage design system v1 — SSOT guardrail.
// Enforces DESIGN.md §7 (forbidden) and §8 (migration map).
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
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const check of CHECKS) {
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
  "Reference: dashboard/DESIGN.md §7 (forbidden) / §8 (migration map).",
);
process.exit(1);
