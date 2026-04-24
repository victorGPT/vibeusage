"use strict";

/**
 * audit-source.js — generic ground-truth auditor.
 *
 * Every AI CLI source (claude, opencode, codex, gemini, kimi, ...) carries a
 * different session-log layout and token schema, but the audit shape is the
 * same: walk local sessions, dedup by upstream id, sum all channels per day,
 * then compare against DB totals.
 *
 * This module captures that shape. Source-specific knowledge lives in
 * src/lib/ops/sources/<id>.js as a `strategy` object (see CONTRACT below).
 *
 * CONTRACT (strategy shape):
 *   {
 *     id: "claude" | "opencode" | ...,
 *     displayName: "Claude Code",
 *     sessionRoot({ home, env }) -> absolute path,
 *     walkSessions({ root }) -> string[]  // list of files/dbs to read
 *     extractUsage(line, context) -> null | {
 *       timestamp: "<ISO8601>",
 *       dedupeId: "<stable id>" | null,
 *       channels: { input, cache_creation, cache_read, output, reasoning }
 *     }
 *     // optional: skip the jsonl line-by-line reader if the source uses sqlite
 *     //            and must iterate rows differently
 *     iterateRecords(filePath) -> iterable<{ line, context }>
 *   }
 *
 * Consumers:
 *   - doctor --audit-tokens --source <id>
 *   - scripts/ops/compare-<source>-ground-truth.cjs  (thin CLI wrappers)
 */

const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const DEFAULT_DAYS = 14;
const DEFAULT_THRESHOLD_PCT = 25;

function runSourceAudit({
  strategy,
  days = DEFAULT_DAYS,
  threshold = DEFAULT_THRESHOLD_PCT,
  userId = null,
  deviceId = null,
  dbJsonPath = null,
  dbJson = null,
  home = os.homedir(),
  env = process.env,
  sessionRootOverride = null,
} = {}) {
  if (!strategy || typeof strategy !== "object") {
    throw new Error("runSourceAudit requires a strategy object");
  }
  for (const key of ["id", "sessionRoot", "walkSessions", "extractUsage"]) {
    if (typeof strategy[key] !== "function" && typeof strategy[key] !== "string") {
      throw new Error(`strategy.${key} is required`);
    }
  }
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`days must be a positive number, got ${days}`);
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`threshold must be non-negative, got ${threshold}`);
  }

  const root = sessionRootOverride || strategy.sessionRoot({ home, env });
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const windowStartIso = start.toISOString();
  const files = strategy.walkSessions({ root, windowStartIso });
  if (!files || files.length === 0) {
    return {
      ok: false,
      error: "no-local-sessions",
      source: strategy.id,
      message: `no local sessions for source=${strategy.id} under ${root}`,
      rows: [],
      maxDriftPct: 0,
    };
  }

  const local = computeLocalTotals({ files, windowStartIso, strategy });

  let backend;
  if (dbJson) {
    try {
      backend = parseDbJson(dbJson);
    } catch (err) {
      return { ok: false, error: "db-json-parse", source: strategy.id, message: err.message, rows: [], maxDriftPct: 0 };
    }
  } else if (dbJsonPath) {
    let blob;
    try {
      blob = fs.readFileSync(dbJsonPath, "utf8");
    } catch (err) {
      return {
        ok: false,
        error: "db-json-read-failed",
        source: strategy.id,
        message: `cannot read ${dbJsonPath}: ${err?.message || err}`,
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
        source: strategy.id,
        message:
          "cannot resolve user_id; pass userId explicitly, supply dbJson, or make sure `insforge` CLI is linked to the vibeusage workspace and config.deviceId is set",
        rows: [],
        maxDriftPct: 0,
      };
    }
    const queryRes = queryDbTotalsViaInsforge({
      userId: resolvedUserId,
      source: strategy.id,
      windowStartIso,
    });
    if (!queryRes.ok) {
      return { ...queryRes, source: strategy.id, rows: [], maxDriftPct: 0 };
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
    source: strategy.id,
    displayName: strategy.displayName || strategy.id,
    windowStartIso,
    days,
    thresholdPct: threshold,
    filesScanned: files.length,
    usageLines: local.scanned,
    uniqueMessages: local.uniqueIds,
    duplicatesSkipped: local.skippedDup,
    rows,
    maxDriftPct: Number(maxDriftPct.toFixed(2)),
    exceedsThreshold: maxDriftPct > threshold,
  };
}

