#!/usr/bin/env node
// VU-1 design guardrail, the rules in dashboard/DESIGN.md "Guardrail".
// Scans <root>/src (root defaults to dashboard/) and exits 1 on any violation.
// Colors and radii are checked everywhere; their literals live only in src/styles/tokens.css.
// Spacing is not checked in the SPEC-01 kit (src/ui/hardware/), whose parts keep their own metrics.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const VENDOR = "src/ui/hardware/";
const TOKENS = "src/styles/tokens.css";

// The gutters and inset, stack and section are aliases of scale steps (src/styles/vu1.css).
const SCALE = "var\\(--spacing-(?:s[1-8]|gutter(?:-device)?|inset|stack|section)\\)";
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
  {
    label: "rounded-[...] radius in className (radii are var(--radius-*) in CSS)",
    pattern: /\brounded(?:-[a-z]+)?-\[/,
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

const STYLE_RADIUS = {
  label: "inline style radius (radii are var(--radius-*) in CSS)",
  pattern: /\bborder\w*Radius\s*:/g,
};

function inlineStyleHits(text) {
  const hits = [];
  for (const block of text.matchAll(STYLE_BLOCK)) {
    const start = block.index + "style={{".length;
    for (const check of [STYLE_SPACING, STYLE_RADIUS]) {
      for (const m of block[1].matchAll(check.pattern)) hits.push({ check, offset: start + m.index });
    }
  }
  return hits;
}

// CSS named colors other than transparent and currentColor.
const NAMED =
  "aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen";
const COLOR_START = new RegExp(`(?<![\\w-])#[0-9a-fA-F]{3,8}(?![\\w-])|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|(?<![\\w-])(?:${NAMED})(?![\\w-])`, "gi");

function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return text.length - 1;
}

// A color written as a value: hex, a named color, or a color function whose channels are numbers.
// A function is not a literal when it is relative ("from var(...)") or takes its channels from var().
export function colorLiterals(value) {
  const found = [];
  const strings = value.replace(/(["'])(?:(?!\1).)*\1|url\([^)]*\)/g, (s) => " ".repeat(s.length));
  for (const m of strings.matchAll(COLOR_START)) {
    if (!m[0].endsWith("(")) {
      if (m[0].startsWith("#") && ![4, 5, 7, 9].includes(m[0].length)) continue;
      found.push({ index: m.index, text: m[0] });
      continue;
    }
    const open = m.index + m[0].length - 1;
    const end = closeParen(strings, open);
    const args = strings.slice(open + 1, end);
    const top = { "/": [], ",": [] };
    for (let i = 0, depth = 0; i < args.length; i++) {
      if (args[i] === "(") depth++;
      else if (args[i] === ")") depth--;
      else if (depth === 0 && args[i] in top) top[args[i]].push(i);
    }
    const channels = args.slice(0, top[","][2] ?? top["/"][0] ?? args.length);
    if (/^\s*from\b/.test(args) || channels.includes("var(")) continue;
    found.push({ index: m.index, text: value.slice(m.index, end + 1) });
  }
  return found;
}

// A length in a radius that is not 0 or 50%. Unitless factors (calc(var(--h) / 2)) are fine.
export function radiusLiterals(value) {
  return [...value.matchAll(/(?<![\w.-])(\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax)(?![\w-])/g)]
    .filter((m) => !(m[2] === "%" && Number(m[1]) === 50) && Number(m[1]) !== 0)
    .map((m) => ({ index: m.index, text: m[0] }));
}

// Each declaration of a stylesheet, comments blanked so offsets and line numbers hold.
export function declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  return [...text.matchAll(/(?<![\w-])(--[\w-]+|-?[a-z][a-z-]*)\s*:\s*([^;{}]*)(?=[;}])/g)].map((m) => ({
    prop: m[1],
    value: m[2],
    valueIndex: m.index + m[0].length - m[2].length,
  }));
}

const CSS_COLOR = "literal color in CSS (colors are var(--palette-*) or var(--color-*), defined in src/styles/tokens.css)";
const CSS_RADIUS = "literal radius in CSS (radii are var(--radius-*), defined in src/styles/tokens.css; 0 and 50% are fine)";

function tokenHits(css) {
  const hits = [];
  for (const d of declarations(css)) {
    for (const c of colorLiterals(d.value)) hits.push({ label: CSS_COLOR, offset: d.valueIndex + c.index });
    if (/radius$/.test(d.prop)) {
      for (const r of radiusLiterals(d.value)) hits.push({ label: CSS_RADIUS, offset: d.valueIndex + r.index });
    }
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

export function scan(root) {
  const SRC = path.join(root, "src");
  const violations = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    const checks = checksFor(rel);
    if (!checks) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");
    const lineAt = (offset) => text.slice(0, offset).split("\n").length - 1;
    const flag = (label, i) => violations.push({ check: label, at: `${rel}:${i + 1}`, text: lines[i].trim().slice(0, 160) });
    if (checks === CSS_CHECKS && rel !== TOKENS) {
      for (const hit of tokenHits(text)) flag(hit.label, lineAt(hit.offset));
    }
    if (rel.startsWith(VENDOR)) continue;
    if (checks === CODE_CHECKS) {
      for (const hit of inlineStyleHits(text)) flag(hit.check.label, lineAt(hit.offset));
    }
    lines.forEach((line, i) => {
      for (const check of checks) {
        if (check.pattern.test(line)) flag(check.label, i);
      }
    });
  }
  return violations;
}

function main() {
  const violations = scan(ROOT);
  if (violations.length === 0) {
    console.log("✓ DESIGN.md guardrail: all checks pass");
    process.exit(0);
  }
  for (const v of violations) console.error(`❌ ${v.at}  ${v.check}\n   ${v.text}`);
  console.error(`\n${violations.length} violation(s). Rules: dashboard/DESIGN.md "Guardrail".`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
