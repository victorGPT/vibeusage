const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { parseClaudeIncremental } = require("../src/lib/rollout");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-claude-metric-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function assistantLine({ ts, messageId, uuid, input = 1, cc = 0, cr = 0, output = 1 }) {
  return JSON.stringify({
    parentUuid: null,
    uuid: uuid || `u-${messageId}-${Math.random().toString(36).slice(2)}`,
    timestamp: ts,
    type: "assistant",
    requestId: `req-${messageId}`,
    message: {
      id: messageId,
      role: "assistant",
      model: "claude-sonnet-4.5",
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: cc,
        cache_read_input_tokens: cr,
        output_tokens: output,
      },
    },
  });
}

test("parseClaudeIncremental reports dedupSkipped alongside eventsAggregated", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    const lines = [
      // 2 unique messages...
      assistantLine({ ts: "2026-04-24T10:00:00Z", messageId: "A", uuid: "u1" }),
      assistantLine({ ts: "2026-04-24T10:00:05Z", messageId: "B", uuid: "u2" }),
      // ...plus 3 duplicates of A and 1 duplicate of B (4 dedup skips)
      assistantLine({ ts: "2026-04-24T10:00:06Z", messageId: "A", uuid: "u3" }),
      assistantLine({ ts: "2026-04-24T10:00:07Z", messageId: "A", uuid: "u4" }),
      assistantLine({ ts: "2026-04-24T10:00:08Z", messageId: "A", uuid: "u5" }),
      assistantLine({ ts: "2026-04-24T10:00:09Z", messageId: "B", uuid: "u6" }),
    ];
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parseClaudeIncremental({
      projectFiles: [jsonl],
      cursors,
      queuePath,
    });
    assert.equal(result.eventsAggregated, 2, "unique messages counted once");
    assert.equal(result.dedupSkipped, 4, "duplicates counted as skipped");
  });
});

test("parseClaudeIncremental reports zero dedupSkipped when there are no duplicates", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    const lines = [
      assistantLine({ ts: "2026-04-24T09:00:00Z", messageId: "X", uuid: "u1" }),
      assistantLine({ ts: "2026-04-24T09:00:01Z", messageId: "Y", uuid: "u2" }),
    ];
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parseClaudeIncremental({
      projectFiles: [jsonl],
      cursors,
      queuePath,
    });
    assert.equal(result.eventsAggregated, 2);
    assert.equal(result.dedupSkipped, 0);
  });
});
