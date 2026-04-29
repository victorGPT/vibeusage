#!/usr/bin/env node
// shadcn → vibeusage v3 SSOT retro-fitter.
// Input:  path to a raw shadcn component file (jsx / tsx).
// Output: same file with classNames remapped to v3 SSOT tokens.
//         opacity-30..90 stripped (use ink-* alpha tokens instead).
//         rounded-* stripped (DESIGN.md §1: zero radius except .dot).
//
// Usage:
//   node scripts/shadcn-retro-fit.mjs src/ui/shadcn/tooltip.tsx
//   node scripts/shadcn-retro-fit.mjs --check src/ui/shadcn/tooltip.tsx
//
// Mapping source: scripts/shadcn-mapping.json. SSOT: dashboard/DESIGN.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPPING_PATH = path.resolve(__dirname, "shadcn-mapping.json");

function loadMapping() {
  const raw = fs.readFileSync(MAPPING_PATH, "utf8");
  const json = JSON.parse(raw);
  // Flatten all category objects into a single map (excluding meta + arrays).
  const flat = new Map();
  for (const [cat, value] of Object.entries(json)) {
    if (cat.startsWith("_")) continue;
    if (Array.isArray(value)) continue;
    if (typeof value !== "object" || value === null) continue;
    for (const [from, to] of Object.entries(value)) {
      flat.set(from, to);
    }
  }
  return { mapping: flat, opacityStrip: json.opacity_strip || [] };
}

// Split a Tailwind utility token into its modifier prefix(es) and the
// terminal "core" utility. The split point is the *last* `:` that is not
// inside a bracketed arbitrary-value group like `data-[state=open]:` or
// `[&>svg]:`. A naive regex like `[a-z]+:` cannot do this — it stops at
// `data-[`, leaves the variant unparsed, and the core utility never reaches
// the mapping table.
function splitPrefix(token) {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) lastColon = i;
  }
  if (lastColon === -1) return { prefix: "", core: token };
  return {
    prefix: token.slice(0, lastColon + 1),
    core: token.slice(lastColon + 1),
  };
}

// v3 SSOT tokens whose Tailwind alpha-slash modifier (`/N`) is forbidden by
// the design guardrail (`redundant /N on rgba-backed ink token`). The check
// targets only these four — alpha is already baked into their rgba(...)
// values, and Tailwind silently drops the modifier. When the retro-fitter
// maps a shadcn class with an opacity-slash to one of these targets, drop
// the `/N` so we don't ship a guardrail violation.
//
// surface-raised / surface-strong are also rgba-backed but the guardrail
// does NOT ban /N on them, so we preserve the user's alpha intent there
// (Codex feedback: don't collapse valid alpha semantics).
const GUARDRAIL_BANS_SLASH = new Set([
  "ink-line",
  "ink-muted",
  "ink-text",
]);

function targetTokenName(replacement) {
  // "bg-ink-line" → "ink-line". Used to compare against the ban list.
  const m = replacement.match(
    /^(?:bg|text|border|ring|fill|stroke|from|via|to|outline)-(.+)$/,
  );
  return m ? m[1] : null;
}

// Rewrite a single className token.
// Drop the token (return null) when:
//  - any modifier in the chain is `dark:` (vibeusage is dark-only)
//  - the core is in the opacity-strip list
//  - the replacement maps to "" (e.g. rounded-* per zero-radius rule)
//
// Tailwind alpha-slash `/N` (`/80`, `/[0.6]`, etc.) is split off only when
// the *base* is a mappable color token — this avoids munging fractional
// utilities like `w-1/2`, `aspect-1/2`, `divide-y/2` that share the `/`
// syntax but mean different things. The slash tail is preserved on the
// rewritten token unless the target is one of the four guardrail-banned
// rgba ink tokens (in which case it must be dropped).
function rewriteToken(token, mapping, opacityStrip) {
  if (!token) return token;
  const { prefix, core } = splitPrefix(token);

  // Strip the whole token if any modifier in the chain is `dark:` — we are
  // dark-only, light-mode overrides have nothing to override here.
  // Match `dark:` at the start of the chain or after another colon to avoid
  // false positives on, e.g., a hypothetical `mydark:` utility.
  if (/(^|:)dark:/.test(prefix)) return null;

  // Split off Tailwind opacity-slash (`/N` or `/[anything]`) — but only if
  // the base half is a known mappable token or in the opacity-strip list.
  // This guards against fractional width / aspect / divide utilities.
  const slashMatch = core.match(/^(.+?)\/(\d+|\[[^\]]+\])$/);
  let baseCore = core;
  let opacityTail = "";
  if (slashMatch) {
    const candidateBase = slashMatch[1];
    if (mapping.has(candidateBase) || opacityStrip.includes(candidateBase)) {
      baseCore = candidateBase;
      opacityTail = "/" + slashMatch[2];
    }
  }

  if (opacityStrip.includes(baseCore)) return null;

  if (mapping.has(baseCore)) {
    const replacement = mapping.get(baseCore);
    if (replacement === "") return null;
    const targetName = targetTokenName(replacement);
    const stripTail = targetName !== null && GUARDRAIL_BANS_SLASH.has(targetName);
    return prefix + replacement + (stripTail ? "" : opacityTail);
  }

  return token;
}

