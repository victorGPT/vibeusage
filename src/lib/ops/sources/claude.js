"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  id: "claude",
  displayName: "Claude Code",
  sessionRoot({ home }) {
    return path.join(home, ".claude", "projects");
  },
  walkSessions({ root }) {
    if (!fs.existsSync(root)) return [];
    const out = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!f.isFile()) continue;
        if (!f.name.endsWith(".jsonl")) continue;
        out.push(path.join(dir, f.name));
      }
    }
    return out;
  },
  extractUsage(line) {
    if (!line || !line.includes('"usage"')) return null;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_err) {
      return null;
    }
    const msg = obj?.message || {};
    const usage = msg.usage || obj.usage;
    if (!usage || typeof usage !== "object") return null;
    const timestamp = typeof obj.timestamp === "string" ? obj.timestamp : null;
    if (!timestamp) return null;

    return {
      timestamp,
      dedupeId: msg.id || obj.requestId || null,
      channels: {
        input: usage.input_tokens,
        cache_creation: usage.cache_creation_input_tokens,
        cache_read: usage.cache_read_input_tokens,
        output: usage.output_tokens,
        reasoning: 0,
      },
    };
  },
};
