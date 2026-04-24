"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Gemini audit strategy.
 *
 * Gemini writes one JSON per session under
 *   ~/.gemini/tmp/<hash>/chats/session-YYYY-MM-DDTHH-MM-<id>.json
 * The file has `{ messages: [ { role, timestamp, model, tokens } ] }` where
 * `tokens` is the cumulative usage up to that message (not a per-turn delta).
 *
 * Channel semantics differ from Claude but match Codex in one important way:
 *   input + cached + output + tool + thoughts != total
 * because `tokens.total` is the authoritative upstream count that
 * src/lib/rollout.js normalizeGeminiTokens passes through as-is to the DB.
 * Naively summing the five sub-channels double-counts. As with the Codex
 * strategy, we route `delta.total` into the output channel and zero the rest
 * so the framework's sum-of-channels row.truth equals the DB total_tokens
 * without exposing Gemini's internal breakdown through the generic contract.
 *
 * Dedupe:
 *   - Per-file index diff mirrors parseGeminiFile's `lastTotals` state.
 *   - When `tokens.total` drops (session reset / resume), we treat the current
 *     cumulative as the delta just like the parser does.
 */

module.exports = {
  id: "gemini",
  displayName: "Gemini CLI",
  sessionRoot({ home, env }) {
    const base = (env && env.GEMINI_HOME) || path.join(home, ".gemini");
    return path.join(base, "tmp");
  },
  walkSessions({ root }) {
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const hash of safeReadDirSync(root)) {
      if (!hash.isDirectory()) continue;
      const chatsDir = path.join(root, hash.name, "chats");
      for (const f of safeReadDirSync(chatsDir)) {
        if (!f.isFile()) continue;
        if (!f.name.startsWith("session-") || !f.name.endsWith(".json")) continue;
        out.push(path.join(chatsDir, f.name));
      }
    }
    return out;
  },
  *iterateRecords(filePath) {
    let raw;
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch (_err) {
      return;
    }
    if (!raw.trim()) return;
    let session;
    try {
      session = JSON.parse(raw);
    } catch (_err) {
      return;
    }
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    let prevTotals = null;
    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue;
      const ts = typeof msg.timestamp === "string" ? msg.timestamp : null;
      if (!ts) continue;
      const tokens = msg.tokens;
      if (!tokens || typeof tokens !== "object") continue;

      const curr = normalizeTokens(tokens);
      const delta = diffTotals(curr, prevTotals);
      prevTotals = curr;
      if (!delta || !delta.total) continue;

      yield {
        line: JSON.stringify({ timestamp: ts, delta }),
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
    if (!ts || !d || !Number(d.total)) return null;
    return {
      timestamp: ts,
      dedupeId: null, // per-file index diff already dedupes
      channels: {
        input: 0,
        cache_creation: 0,
        cache_read: 0,
        // Route the authoritative upstream total into a single channel; see
        // module docstring for why we do not split it.
        output: Number(d.total),
        reasoning: 0,
      },
    };
  },
};

function normalizeTokens(tokens) {
  return {
    input: nonneg(tokens.input),
    cached: nonneg(tokens.cached),
    output: nonneg(tokens.output),
    tool: nonneg(tokens.tool),
    thoughts: nonneg(tokens.thoughts),
    total: nonneg(tokens.total),
  };
}

function diffTotals(curr, prev) {
  if (!curr) return null;
  if (!prev) {
    // First message with tokens — the whole cumulative value is the delta.
    return curr;
  }
  // Session reset: upstream total decreased (resume / new session). Trust the
  // new value as the full delta.
  if (curr.total < prev.total) return curr;
  const delta = {
    input: Math.max(0, curr.input - prev.input),
    cached: Math.max(0, curr.cached - prev.cached),
    output: Math.max(0, curr.output - prev.output),
    tool: Math.max(0, curr.tool - prev.tool),
    thoughts: Math.max(0, curr.thoughts - prev.thoughts),
    total: Math.max(0, curr.total - prev.total),
  };
  return delta;
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
