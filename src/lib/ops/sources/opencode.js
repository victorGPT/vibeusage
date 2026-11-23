"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { V2_PROBE_QUERY, V2_MESSAGE_FILTER } = require("../../opencode-sqlite");

// v2 data has no role (it's the type column) and may omit id; inject both so extractUsage reads it like v1.
const V2_AUDIT_QUERY =
  "SELECT json_set(m.data, '$.id', coalesce(json_extract(m.data, '$.id'), m.id), '$.role', 'assistant') " +
  `FROM session_message m LEFT JOIN session_v2 s ON s.id = m.session_id WHERE ${V2_MESSAGE_FILTER};`;
const V1_AUDIT_QUERY = "SELECT json_set(data, '$.id', coalesce(json_extract(data, '$.id'), id)) FROM message;";

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
 *   - New OpenCode installs persist into <opencodeHome>/opencode.db (sqlite).
 *     walkSessions also returns that db; iterateRecords reads its message
 *     rows via the sqlite3 CLI. v1 rows keep id in the table column, not in
 *     data, so the column is merged in (same dedupeId as the JSON files).
 *     v2 dbs (session_v2 present) are read from session_message with the
 *     same row filter the sync uses.
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
    const out = [];
    const dbPath = path.join(root, "..", "..", "opencode.db");
    if (fs.existsSync(dbPath)) out.push(dbPath);
    if (!fs.existsSync(root)) return out;
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
    if (filePath.endsWith(".db")) {
      // Throws when sqlite3 is missing or the query fails; runSourceAudit turns
      // that into local-read-failed instead of counting the db as zero.
      const sqlite = (query) =>
        execFileSync("sqlite3", ["-readonly", filePath, query], {
          encoding: "utf8",
          maxBuffer: 256 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        });
      const stdout = sqlite(sqlite(V2_PROBE_QUERY).trim() === "1" ? V2_AUDIT_QUERY : V1_AUDIT_QUERY);
      for (const line of stdout.split("\n")) {
        if (line.trim()) yield { line, context: { filePath } };
      }
      return;
    }
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
