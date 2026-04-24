"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * OpenClaw audit strategy.
 *
 * Like Hermes, OpenClaw hands vibeusage pre-aggregated ledger rows instead of
 * raw session logs:
 *   ~/.vibeusage/tracker/openclaw-usage-ledger.jsonl
 * Each line is a camelCase event
 *   { eventId, emittedAt, source, model, inputTokens, cachedInputTokens,
 *     outputTokens, reasoningOutputTokens, totalTokens }
 * src/commands/sync.js parseOpenclawSanitizedLedger copies `totalTokens`
 * straight into the bucket, so this audit routes the upstream total into the
 * output channel. Dedupe is keyed on eventId, which the ledger writer
 * already enforces uniqueness of.
 */

module.exports = {
  id: "openclaw",
  displayName: "OpenClaw Plugin",
  sessionRoot({ home, env }) {
    const base = (env && env.VIBEUSAGE_HOME) || path.join(home, ".vibeusage");
    return path.join(base, "tracker");
  },
  walkSessions({ root }) {
    const ledger = path.join(root, "openclaw-usage-ledger.jsonl");
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
    if (!event || typeof event !== "object") return null;
    const timestamp = typeof event.emittedAt === "string" ? event.emittedAt : null;
    if (!timestamp) return null;
    const total = nonneg(event.totalTokens);
    if (total === 0) return null;
    return {
      timestamp,
      dedupeId: typeof event.eventId === "string" && event.eventId ? event.eventId : null,
      channels: {
        input: 0,
        cache_creation: 0,
        cache_read: 0,
        output: total,
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
