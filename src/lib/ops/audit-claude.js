"use strict";

/**
 * audit-claude.js
 *
 * Reusable core for the Claude Code ground-truth audit. Walks local
 * ~/.claude/projects/*.jsonl (dedup by message.id, sum all 4 channels) and
 * compares against vibeusage_tracker_hourly totals pulled either from a
 * caller-supplied JSON blob or via the `insforge` CLI.
 *
 * Consumers:
 *   - scripts/ops/compare-claude-ground-truth.cjs (ops CLI wrapper)
 *   - src/commands/doctor.js   (`vibeusage doctor --audit-tokens`)
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_DAYS = 14;
const DEFAULT_THRESHOLD_PCT = 25;

function runAudit({
  days = DEFAULT_DAYS,
  threshold = DEFAULT_THRESHOLD_PCT,
  userId = null,
  deviceId = null,
  dbJsonPath = null,
  dbJson = null,
  projectsDir = path.join(os.homedir(), ".claude", "projects"),
} = {}) {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`days must be a positive number, got ${days}`);
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`threshold must be non-negative, got ${threshold}`);
  }

  const files = listClaudeJsonl(projectsDir);
  if (files.length === 0) {
    return {
      ok: false,
      error: "no-local-sessions",
      message: `no Claude Code session files under ${projectsDir}`,
      rows: [],
      maxDriftPct: 0,
    };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const windowStartIso = start.toISOString();

  const local = computeLocalTotals({ files, windowStartIso });

  let backend;
  if (dbJson) {
    backend = parseDbJson(dbJson);
  } else if (dbJsonPath) {
    let blob;
    try {
      blob = fs.readFileSync(dbJsonPath, "utf8");
    } catch (err) {
      return {
        ok: false,
        error: "db-json-read-failed",
        message: `cannot read --db-json ${dbJsonPath}: ${err?.message || err}`,
        rows: [],
        maxDriftPct: 0,
      };
    }
    backend = parseDbJson(blob);
  } else {
    const resolvedUserId = userId || resolveUserIdViaInsforge({ deviceId });
    if (!resolvedUserId) {
      return {
        ok: false,
        error: "cannot-resolve-user-id",
        message:
          "cannot resolve user_id; pass userId explicitly, supply dbJson, or make sure `insforge` CLI is linked to the vibeusage workspace and config.deviceId is set",
        rows: [],
        maxDriftPct: 0,
      };
    }
    const queryRes = queryDbTotalsViaInsforge({
      userId: resolvedUserId,
      windowStartIso,
    });
    if (!queryRes.ok) {
      return { ...queryRes, rows: [], maxDriftPct: 0 };
    }
    backend = queryRes.byDay;
  }

  const dayKeys = Array.from(new Set([...local.byDay.keys(), ...backend.keys()])).sort();
  const rows = [];
  let maxDriftPct = 0;
  for (const day of dayKeys) {
    const truth = (local.byDay.get(day) || { total: 0 }).total;
    const dbTotal = backend.get(day) || 0;
    const ratio = truth > 0 ? dbTotal / truth : null;
    const drift = ratio == null ? null : Math.abs(ratio - 1) * 100;
    if (drift != null && drift > maxDriftPct) maxDriftPct = drift;
    rows.push({ day, truth, db: dbTotal, ratio, driftPct: drift });
  }

  return {
    ok: true,
    windowStartIso,
    days,
    thresholdPct: threshold,
    filesScanned: files.length,
    usageLines: local.scanned,
    uniqueMessages: local.uniqueMessages,
    duplicatesSkipped: local.skippedDup,
    rows,
    maxDriftPct: Number(maxDriftPct.toFixed(2)),
    exceedsThreshold: maxDriftPct > threshold,
  };
}

function listClaudeJsonl(projectsDir) {
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

function isoDay(ts) {
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function nonneg(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function resolveUserIdViaInsforge({ deviceId }) {
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
  const m = (r.stdout || "").match(
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
  );
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
    return {
      ok: false,
      error: "insforge-db-query-failed",
      message:
        `\`insforge db query\` failed (${r.status}). Run \`insforge current\` to confirm ` +
        `the CLI is linked to the vibeusage workspace, or pass dbJson directly.`,
    };
  }
  return { ok: true, byDay: parseDbJson(r.stdout) };
}

function parseDbJson(blob) {
  let parsed;
  if (typeof blob === "object" && blob !== null) {
    parsed = blob;
  } else {
    try {
      parsed = JSON.parse(blob);
    } catch (err) {
      throw new Error(`cannot parse DB JSON: ${err?.message || err}`);
    }
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.data)
        ? parsed.data
        : null;
  if (!rows) {
    throw new Error(
      `DB JSON shape unexpected (need array of {day, tokens}); got ${
        Object.keys(parsed || {}).join(",") || "(empty)"
      }`,
    );
  }
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

module.exports = {
  DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT,
  runAudit,
};
