#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * compare-claude-ground-truth.cjs
 *
 * Walk the local `~/.claude/projects/<project>/*.jsonl` files, compute the
 * ground-truth Claude Code token totals the way vibeusage SHOULD have reported
 * them (dedup by message.id, count all four channels: input, cache_creation,
 * cache_read, output), and compare against DB totals pulled from
 * vibeusage_tracker_hourly.
 *
 * Why this exists:
 *   April 2026 incident had vibeusage reporting ~5-15% of actual Claude
 *   consumption. A quick local-vs-DB comparison would have caught the drift
 *   instantly. This script is the first-class way to run that comparison on a
 *   maintainer box.
 *
 * Usage (two modes):
 *
 *   1. Auto mode (requires `insforge` CLI linked to the vibeusage workspace)
 *      node scripts/ops/compare-claude-ground-truth.cjs
 *      node scripts/ops/compare-claude-ground-truth.cjs --days 30 --threshold 15
 *
 *   2. BYO DB data (for CI or when `insforge` CLI is not available)
 *      insforge --json db query "SELECT DATE(hour_start) day, SUM(total_tokens) tokens
 *        FROM vibeusage_tracker_hourly
 *        WHERE source='claude' AND user_id='<you>' AND hour_start >= '2026-04-10'
 *        GROUP BY DATE(hour_start)" > /tmp/db.json
 *      node scripts/ops/compare-claude-ground-truth.cjs --db-json /tmp/db.json
 *
 * Flags:
 *   --days N          lookback window in days (default 14)
 *   --threshold PCT   drift ratio above which the script exits non-zero (default 25)
 *   --user-id UUID    vibeusage user_id filter (auto mode; inferred if omitted
 *                     via `vibeusage_tracker_devices` where device_id = local)
 *   --db-json PATH    read pre-computed DB totals from this JSON file instead
 *                     of invoking `insforge db query`
 *   --json            emit machine-readable JSON instead of the table
 *
 * Exit codes:
 *   0  drift within threshold
 *   1  drift exceeds threshold on at least one day
 *   2  cannot run (missing data source, no local sessions, etc.)
 */

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_DAYS = 14;
const DEFAULT_THRESHOLD_PCT = 25;

function parseArgs(argv) {
  const out = {
    days: DEFAULT_DAYS,
    json: false,
    threshold: DEFAULT_THRESHOLD_PCT,
    userId: null,
    dbJson: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--days") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) bail(`--days expects a positive number, got ${argv[i]}`);
      out.days = Math.floor(n);
    } else if (a === "--threshold") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 0) bail(`--threshold expects a non-negative number, got ${argv[i]}`);
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

function listClaudeJsonl() {
  const projectsDir = path.join(os.homedir(), ".claude", "projects");
  if (!fs.existsSync(projectsDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(projectsDir, entry.name);
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!f.isFile()) continue;
      if (!f.name.endsWith(".jsonl")) continue;
      out.push(path.join(dir, f.name));
    }
  }
  return out;
}