function rewriteClassString(classStr, mapping, opacityStrip) {
  return classStr
    .split(/\s+/)
    .map((t) => rewriteToken(t, mapping, opacityStrip))
    .filter((t) => t !== null && t !== "")
    .join(" ");
}

// Heuristic: does this string literal look like Tailwind class soup?
// Used to gate rewriting inside cn() / cva() / clsx() so we don't munge
// unrelated string literals that happen to live inside those calls.
function looksLikeTailwind(s) {
  return /(?:^|\s)(?:[a-z][a-z0-9-]*:|\[)?(?:bg|text|border|rounded|shadow|ring|opacity|outline|font|tracking|leading|p[xytrbl]?|m[xytrbl]?|w|h|min-|max-|flex|grid|gap|space|hidden|block|inline|absolute|relative|fixed|sticky|z|cursor|select|hover|focus|active|disabled|data|aria|group|peer|dark)/.test(
    s,
  );
}

// Find the end-position (index of the closing paren) of a balanced `(...)`
// group whose body starts at `start` in `src`. String-aware so quotes and
// template literals inside the body are respected. Returns -1 if no
// balanced match (truncated input).
function findBalancedClose(src, start) {
  let depth = 1;
  let strChar = null; // '"', "'", or '`'
  let i = start;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (strChar) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === strChar) strChar = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      strChar = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

// Locate every cn / cva / clsx call body in `src` as paren-balanced, string-
// aware regions. Lazy-regex `[\s\S]*?` would stop at the first nested `)`
// (e.g. inside `getVariantClass(variant)`), missing string literals after
// the nested call. Real source has nested calls; this scanner handles them.
function findCallRegions(src, fnNames) {
  const headRe = new RegExp(`\\b(?:${fnNames.join("|")})\\s*\\(`, "g");
  const regions = [];
  let m;
  while ((m = headRe.exec(src)) !== null) {
    const bodyStart = m.index + m[0].length;
    const closeIdx = findBalancedClose(src, bodyStart);
    if (closeIdx === -1) continue;
    regions.push({ start: bodyStart, end: closeIdx });
    // Don't skip past closeIdx — nested cn() calls still need to be found by
    // the outer regex pass; lastIndex naturally advances. Allowing overlap
    // is fine: a string literal landing inside several regions still maps
    // to itself once.
  }
  return regions;
}

function isInsideAnyRegion(pos, regions) {
  for (const r of regions) {
    if (pos >= r.start && pos < r.end) return true;
  }
  return false;
}

// Walk `src` once, rewriting every plain-string literal ("..." or '...')
// whose start index lies inside any cn/cva/clsx region AND whose contents
// look like Tailwind class soup. Template literals are skipped here — they
// commonly carry interpolation and `className={`...`}` already handles the
// no-interp template case in rewriteFile.
function rewriteCallBodyLiterals(src, fnNames, mapping, opacityStrip) {
  const regions = findCallRegions(src, fnNames);
  if (regions.length === 0) return src;

  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      // Find the matching close quote, escape-aware.
      let j = i + 1;
      while (j < src.length) {
        const c = src[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === ch) break;
        j++;
      }
      if (j >= src.length) {
        out += src.slice(i);
        break;
      }
      const inner = src.slice(i + 1, j);
      if (isInsideAnyRegion(i, regions) && looksLikeTailwind(inner)) {
        const rewritten = rewriteClassString(inner, mapping, opacityStrip);
        out += ch + rewritten + ch;
      } else {
        out += src.slice(i, j + 1);
      }
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

// Match className="..." and className={`...`} and cn(...) / cva(...) /
// clsx(...) arguments. cn() bodies can contain *multiple* string literals
// (and ternaries, nested calls like `cn(format(x), "bg-primary")`) — we
// rewrite ALL string literals whose position lies inside a cn/cva/clsx
// region, regardless of how deeply nested the surrounding expression is.
function rewriteFile(content, mapping, opacityStrip) {
  let out = content;

  // className="..."
  out = out.replace(/className=(["'])([^"']*?)\1/g, (m, q, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className=${q}${rewritten}${q}`;
  });

  // className={`...`} (no template interpolation case)
  out = out.replace(/className=\{`([^`${}]*?)`\}/g, (m, classes) => {
    const rewritten = rewriteClassString(classes, mapping, opacityStrip);
    return `className={\`${rewritten}\`}`;
  });

  // cn(...) / cva(...) / clsx(...) call bodies — paren-balanced scan.
  out = rewriteCallBodyLiterals(
    out,
    ["cn", "cva", "clsx"],
    mapping,
    opacityStrip,
  );

  return out;
}

// Self-test fixtures — every entry asserts a real pattern that has shipped
// in upstream shadcn components. Failures here block CI and signal a
// regression in the rewriter.
const SELF_TESTS = [
  {
    name: "plain className with bg-primary",
    in: 'className="bg-primary"',
    out: 'className="bg-ink"',
  },
  {
    name: "data-[state=open] variant on bg-accent",
    in: 'className="data-[state=open]:bg-accent"',
    out: 'className="data-[state=open]:bg-ink-line"',
  },
  {
    name: "data-[state=closed] strips dark: chained variant",
    in: 'className="dark:data-[state=open]:bg-slate-900"',
    out: 'className=""',
  },
  {
    name: "aria-selected variant",
    in: 'className="aria-selected:bg-accent"',
    out: 'className="aria-selected:bg-ink-line"',
  },
  {
    name: "peer-disabled variant on opacity-50 strips token",
    in: 'className="peer-disabled:opacity-50"',
    out: 'className=""',
  },
  {
    name: "group-hover variant",
    in: 'className="group-hover:text-foreground"',
    out: 'className="group-hover:text-ink-bright"',
  },
  {
    name: "[&>svg] arbitrary selector variant",
    in: 'className="[&>svg]:text-muted-foreground"',
    out: 'className="[&>svg]:text-ink-muted"',
  },
  {
    name: "dark: prefix is dropped (mapped core)",
    in: 'className="dark:bg-white"',
    out: 'className=""',
  },
  {
    name: "rounded-md is stripped per zero-radius rule",
    in: 'className="rounded-md"',
    out: 'className=""',
  },
  {
    name: "responsive prefix preserved",
    in: 'className="md:text-2xl"',
    out: 'className="md:text-display-3"',
  },
  {
    name: "stacked responsive + state preserved",
    in: 'className="md:hover:bg-primary"',
    out: 'className="md:hover:bg-ink"',
  },
  {
    name: "multiple string literals inside cn() all rewritten",
    in: 'cn("bg-primary text-sm", "border-border rounded-md")',
    out: 'cn("bg-ink text-caption", "border-ink-line")',
  },
  {
    name: "plain non-tailwind string literal left untouched",
    in: 'cn("Hello world", "bg-primary")',
    out: 'cn("Hello world", "bg-ink")',
  },
  {
    name: "nested function call inside cn — outer string literal still rewritten (Codex regression)",
    in: 'cn(getVariantClass(variant), "bg-primary text-sm")',
    out: 'cn(getVariantClass(variant), "bg-ink text-caption")',
  },
  {
    name: "ternary with nested call inside cn — both branches and tail rewritten",
    in: 'cn(condition ? cls(x) : "bg-accent text-foreground", "border-border")',
    out: 'cn(condition ? cls(x) : "bg-ink-line text-ink-bright", "border-ink-line")',
  },
  {
    name: "deeply nested cva inside cn — strings at every level rewritten",
    in: 'cn(cva({ base: "p-2 rounded-md bg-muted" })(props), "bg-primary")',
    out: 'cn(cva({ base: "p-2 bg-ink-line" })(props), "bg-ink")',
  },
  {
    name: "literal containing parens does not break paren scan",
    in: 'cn(format("(literal)"), "bg-primary")',
    out: 'cn(format("(literal)"), "bg-ink")',
  },
  {
    name: "opacity-slash on hex-backed mapped target preserves /N",
    in: 'className="bg-background/80"',
    out: 'className="bg-surface/80"',
  },
  {
    name: "opacity-slash on guardrail-banned rgba target strips /N",
    in: 'className="bg-muted/80"',
    out: 'className="bg-ink-line"',
  },
  {
    name: "opacity-slash with variant prefix on banned rgba strips /N",
    in: 'className="hover:bg-accent/50"',
    out: 'className="hover:bg-ink-line"',
  },
  {
    name: "opacity-slash with variant prefix on hex target keeps /N",
    in: 'className="hover:bg-background/40"',
    out: 'className="hover:bg-surface/40"',
  },
  {
    name: "opacity-slash on rgba target NOT in guardrail ban list keeps /N (Codex regression)",
    in: 'className="bg-popover/80"',
    out: 'className="bg-surface-strong/80"',
  },
  {
    name: "fractional width w-1/2 is NOT split as opacity-slash",
    in: 'className="w-1/2"',
    out: 'className="w-1/2"',
  },
  {
    name: "aspect-3/2 (any non-mappable base before slash) is left alone",
    in: 'className="aspect-3/2"',
    out: 'className="aspect-3/2"',
  },
  {
    name: "arbitrary-opacity bracket value preserved on hex target",
    in: 'className="bg-background/[0.6]"',
    out: 'className="bg-surface/[0.6]"',
  },
  {
    name: "arbitrary-opacity bracket value stripped on banned rgba target",
    in: 'className="bg-muted/[0.32]"',
    out: 'className="bg-ink-line"',
  },
];

function runSelfTests() {
  const { mapping, opacityStrip } = loadMapping();
  const failures = [];
  for (const t of SELF_TESTS) {
    const got = rewriteFile(t.in, mapping, opacityStrip);
    if (got !== t.out) {
      failures.push({ name: t.name, input: t.in, expected: t.out, got });
    }
  }
  if (failures.length === 0) {
    console.log(`self-test ok — ${SELF_TESTS.length}/${SELF_TESTS.length} passed`);
    return 0;
  }
  console.error(`self-test FAILED — ${failures.length}/${SELF_TESTS.length}`);
  for (const f of failures) {
    console.error(`  · ${f.name}`);
    console.error(`      in:  ${f.input}`);
    console.error(`      out: ${f.got}`);
    console.error(`      exp: ${f.expected}`);
  }
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: shadcn-retro-fit.mjs [--self-test|--check] <file.tsx> [<file.tsx> ...]",
    );
    process.exit(2);
  }
  if (args[0] === "--self-test") {
    process.exit(runSelfTests());
  }
  const check = args[0] === "--check";
  const targets = check ? args.slice(1) : args;

  const { mapping, opacityStrip } = loadMapping();
  let dirty = 0;
  let touched = 0;

  for (const file of targets) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
      console.error(`skip (not found): ${file}`);
      continue;
    }
    const before = fs.readFileSync(abs, "utf8");
    const after = rewriteFile(before, mapping, opacityStrip);
    if (before === after) {
      console.log(`unchanged: ${file}`);
      continue;
    }
    if (check) {
      console.error(`would-rewrite: ${file}`);
      dirty++;
    } else {
      fs.writeFileSync(abs, after);
      console.log(`rewrote: ${file}`);
      touched++;
    }
  }

  if (check && dirty > 0) {
    console.error(`${dirty} file(s) would be rewritten.`);
    process.exit(1);
  }
  console.log(check ? "check ok" : `done — ${touched} file(s) rewritten`);
}

main();
