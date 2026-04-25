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
    // Recurse: Claude Code writes the main thread under
    // `projects/<project>/<session>.jsonl` AND subagent threads under
    // `projects/<project>/<sessionId>/subagents/agent-*.jsonl`. Subagents
    // burn real Anthropic tokens, so the audit must include them. Sync's
    // walkClaudeProjects (rollout.js) already recurses; this mirrors it.
    const out = [];
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_err) {
        continue;
      }
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(p);
        else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(p);
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
