"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Hermes audit strategy.
 *
 * Hermes does not write raw session logs; it emits one pre-aggregated event
 * per turn into the vibeusage tracker directory:
 *   ~/.vibeusage/tracker/hermes.usage.jsonl
 * Each line is a `{type: "usage", emitted_at, model, input_tokens,
 * output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
 * total_tokens}` record. src/commands/sync.js parseHermesUsageLedger already
 * copies `total_tokens` straight into the bucket, so this audit routes the
 * upstream total into the output channel — same pattern we use for Codex and
 * Gemini.
 *
 * sessionRoot: the tracker directory (NOT `~/.hermes/...` — Hermes usage data
 * lives under ~/.vibeusage/tracker because Hermes is a plugin that hands
 * vibeusage ledger rows directly).
 */

module.exports = {
  id: "hermes",
  displayName: "Hermes Plugin",
  sessionRoot({ home, env }) {
    const base = (env && env.VIBEUSAGE_HOME) || path.join(home, ".vibeusage");
    return path.join(base, "tracker");
  },
  walkSessions({ root }) {
    const ledger = path.join(root, "hermes.usage.jsonl");
    if (!fs.existsSync(ledger)) return [];
    return [ledger];
  },
  extractUsage(line) {
    if (!line) return null;
    let event;
    try {
      event = JSON.parse(line);
    } catch (_err) {
      return null;
    }
    if (!event || event.type !== "usage") return null;
    const timestamp = typeof event.emitted_at === "string" ? event.emitted_at : null;
    if (!timestamp) return null;
    const total = nonneg(event.total_tokens);
    if (total === 0) return null;
    return {
      timestamp,
      // Hermes ledger records do not carry a stable per-event id;
      // the ledger is append-only and duplicates are prevented at write time.
      dedupeId: null,
      channels: {
        input: 0,
        cache_creation: 0,
        cache_read: 0,
        output: total, // route authoritative upstream total here
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