function computeLocalTotals({ files, windowStartIso, strategy }) {
  const byDay = new Map();
  const seen = new Set();
  let scanned = 0;
  let skippedDup = 0;

  const records = typeof strategy.iterateRecords === "function"
    ? strategy.iterateRecords
    : defaultIterateRecords;

  for (const filePath of files) {
    for (const { line, context } of records(filePath)) {
      const extracted = strategy.extractUsage(line, context);
      if (!extracted) continue;
      const { timestamp, dedupeId, channels } = extracted;
      if (!timestamp || timestamp < windowStartIso) continue;
      const day = isoDay(timestamp);
      if (!day) continue;

      scanned += 1;
      if (dedupeId && seen.has(dedupeId)) {
        skippedDup += 1;
        continue;
      }
      if (dedupeId) seen.add(dedupeId);

      const input = nonneg(channels.input);
      const cacheCreation = nonneg(channels.cache_creation);
      const cacheRead = nonneg(channels.cache_read);
      const output = nonneg(channels.output);
      const reasoning = nonneg(channels.reasoning);
      const total = input + cacheCreation + cacheRead + output + reasoning;
      if (total === 0) continue;

      let row = byDay.get(day);
      if (!row) {
        row = {
          total: 0,
          input: 0,
          cache_creation: 0,
          cache_read: 0,
          output: 0,
          reasoning: 0,
          messages: 0,
        };
        byDay.set(day, row);
      }
      row.total += total;
      row.input += input;
      row.cache_creation += cacheCreation;
      row.cache_read += cacheRead;
      row.output += output;
      row.reasoning += reasoning;
      row.messages += 1;
    }
  }

  return { byDay, scanned, skippedDup, uniqueIds: seen.size };
}

function* defaultIterateRecords(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (_err) {
    return;
  }
  for (const line of text.split("\n")) {
    if (!line) continue;
    yield { line, context: { filePath } };
  }
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

function queryDbTotalsViaInsforge({ userId, source, windowStartIso }) {
  const sql =
    `SELECT DATE(hour_start) AS day, SUM(total_tokens) AS tokens ` +
    `FROM vibeusage_tracker_hourly ` +
    `WHERE source='${source}' AND user_id='${userId}' AND hour_start >= '${windowStartIso}' ` +
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

// Registry for doctor --audit-tokens --source routing.
// Register new strategies as they land in sources/<id>.js.
function getStrategy(id) {
  switch (id) {
    case "claude":
      // eslint-disable-next-line global-require
      return require("./sources/claude");
    case "opencode":
      // eslint-disable-next-line global-require
      return require("./sources/opencode");
    case "codex":
      // eslint-disable-next-line global-require
      return require("./sources/codex");
    case "every-code":
      // eslint-disable-next-line global-require
      return require("./sources/every-code");
    case "gemini":
      // eslint-disable-next-line global-require
      return require("./sources/gemini");
    case "kimi":
      // eslint-disable-next-line global-require
      return require("./sources/kimi");
    case "hermes":
      // eslint-disable-next-line global-require
      return require("./sources/hermes");
    case "openclaw":
      // eslint-disable-next-line global-require
      return require("./sources/openclaw");
    default:
      return null;
  }
}

function listRegisteredSources() {
  return ["claude", "opencode", "codex", "every-code", "gemini", "kimi", "hermes", "openclaw"];
}

module.exports = {
  DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT,
  runSourceAudit,
  getStrategy,
  listRegisteredSources,
};
