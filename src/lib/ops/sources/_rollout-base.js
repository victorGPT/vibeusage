"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Shared strategy factory for Codex-family rollout audits.
 *
 * Codex and Every-Code write identical rollout .jsonl streams into
 * <home>/<subdir>/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl. The directory
 * layout is the only difference (CODEX_HOME / CODE_HOME). Token accounting
 * semantics differ from Claude's in two important ways:
 *
 *   1. Token events are `payload.type === "token_count"` rows that carry
 *      `info.total_token_usage` (cumulative) and `info.last_token_usage`
 *      (delta for the latest API call). Events with `info: null` are
 *      rate-limit-only pings and must be ignored.
 *
 *   2. `input_tokens` already includes cached input, and `output_tokens`
 *      already includes `reasoning_output_tokens`. Naively summing all five
 *      channels double-counts. The authoritative per-turn total is simply
 *      `total_tokens` on the upstream payload, which is what normalizeUsage
 *      passes through to the DB unchanged.
 *
 * Approach:
 *   - walkSessions prunes by YYYY/MM/DD directories before hitting the jsonl
 *     files so the auditor does not scan all ~240K Codex rollouts just to
 *     look at the last 14 days.
 *   - iterateRecords is stateful per file: it tracks the last seen
 *     total_token_usage and yields a synthetic delta object whenever the
 *     total changes (uses last_token_usage when available, otherwise the
 *     total_prev diff). Duplicate token_count rows with identical totals are
 *     skipped; that mirrors parseRolloutFile's pickDelta logic.
 *   - extractUsage routes the authoritative `total_tokens` number into the
 *     `output` channel and zeroes the rest. The framework sums the five
 *     channels to compute row.truth, so putting the whole total into one
 *     channel is a deliberate trick that keeps day totals correct without
 *     exposing Codex's overlapping channel semantics through the generic
 *     contract.
 */

function makeRolloutStrategy({ id, displayName, envKey, defaultSubdir }) {
  return {
    id,
    displayName,
    sessionRoot({ home, env }) {
      const base = (env && env[envKey]) || path.join(home, defaultSubdir);
      return path.join(base, "sessions");
    },
    walkSessions({ root, windowStartIso }) {
      if (!fs.existsSync(root)) return [];
      // Rollout events written on day N can carry timestamps from day N-1
      // (sessions straddle midnight). Keep directories starting one day
      // before the window so we do not drop boundary events.
      const bufferDay = shiftIsoDay(windowStartIso, -1);
      const out = [];
      for (const year of safeReadDirSync(root)) {
        if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
        const yearDir = path.join(root, year.name);
        for (const month of safeReadDirSync(yearDir)) {
          if (!month.isDirectory() || !/^\d{2}$/.test(month.name)) continue;
          const monthDir = path.join(yearDir, month.name);
          for (const day of safeReadDirSync(monthDir)) {
            if (!day.isDirectory() || !/^\d{2}$/.test(day.name)) continue;
            if (bufferDay) {
              const dayIso = `${year.name}-${month.name}-${day.name}`;
              if (dayIso < bufferDay) continue;
            }
            const dayDir = path.join(monthDir, day.name);
            for (const f of safeReadDirSync(dayDir)) {
              if (!f.isFile()) continue;
              if (!f.name.startsWith("rollout-") || !f.name.endsWith(".jsonl")) continue;
              out.push(path.join(dayDir, f.name));
            }
          }
        }
      }
      return out;
    },
    *iterateRecords(filePath) {
      let text;
      try {
        text = fs.readFileSync(filePath, "utf8");
      } catch (_err) {
        return;
      }
      if (!text) return;
      let prevTotal = null;
      for (const line of text.split("\n")) {
        if (!line || !line.includes("token_count")) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_err) {
          continue;
        }
        const payload = obj?.payload;
        if (!payload || payload.type !== "token_count") continue;
        const info = payload.info;
        if (!info) continue;
        const total = info.total_token_usage || null;
        const last = info.last_token_usage || null;
        if (!total && !last) continue;
        // Duplicate token_count: same totals, skip.
        if (prevTotal && total && sameUsage(prevTotal, total)) continue;
        let delta;
        if (last && Number(last.total_tokens) > 0) {
          delta = last;
        } else if (prevTotal && total) {
          delta = diffUsage(total, prevTotal);
        } else if (total) {
          delta = total;
        } else {
          delta = null;
        }
        if (total) prevTotal = total;
        if (!delta || !Number(delta.total_tokens)) continue;
        yield {
          line: JSON.stringify({ timestamp: obj.timestamp, delta }),
          context: { filePath },
        };
      }
    },
    extractUsage(line) {
      if (!line) return null;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (_err) {
        return null;
      }
      const ts = typeof obj.timestamp === "string" ? obj.timestamp : null;
      const d = obj.delta;
      if (!ts || !d) return null;
      const totalTokens = Number(d.total_tokens);
      if (!Number.isFinite(totalTokens) || totalTokens <= 0) return null;
      return {
        timestamp: ts,
        dedupeId: null, // per-file dedup already done in iterateRecords
        channels: {
          input: 0,
          cache_creation: 0,
          cache_read: 0,
          // Route the authoritative Codex upstream total into a single
          // channel so the framework's sum-of-channels lands on it. See
          // module docstring for why we do not split the channels.
          output: totalTokens,
          reasoning: 0,
        },
      };
    },
  };
}

function safeReadDirSync(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch (_err) {
    return [];
  }
}

function sameUsage(a, b) {
  if (!a || !b) return false;
  for (const k of [
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
  ]) {
    if (Number(a[k] || 0) !== Number(b[k] || 0)) return false;
  }
  return true;
}

function diffUsage(curr, prev) {
  if (!curr || !prev) return curr || null;
  const currTotal = Number(curr.total_tokens || 0);
  const prevTotal = Number(prev.total_tokens || 0);
  if (currTotal < prevTotal) return curr; // session reset
  const out = {};
  for (const k of [
    "input_tokens",
    "cached_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
  ]) {
    out[k] = Math.max(0, Number(curr[k] || 0) - Number(prev[k] || 0));
  }
  return out;
}

function shiftIsoDay(iso, deltaDays) {
  if (typeof iso !== "string" || !iso) return null;
  const base = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

module.exports = { makeRolloutStrategy };
