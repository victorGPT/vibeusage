"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * OpenCode audit strategy.
 *
 * OpenCode persists one JSON per assistant message under
 *   ~/.local/share/opencode/storage/message/ses_<session>/msg_<id>.json
 * Each file looks like:
 *   {
 *     role: "assistant",
 *     id: "msg_...",
 *     modelID: "...",
 *     tokens: { input, output, reasoning, cache: { read, write } },
 *     time: { created, completed }
 *   }
 *
 * Channel mapping matches src/lib/rollout.js normalizeOpencodeTokens so the
 * audit's truth sum equals what the parser emits into vibeusage_tracker_hourly
 * (post PR #153, which added cache.read to total):
 *     total = input + cache.write + cache.read + output + reasoning
 *
 * Notes:
 *   - OPENCODE_HOME / XDG_DATA_HOME env vars override the default root (matches
 *     the same logic used by src/commands/sync.js).
 *   - Only assistant messages carry tokens; user messages return null from
 *     extractUsage so the generic runner skips them.
 *   - New OpenCode installs may persist into opencode.db (sqlite) instead of
 *     these JSON files. The audit reports no-local-sessions in that case;
 *     users can dump the same rows to a JSON file and feed --db-json to
 *     compare via the backend path.
 */

module.exports = {
  id: "opencode",
  displayName: "OpenCode",
  sessionRoot({ home, env }) {
    const xdg = env.XDG_DATA_HOME || path.join(home, ".local", "share");
    const opencodeHome = env.OPENCODE_HOME || path.join(xdg, "opencode");
    return path.join(opencodeHome, "storage", "message");
  },
  walkSessions({ root }) {
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!f.isFile()) continue;
        if (!f.name.startsWith("msg_") || !f.name.endsWith(".json")) continue;
        out.push(path.join(dir, f.name));
      }
    }
    return out;
  },
  // OpenCode is one JSON per file (not JSONL). Yield the whole file body as a
  // single "line" so extractUsage can JSON.parse it uniformly with the
  // line-based contract.
  *iterateRecords(filePath) {
    let text;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (_err) {
      return;
    }
    if (!text.trim()) return;
    yield { line: text, context: { filePath } };
  },
  extractUsage(line) {
    if (!line) return null;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_err) {
      return null;
    }
    if (obj?.role !== "assistant") return null;
    const tokens = obj.tokens;
    if (!tokens || typeof tokens !== "object") return null;
    const completed = obj?.time?.completed;
    const created = obj?.time?.created;
    const epochMs = typeof completed === "number" ? completed : typeof created === "number" ? created : null;
    if (!epochMs || !Number.isFinite(epochMs)) return null;

    const cache = tokens.cache && typeof tokens.cache === "object" ? tokens.cache : {};
    return {
      timestamp: new Date(epochMs).toISOString(),
      dedupeId: typeof obj.id === "string" && obj.id ? obj.id : null,
      channels: {
        input: tokens.input,
        cache_creation: cache.write,
        cache_read: cache.read,
        output: tokens.output,
        reasoning: tokens.reasoning,
      },
    };
  },
};
