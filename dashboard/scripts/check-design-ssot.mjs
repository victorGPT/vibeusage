#!/usr/bin/env node
// VU-1 design guardrail, the rules in dashboard/DESIGN.md "Guardrail".
// Scans <root>/src (root defaults to dashboard/) and exits 1 on any violation.
// src/ui/hardware/ is the vendored SPEC-01 kit, kept as shipped, so it is skipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const SRC = path.join(ROOT, "src");
const VENDOR = "src/ui/hardware/";

// The gutters are aliases of s5 and s4 (src/styles/vu1.css), so they count as the scale.
const SCALE = "var\\(--spacing-(?:s[1-8]|gutter(?:-device)?)\\)";
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const CODE_CHECKS = [
  {
    label: "spacing utility off the s1..s8 scale (use p-s4, gap-s2, mt-s8; 0 is fine)",
    pattern:
      /(?<![\w-])-?(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-(?!0(?![\w.]))(?:\d|\[|px(?![\w-]))/,
  },
  {
    label: "literal color in className (colors live in the skin and ui/vu1 CSS)",
    pattern: new RegExp(
      `\\[#[0-9a-fA-F]{3,8}\\]|\\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`,
    ),
  },
  {
    label: "text-[Npx] font size in className (type lives in the skin and ui/vu1 CSS)",
    pattern: /text-\[[0-9.]+px\]/,
  },
];

// Whole-file, so a style object spread over several lines is still read. A nested "}}" inside the
// object ends the match early; nothing in src does that.
const STYLE_BLOCK = /style=\{\{([\s\S]*?)\}\}/g;
const STYLE_SPACING = {
  label: "inline style spacing off the scale (use 0 or var(--spacing-s1..s8))",
  pattern: new RegExp(
    `\\b(?:padding|margin|gap|rowGap|columnGap)\\w*\\s*:(?!\\s*(?:0(?![.\\d])|["'\`]${SCALE}["'\`]))`,
    "g",
  ),
};

function inlineStyleHits(text) {
  const hits = [];
  for (const block of text.matchAll(STYLE_BLOCK)) {
    const start = block.index + "style={{".length;
    for (const m of block[1].matchAll(STYLE_SPACING.pattern)) hits.push(start + m.index);
  }
  return hits;
}

const CSS_CHECKS = [
  {
    label: "CSS spacing off the s1..s8 scale (padding, margin and gap take 0, auto or var(--spacing-s1..s8))",
    pattern: new RegExp(
      `(?:^|[{;\\s])(?:padding|margin|gap|row-gap|column-gap)[\\w-]*\\s*:(?!(?:\\s*(?:0(?![.\\d])|auto|${SCALE}|calc\\([^;]*${SCALE}[^;]*\\)))+\\s*(?:!important\\s*)?(?:;|\\}|$))`,
    ),
  },
];

function checksFor(rel) {
  if (rel.endsWith(".css")) return CSS_CHECKS;
  if (/\.(?:jsx?|tsx?)$/.test(rel)) return CODE_CHECKS;
  return null;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const checks = checksFor(rel);
  if (!checks || rel.startsWith(VENDOR)) continue;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  if (checks === CODE_CHECKS) {
    for (const offset of inlineStyleHits(text)) {
      const i = text.slice(0, offset).split("\n").length - 1;
      violations.push({ check: STYLE_SPACING.label, at: `${rel}:${i + 1}`, text: lines[i].trim().slice(0, 160) });
    }
  }
  lines.forEach((line, i) => {
    for (const check of checks) {
      if (check.pattern.test(line)) {
        violations.push({ check: check.label, at: `${rel}:${i + 1}`, text: line.trim().slice(0, 160) });
      }
    }
  });
}

if (violations.length === 0) {
  console.log("✓ DESIGN.md guardrail: all checks pass");
  process.exit(0);
}

for (const v of violations) console.error(`❌ ${v.at}  ${v.check}\n   ${v.text}`);
console.error(`\n${violations.length} violation(s). Rules: dashboard/DESIGN.md "Guardrail".`);
process.exit(1);
