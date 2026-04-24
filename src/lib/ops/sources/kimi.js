"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Kimi audit strategy.
 *
 * Kimi CLI writes one wire log per session:
 *   ~/.kimi/sessions/<project>/<sessionId>/wire.jsonl
 * Each StatusUpdate line carries the delta for one Anthropic-compatible
 * message:
 *   { timestamp: <unix_seconds float>,
 *     message: { type: "StatusUpdate",
 *                payload: { message_id, token_usage: {
 *                  input_other, input_cache_creation,
 *                  input_cache_read, output } } } }
 *
 * Channel mapping lines up with src/lib/rollout.js normalizeKimiUsage so the
 * framework's sum-of-channels row.truth equals the DB total_tokens:
 *     input        = input_other + input_cache_creation
 *     cache_read   = input_cache_read
 *     output       = output
 *     (cache_creation, reasoning) = 0  (already folded into input / n/a)
 *     total        = input + cache_read + output
 *
 * Dedupe key: payload.message_id (chatcmpl-…). Kimi does not currently
 * duplicate rows the way Claude Code does, but keying on message_id is
 * free insurance and matches the AGENTS.md intake checklist.
 */

module.exports = {
  id: "kimi",
  displayName: "Kimi CLI",
  sessionRoot({ home, env }) {
    const base = (env && env.KIMI_HOME) || path.join(home, ".kimi");
    return path.join(base, "sessions");
  },
  walkSessions({ root }) {
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const proj of safeReadDirSync(root)) {
      if (!proj.isDirectory()) continue;
      const projDir = path.join(root, proj.name);
      for (const session of safeReadDirSync(projDir)) {
        if (!session.isDirectory()) continue;
        const wire = path.join(projDir, session.name, "wire.jsonl");
        if (!fs.existsSync(wire)) continue;
        out.push(wire);
      }
    }
    return out;
  },
  extractUsage(line) {
    if (!line || !line.includes("StatusUpdate")) return null;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_err) {
      return null;
    }
    if (obj?.message?.type !== "StatusUpdate") return null;
    const payload = obj.message.payload;
    const tokens = payload?.token_usage;
    if (!tokens || typeof tokens !== "object") return null;
    const timestamp = unixSecondsToIso(obj.timestamp);
    if (!timestamp) return null;
    return {
      timestamp,
      dedupeId: typeof payload.message_id === "string" && payload.message_id
        ? payload.message_id
        : null,
      channels: {
        input: nonneg(tokens.input_other) + nonneg(tokens.input_cache_creation),
        cache_creation: 0, // already folded into input per normalizeKimiUsage
        cache_read: nonneg(tokens.input_cache_read),
        output: nonneg(tokens.output),
        reasoning: 0,
      },
    };
  },
};

function unixSecondsToIso(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function nonneg(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function safeReadDirSync(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true });
  } catch (_err) {
    return [];
  }
}
