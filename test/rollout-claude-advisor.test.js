const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { parseClaudeIncremental } = require("../src/lib/rollout");
const claudeStrategy = require("../src/lib/ops/sources/claude");

// Synthetic Claude Code assistant line. Newer Claude Code writes
// usage.iterations[]: "message" items are already summed into the top-level
// usage, "advisor_message" items (own model) are not.
function line({ id, model, usage, ts = "2026-11-20T10:05:00.000Z" }) {
  return JSON.stringify({
    type: "assistant",
    timestamp: ts,
    requestId: `req_${id}`,
    message: { id, role: "assistant", model, usage },
  });
}

const ADVISOR_USAGE = {
  input_tokens: 4,
  cache_creation_input_tokens: 10,
  cache_read_input_tokens: 100,
  output_tokens: 20,
  output_tokens_details: { thinking_tokens: 8 },
  iterations: [
    { type: "message", input_tokens: 2, cache_creation_input_tokens: 5, cache_read_input_tokens: 60, output_tokens: 12 },
    { type: "advisor_message", model: "claude-fable-5-2", input_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 30 },
    { type: "message", input_tokens: 2, cache_creation_input_tokens: 5, cache_read_input_tokens: 40, output_tokens: 8 },
  ],
};

const OLD_USAGE = {
  input_tokens: 1,
  cache_creation_input_tokens: 2,
  cache_read_input_tokens: 3,
  output_tokens: 4,
};

async function parseLines(lines) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-claude-advisor-"));
  try {
    const jsonl = path.join(dir, "session.jsonl");
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");
    const queuePath = path.join(dir, "queue.jsonl");
    await parseClaudeIncremental({
      projectFiles: [jsonl],
      cursors: { version: 1, files: {}, updatedAt: null },
      queuePath,
    });
    const text = await fs.readFile(queuePath, "utf8");
    const byModel = {};
    for (const row of text.split("\n").filter(Boolean).map((l) => JSON.parse(l))) {
      byModel[row.model] = {
        input_tokens: row.input_tokens,
        cached_input_tokens: row.cached_input_tokens,
        output_tokens: row.output_tokens,
        reasoning_output_tokens: row.reasoning_output_tokens,
        total_tokens: row.total_tokens,
      };
    }
    return byModel;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

test("claude advisor iterations count under their own model; thinking goes to reasoning", async () => {
  const advisorLine = line({ id: "msg_adv", model: "claude-opus-5-5", usage: ADVISOR_USAGE });
  const byModel = await parseLines([
    advisorLine,
    advisorLine, // same message.id written twice: counted once
    line({ id: "msg_old", model: "claude-sonnet-4-5", usage: OLD_USAGE }),
  ]);

  // main: input 4+10=14, cached 100, output 20 split into 12 visible + 8 thinking, total 134
  assert.deepEqual(byModel["claude-opus-5-5"], {
    input_tokens: 14,
    cached_input_tokens: 100,
    output_tokens: 12,
    reasoning_output_tokens: 8,
    total_tokens: 134,
  });
  // advisor: only the advisor_message item, under its own model
  assert.deepEqual(byModel["claude-fable-5-2"], {
    input_tokens: 300,
    cached_input_tokens: 0,
    output_tokens: 30,
    reasoning_output_tokens: 0,
    total_tokens: 330,
  });
  // record without iterations / thinking: unchanged behaviour
  assert.deepEqual(byModel["claude-sonnet-4-5"], {
    input_tokens: 3,
    cached_input_tokens: 3,
    output_tokens: 4,
    reasoning_output_tokens: 0,
    total_tokens: 10,
  });
});

test("claude audit strategy adds advisor tokens and splits thinking out of output", () => {
  const out = claudeStrategy.extractUsage(line({ id: "msg_adv", model: "claude-opus-5-5", usage: ADVISOR_USAGE }));
  assert.deepEqual(out.channels, {
    input: 4 + 300,
    cache_creation: 10,
    cache_read: 100,
    output: 12 + 30,
    reasoning: 8,
  });
  // channel sum = 134 + 330, no double counting
  const c = out.channels;
  assert.equal(c.input + c.cache_creation + c.cache_read + c.output + c.reasoning, 464);
});
