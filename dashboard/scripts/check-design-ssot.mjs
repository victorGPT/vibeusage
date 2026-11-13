#!/usr/bin/env node
// VibeUsage design SSOT guardrail.
// v1 files (the leftover v1 pages): DESIGN.md §10.
// 2049 files: no literal colors, spacing only on the scale in design/2049/source/Main.dc.html.
// Exits 1 on any violation under dashboard/src.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.resolve(ROOT, "src");

const EXTS = new Set([".jsx", ".tsx", ".js", ".ts"]);

const CHECKS = [
  {
    label: "matrix-* legacy token namespace (deleted)",
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
    label: "tailwind default text-Nxl (use a v1 type utility: text-micro|caption|body|heading|display-*)",
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

// The 2049 UI replaces the v1 rules with its own. Files outside these folders (the pages, and
// AgentResourcePage's v1 look) still get the v1 rules.
const SCOPE_2049 = ["src/ui/2049/", "src/ui/shadcn/", "src/ui/gallery/"];

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
  {
    label: "2049: text-[Npx] font size (use a --text-* token from src/styles/2049.css)",
    pattern: /text-\[[0-9.]+px\]/,
    // ponytail: shadcn/ predates the 2049 size tokens and sits outside P4's files; migrate it, then drop this.
    skip: "src/ui/shadcn/",
  },
  {
    // cn() drops a leading-* that comes before a registered size token, so the line height is lost.
    label: "2049: leading-* utility (put the line height on the size: text-label/none)",
    pattern: /(?<![\w-])leading-/,
  },
];

function checksFor(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (!SCOPE_2049.some((dir) => rel.startsWith(dir))) return CHECKS;
  return CHECKS_2049.filter((check) => !check.skip || !rel.startsWith(check.skip));
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
  "Reference: dashboard/DESIGN.md §8 (guardrails) / §10 (leftover v1); 2049 tokens: dashboard/src/styles/2049.css.",
);
process.exit(1);
