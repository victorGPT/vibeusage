const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { parseClaudeIncremental } = require("../src/lib/rollout");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-claude-dedupe-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function assistantLine({
  ts,
  messageId,
  requestId,
  uuid,
  model = "claude-sonnet-4.5",
  input = 10,
  cacheCreation = 0,
  cacheRead = 0,
  output = 5,
}) {
  return JSON.stringify({
    parentUuid: null,
    uuid: uuid || `uuid-${Math.random().toString(36).slice(2)}`,
    timestamp: ts,
    type: "assistant",
    requestId,
    message: {
      id: messageId,
      role: "assistant",
      model,
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: cacheRead,
        output_tokens: output,
      },
    },
  });
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!text.trim()) return [];
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("parseClaudeIncremental deduplicates repeated message.id within one file", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    // Claude Code sometimes writes the same assistant message twice
    // (different outer uuid, identical message.id + requestId).
    const lines = [
      assistantLine({
        ts: "2026-04-14T14:46:38.491Z",
        messageId: "msg_A",
        requestId: "req_A",
        uuid: "u1",
        input: 3,
        cacheCreation: 17229,
        cacheRead: 12958,
        output: 492,
      }),
      assistantLine({
        ts: "2026-04-14T14:46:43.299Z",
        messageId: "msg_A", // duplicate
        requestId: "req_A",
        uuid: "u2",
        input: 3,
        cacheCreation: 17229,
        cacheRead: 12958,
        output: 492,
      }),
      assistantLine({
        ts: "2026-04-14T14:46:45.000Z",
        messageId: "msg_B", // new message
        requestId: "req_B",
        uuid: "u3",
        input: 1,
        cacheCreation: 100,
        cacheRead: 50,
        output: 20,
      }),
    ];
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parseClaudeIncremental({
      projectFiles: [jsonl],
      cursors,
      queuePath,
    });

    // 2 unique messages aggregated (msg_A once, msg_B once) — not 3.
    assert.equal(result.eventsAggregated, 2);

    const queued = await readJsonLines(queuePath);
    const totalInput = queued.reduce((s, b) => s + Number(b.input_tokens || 0), 0);
    const totalOutput = queued.reduce((s, b) => s + Number(b.output_tokens || 0), 0);
    const totalCached = queued.reduce((s, b) => s + Number(b.cached_input_tokens || 0), 0);
    // msg_A: input(3) + cache_creation(17229) = 17232; msg_B: 1 + 100 = 101
    assert.equal(totalInput, 17232 + 101);
    // msg_A output 492 + msg_B output 20
    assert.equal(totalOutput, 492 + 20);
    // cached = cache_read_input_tokens; msg_A 12958 + msg_B 50
    assert.equal(totalCached, 12958 + 50);

    // Cursor persisted seenIds
    const saved = cursors.files[jsonl];
    assert.ok(Array.isArray(saved.seenIds), "cursor should persist seenIds");
    assert.ok(saved.seenIds.includes("msg_A"));
    assert.ok(saved.seenIds.includes("msg_B"));
  });
});

test("parseClaudeIncremental deduplicates across sync invocations via cursor", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    const first = assistantLine({
      ts: "2026-04-14T14:00:00Z",
      messageId: "msg_X",
      requestId: "req_X",
      uuid: "u1",
      input: 10,
      output: 5,
    });
    await fs.writeFile(jsonl, `${first}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const r1 = await parseClaudeIncremental({ projectFiles: [jsonl], cursors, queuePath });
    assert.equal(r1.eventsAggregated, 1);

    // Appending the same message.id (Claude Code replaying the event) + a new one.
    const replay = assistantLine({
      ts: "2026-04-14T14:00:02Z",
      messageId: "msg_X", // same id
      requestId: "req_X",
      uuid: "u2",
      input: 10,
      output: 5,
    });
    const next = assistantLine({
      ts: "2026-04-14T14:00:05Z",
      messageId: "msg_Y",
      requestId: "req_Y",
      uuid: "u3",
      input: 3,
      output: 2,
    });
    await fs.appendFile(jsonl, `${replay}\n${next}\n`, "utf8");

    const r2 = await parseClaudeIncremental({ projectFiles: [jsonl], cursors, queuePath });
    // Only msg_Y is new
    assert.equal(r2.eventsAggregated, 1);
  });
});

test("parseClaudeIncremental falls back to requestId when message.id is missing", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    const base = {
      parentUuid: null,
      timestamp: "2026-04-14T14:00:00Z",
      type: "assistant",
      requestId: "req_FALLBACK",
      message: {
        role: "assistant",
        model: "claude-sonnet-4.5",
        // no id
        usage: {
          input_tokens: 7,
          output_tokens: 3,
        },
      },
    };
    const line1 = JSON.stringify({ ...base, uuid: "u1" });
    const line2 = JSON.stringify({ ...base, uuid: "u2" }); // same requestId, dup
    await fs.writeFile(jsonl, `${line1}\n${line2}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const r = await parseClaudeIncremental({ projectFiles: [jsonl], cursors, queuePath });
    assert.equal(r.eventsAggregated, 1);
  });
});

test("parseClaudeIncremental caps cursor seenIds to ~500 entries", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    const lines = [];
    for (let i = 0; i < 650; i++) {
      lines.push(
        assistantLine({
          ts: `2026-04-14T14:00:${String(i % 60).padStart(2, "0")}Z`,
          messageId: `msg_${i}`,
          requestId: `req_${i}`,
          uuid: `u${i}`,
          input: 1,
          output: 1,
        }),
      );
    }
    await fs.writeFile(jsonl, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const r = await parseClaudeIncremental({ projectFiles: [jsonl], cursors, queuePath });
    assert.equal(r.eventsAggregated, 650);

    const saved = cursors.files[jsonl];
    assert.ok(saved.seenIds.length <= 500, `expected <= 500 ids, got ${saved.seenIds.length}`);
    // FIFO semantics: last 500 ids preserved (msg_150..msg_649).
    assert.equal(saved.seenIds[saved.seenIds.length - 1], "msg_649");
    assert.equal(saved.seenIds[0], "msg_150");
  });
});

test("parseClaudeIncremental still counts lines that have no dedupe key", async () => {
  await withTempDir(async (dir) => {
    const jsonl = path.join(dir, "session.jsonl");
    // No message.id, no requestId — legacy or partial event shape.
    const base = {
      parentUuid: null,
      timestamp: "2026-04-14T14:00:00Z",
      type: "assistant",
      message: {
        role: "assistant",
        model: "claude-sonnet-4.5",
        usage: { input_tokens: 4, output_tokens: 1 },
      },
    };
    const line1 = JSON.stringify({ ...base, uuid: "u1" });
    const line2 = JSON.stringify({ ...base, uuid: "u2" });
    await fs.writeFile(jsonl, `${line1}\n${line2}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const r = await parseClaudeIncremental({ projectFiles: [jsonl], cursors, queuePath });
    // Without a dedupe key, both lines are counted (preserves prior behavior
    // for unknown/partial event shapes — we only skip when we are confident of a duplicate).
    assert.equal(r.eventsAggregated, 2);
  });
});
