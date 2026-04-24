#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * compare-claude-ground-truth.cjs
 *
 * CLI wrapper around src/lib/ops/audit-claude.js. See
 * `node scripts/ops/compare-claude-ground-truth.cjs --help`.
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT,
  runAudit,
} = require("../../src/lib/ops/audit-claude");

function parseArgs(argv) {
  const out = {
    days: DEFAULT_DAYS,
    threshold: DEFAULT_THRESHOLD_PCT,
    userId: null,
    dbJson: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) bail(`--days expects a positive number`);
      out.days = Math.floor(n);
    } else if (a === "--threshold") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) bail(`--threshold expects a non-negative number`);
      out.threshold = n;
    } else if (a === "--user-id") {
      out.userId = String(argv[++i] || "").trim() || null;
    } else if (a === "--db-json") {
      out.dbJson = argv[++i];
    } else if (a === "--json") {
      out.json = true;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      bail(`Unknown flag: ${a}`);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: compare-claude-ground-truth [--days N] [--threshold PCT] [--user-id UUID] [--db-json PATH] [--json]",
      "",
      "Compare local ~/.claude/projects/*.jsonl (dedup + all 4 channels) to DB",
      "totals in vibeusage_tracker_hourly for source=claude.",
      "",
      "Auto mode requires `insforge` CLI linked to the vibeusage workspace.",
      "Use --db-json to feed pre-computed DB data instead.",
      "",
    ].join("\n"),
  );
}

function bail(msg) {
  process.stderr.write(`compare-claude-ground-truth: ${msg}\n`);
  process.exit(2);
}

function readTrackerConfig() {
  const home = os.homedir();
  for (const p of [
    path.join(home, ".vibeusage", "tracker", "config.json"),
    path.join(home, ".vibeusage", "config.json"),
  ]) {
    if (!fs.existsSync(p)) continue;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) || {};
    } catch (_err) {
      // fall through
    }
  }
  return {};
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readTrackerConfig();

  let result;
  try {
    result = runAudit({
      days: args.days,
      threshold: args.threshold,
      userId: args.userId,
      deviceId: config.deviceId || null,
      dbJsonPath: args.dbJson || null,
    });
  } catch (err) {
    bail(err?.message || String(err));
  }

  if (!result.ok) {
    bail(result.message || result.error || "audit failed");
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Claude Code local vs vibeusage DB (last ${result.days} days, window >= ${result.windowStartIso})\n`,
    );
    process.stdout.write(
      `Scanned ${result.filesScanned} .jsonl files, ${formatNumber(result.usageLines)} usage lines, ` +
        `${formatNumber(result.uniqueMessages)} unique message.ids, ` +
        `${formatNumber(result.duplicatesSkipped)} duplicates skipped.\n\n`,
    );
    process.stdout.write(
      `${"day".padEnd(12)}  ${"truth".padStart(15)}  ${"db".padStart(15)}  ${"ratio".padStart(8)}  ${"drift".padStart(8)}\n`,
    );
    process.stdout.write(`${"-".repeat(66)}\n`);
    for (const r of result.rows) {
      const ratio = r.ratio == null ? "—" : `${r.ratio.toFixed(3)}x`;
      const drift = r.driftPct == null ? "—" : `${r.driftPct.toFixed(1)}%`;
      process.stdout.write(
        `${r.day.padEnd(12)}  ${formatNumber(r.truth).padStart(15)}  ` +
          `${formatNumber(r.db).padStart(15)}  ${ratio.padStart(8)}  ${drift.padStart(8)}\n`,
      );
    }
    process.stdout.write(
      `\nMax drift: ${result.maxDriftPct.toFixed(2)}% (threshold ${result.thresholdPct}%).\n`,
    );
  }

  if (result.exceedsThreshold) {
    if (!args.json) {
      process.stderr.write(
        `\nFAIL drift ${result.maxDriftPct.toFixed(2)}% exceeds threshold ${result.thresholdPct}%.\n` +
          `If the parser is up to date (vibeusage >= 0.5.0), scrub the Claude/OpenCode cursor\n` +
          `block in ~/.vibeusage/tracker/cursors.json and rerun \`vibeusage sync --drain\`.\n`,
      );
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
