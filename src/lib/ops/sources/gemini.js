"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readGeminiMessages, isGeminiSessionName } = require("../../rollout");

/**
 * Gemini audit strategy.
 *
 * Gemini writes one session per file under
 *   ~/.gemini/tmp/<hash>/chats/session-*.json   (legacy, one JSON document)
 *   ~/.gemini/tmp/<hash>/chats/session-*.jsonl  (Gemini CLI >= 0.65, append log)
 * Each `gemini` message's `tokens` is that API call's own usageMetadata (not
 * a running total), and `tokens.total` already covers every channel. We route
 * the total into a single channel so row.truth equals the DB total_tokens.
 *
 * Dedupe: readGeminiMessages replays the file into one entry per message id,
 * matching parseGeminiFile's per-file seen-id set.
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
        if (!isGeminiSessionName(f.name)) continue;
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
    for (const msg of readGeminiMessages(raw, filePath)) {
      if (!msg || msg.type !== "gemini" || !msg.tokens) continue;
      const ts = typeof msg.timestamp === "string" ? msg.timestamp : null;
      if (!ts) continue;
      const delta = { total: nonneg(msg.tokens.total) };
      if (!delta.total) continue;

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
      dedupeId: null, // readGeminiMessages already keeps one entry per message id
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