function isoDay(ts) {
  if (typeof ts !== "string") return null;
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function nonneg(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function computeLocalTotals({ files, windowStartIso }) {
  const byDay = new Map();
  const seen = new Set();
  let scanned = 0;
  let skippedDup = 0;
  for (const filePath of files) {
    let text;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (_err) {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line || !line.includes('"usage"')) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (_err) {
        continue;
      }
      const ts = typeof obj?.timestamp === "string" ? obj.timestamp : null;
      if (!ts || ts < windowStartIso) continue;
      const day = isoDay(ts);
      if (!day) continue;
      const msg = obj?.message || {};
      const usage = msg.usage || obj.usage;
      if (!usage || typeof usage !== "object") continue;
      const dedupeId = msg.id || obj.requestId || null;
      scanned += 1;
      if (dedupeId && seen.has(dedupeId)) {
        skippedDup += 1;
        continue;
      }
      if (dedupeId) seen.add(dedupeId);

      const input = nonneg(usage.input_tokens);
      const cacheCreation = nonneg(usage.cache_creation_input_tokens);
      const cacheRead = nonneg(usage.cache_read_input_tokens);
      const output = nonneg(usage.output_tokens);
      const total = input + cacheCreation + cacheRead + output;
      if (total === 0) continue;

      let row = byDay.get(day);
      if (!row) {
        row = { total: 0, input: 0, cache_creation: 0, cache_read: 0, output: 0, messages: 0 };
        byDay.set(day, row);
      }
      row.total += total;
      row.input += input;
      row.cache_creation += cacheCreation;
      row.cache_read += cacheRead;
      row.output += output;
      row.messages += 1;
    }
  }
  return { byDay, scanned, skippedDup, uniqueMessages: seen.size };
}

function resolveUserId({ explicitUserId, deviceId }) {
  if (explicitUserId) return explicitUserId;
  if (!deviceId) return null;
  const r = spawnSync(
    "insforge",
    [
      "db",
      "query",
      `SELECT user_id FROM vibeusage_tracker_devices WHERE id='${deviceId}' LIMIT 1`,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  const m = r.stdout.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  return m ? m[1] : null;
}

function queryDbTotalsViaInsforge({ userId, windowStartIso }) {
  const sql =
    `SELECT DATE(hour_start) AS day, SUM(total_tokens) AS tokens ` +
    `FROM vibeusage_tracker_hourly ` +
    `WHERE source='claude' AND user_id='${userId}' AND hour_start >= '${windowStartIso}' ` +
    `GROUP BY DATE(hour_start) ORDER BY day`;
  const r = spawnSync("insforge", ["--json", "db", "query", sql], { encoding: "utf8" });
  if (r.status !== 0) {
    bail(
      `\`insforge db query\` failed (${r.status}). Run \`insforge current\` to confirm the ` +
        `CLI is linked to the vibeusage workspace, or use --db-json PATH to feed data directly.`,
    );
  }
  return parseInsforgeJson(r.stdout);
}

function parseInsforgeJson(blob) {
  let parsed;
  try {
    parsed = JSON.parse(blob);
  } catch (err) {
    bail(`cannot parse DB JSON: ${err?.message || err}`);
  }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.data) ? parsed.data : null;
  if (!rows) bail(`DB JSON shape unexpected (need array of {day, tokens}); got ${Object.keys(parsed || {}).join(",") || "(empty)"}`);
  const byDay = new Map();
  for (const row of rows) {
    const rawDay = row?.day ?? row?.date ?? row?.bucket_day;
    const day = typeof rawDay === "string" ? rawDay.slice(0, 10) : null;
    if (!day) continue;
    const total = nonneg(row.tokens ?? row.total_tokens ?? row.total);
    byDay.set(day, total);
  }
  return byDay;
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readTrackerConfig();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (args.days - 1));
  const windowStartIso = start.toISOString();

  const files = listClaudeJsonl();
  if (files.length === 0) {
    bail("no Claude Code session files under ~/.claude/projects");
  }
  const local = computeLocalTotals({ files, windowStartIso });

  let backend;
  if (args.dbJson) {
    const blob = fs.readFileSync(args.dbJson, "utf8");
    backend = parseInsforgeJson(blob);
  } else {
    const userId = resolveUserId({ explicitUserId: args.userId, deviceId: config.deviceId });
    if (!userId) {
      bail(
        "cannot resolve user_id. Pass --user-id UUID explicitly, or make sure `insforge` CLI " +
          "is linked to the vibeusage workspace and config.deviceId is set.",
      );
    }
    backend = queryDbTotalsViaInsforge({ userId, windowStartIso });
  }

  const days = Array.from(new Set([...local.byDay.keys(), ...backend.keys()])).sort();
  const rows = [];
  let maxDriftPct = 0;
  for (const day of days) {
    const truth = (local.byDay.get(day) || { total: 0 }).total;
    const dbTotal = backend.get(day) || 0;
    const ratio = truth > 0 ? dbTotal / truth : null;
    const drift = ratio == null ? null : Math.abs(ratio - 1) * 100;
    if (drift != null && drift > maxDriftPct) maxDriftPct = drift;
    rows.push({ day, truth, db: dbTotal, ratio, driftPct: drift });
  }

  const summary = {
    window_start: windowStartIso,
    days: args.days,
    threshold_pct: args.threshold,
    local_files_scanned: files.length,
    local_usage_lines: local.scanned,
    local_unique_messages: local.uniqueMessages,
    local_duplicates_skipped: local.skippedDup,
    max_drift_pct: Number(maxDriftPct.toFixed(2)),
    rows,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Claude Code local vs vibeusage DB (last ${args.days} days, window >= ${windowStartIso})\n`,
    );
    process.stdout.write(
      `Scanned ${files.length} .jsonl files, ${formatNumber(local.scanned)} usage lines, ` +
        `${formatNumber(local.uniqueMessages)} unique message.ids, ` +
        `${formatNumber(local.skippedDup)} duplicates skipped.\n\n`,
    );
    process.stdout.write(
      `${"day".padEnd(12)}  ${"truth".padStart(15)}  ${"db".padStart(15)}  ${"ratio".padStart(8)}  ${"drift".padStart(8)}\n`,
    );
    process.stdout.write(`${"-".repeat(66)}\n`);
    for (const r of rows) {
      const ratio = r.ratio == null ? "—" : `${r.ratio.toFixed(3)}x`;
      const drift = r.driftPct == null ? "—" : `${r.driftPct.toFixed(1)}%`;
      process.stdout.write(
        `${r.day.padEnd(12)}  ${formatNumber(r.truth).padStart(15)}  ` +
          `${formatNumber(r.db).padStart(15)}  ${ratio.padStart(8)}  ${drift.padStart(8)}\n`,
      );
    }
    process.stdout.write(`\nMax drift: ${maxDriftPct.toFixed(2)}% (threshold ${args.threshold}%).\n`);
  }

  if (maxDriftPct > args.threshold) {
    if (!args.json) {
      process.stderr.write(
        `\nFAIL drift ${maxDriftPct.toFixed(2)}% exceeds threshold ${args.threshold}%.\n` +
          `If the parser is up to date (vibeusage >= 0.5.0), scrub the Claude/OpenCode cursor\n` +
          `block in ~/.vibeusage/tracker/cursors.json and rerun \`vibeusage sync --drain\`.\n`,
      );
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
