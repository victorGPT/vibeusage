const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { parseGeminiIncremental, listGeminiSessionFiles, readGeminiMessages } = require("../src/lib/rollout");

// Gemini CLI records each API response's usageMetadata per message (not a
// running total): input includes cached; total = input + output + thoughts + tool.

const TS = "2026-11-20T08:05:00.000Z";

async function withTmp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-gemini-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function gem(id, tokens, extra = {}) {
  return { id, timestamp: TS, type: "gemini", model: "gemini-3-pro", content: "synthetic", tokens, ...extra };
}

function tok(input, cached, output, thoughts, tool) {
  return { input, cached, output, thoughts, tool, total: input + output + thoughts + tool };
}

function jsonl(records) {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

const HEADER = { sessionId: "s1", projectHash: "p1", startTime: TS, lastUpdated: TS, kind: "main" };

async function readQueue(queuePath) {
  const raw = await fs.readFile(queuePath, "utf8").catch(() => "");
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// The queue appends the full bucket totals on each touch; the last row is current.
async function lastRow(queuePath) {
  const rows = await readQueue(queuePath);
  return rows[rows.length - 1];
}

async function run(files, cursors, queuePath) {
  return parseGeminiIncremental({ sessionFiles: files, cursors, queuePath });
}

test("gemini .json: each message's tokens are per-call usage, split into disjoint channels", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-a.json");
    const queuePath = path.join(dir, "queue.jsonl");
    await fs.writeFile(
      file,
      JSON.stringify({
        ...HEADER,
        messages: [
          { id: "u1", timestamp: TS, type: "user", content: "synthetic" },
          gem("g1", tok(10, 4, 3, 2, 1)), // total 16
          // big cache_read, small input/output: total must keep the cache
          gem("g2", tok(1000, 990, 2, 0, 0)), // total 1002
        ],
      }),
    );
    const res = await run([file], { files: {} }, queuePath);
    assert.equal(res.eventsAggregated, 2);
    const row = await lastRow(queuePath);
    assert.equal(row.input_tokens, 6 + 10);
    assert.equal(row.cached_input_tokens, 4 + 990);
    assert.equal(row.output_tokens, 4 + 2);
    assert.equal(row.reasoning_output_tokens, 2);
    assert.equal(row.total_tokens, 16 + 1002);
  });
});

test("gemini .jsonl: same-id rewrite counts once, $rewindTo voids, $patch ignored", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-b.jsonl");
    const queuePath = path.join(dir, "queue.jsonl");
    await fs.writeFile(
      file,
      jsonl([
        HEADER,
        { id: "u1", timestamp: TS, type: "user", content: "synthetic" },
        { id: "g1", timestamp: TS, type: "gemini", content: "" }, // tokens arrive later
        gem("g1", tok(10, 0, 5, 0, 0)), // total 15
        gem("g1", tok(10, 0, 5, 0, 0)), // rewrite, same id
        { $patch: { id: "g1", content: "edited" } },
        { id: "u2", timestamp: TS, type: "user", content: "synthetic" },
        gem("g2", tok(90, 0, 10, 0, 0)), // total 100, voided below
        { $rewindTo: "u2" },
        gem("g3", tok(20, 0, 2, 0, 0)), // total 22
      ]),
    );
    const res = await run([file], { files: {} }, queuePath);
    assert.equal(res.eventsAggregated, 2);
    const row = await lastRow(queuePath);
    assert.equal(row.input_tokens, 30);
    assert.equal(row.output_tokens, 7);
    assert.equal(row.total_tokens, 37);
  });
});

test("gemini .jsonl: $set.messages replaces the message list", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-c.jsonl");
    const queuePath = path.join(dir, "queue.jsonl");
    await fs.writeFile(
      file,
      jsonl([HEADER, gem("g1", tok(10, 0, 5, 0, 0)), { $set: { messages: [gem("g9", tok(5, 0, 2, 0, 0))] } }]),
    );
    await run([file], { files: {} }, queuePath);
    assert.equal((await lastRow(queuePath)).total_tokens, 7);
  });
});

test("gemini cursor resume: second sync only counts appended messages", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-d.jsonl");
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { files: {} };
    await fs.writeFile(file, jsonl([HEADER, gem("g1", tok(10, 0, 5, 0, 0))]));
    assert.equal((await run([file], cursors, queuePath)).eventsAggregated, 1);
    await fs.appendFile(file, jsonl([gem("g2", tok(20, 0, 2, 0, 0))]));
    assert.equal((await run([file], cursors, queuePath)).eventsAggregated, 1);
    assert.equal((await lastRow(queuePath)).total_tokens, 15 + 22);
    assert.equal((await run([file], cursors, queuePath)).eventsAggregated, 0);
  });
});

test("gemini legacy index cursor: messages up to lastIndex are not re-counted", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-e.json");
    const queuePath = path.join(dir, "queue.jsonl");
    await fs.writeFile(
      file,
      JSON.stringify({ ...HEADER, messages: [gem("g1", tok(10, 0, 5, 0, 0)), gem("g2", tok(20, 0, 2, 0, 0))] }),
    );
    const { ino } = await fs.stat(file);
    const cursors = { files: { [file]: { inode: ino, lastIndex: 0, lastTotals: { total_tokens: 15 } } } };
    const res = await run([file], cursors, queuePath);
    assert.equal(res.eventsAggregated, 1);
    assert.equal((await lastRow(queuePath)).total_tokens, 22);
  });
});

test("gemini: a rewind after 500+ synced calls never re-counts old calls", async () => {
  await withTmp(async (dir) => {
    const file = path.join(dir, "session-f.jsonl");
    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { files: {} };
    const records = [HEADER, ...Array.from({ length: 501 }, (_, i) => gem(`g${i}`, tok(1, 0, 0, 0, 0)))];
    await fs.writeFile(file, jsonl(records));
    assert.equal((await run([file], cursors, queuePath)).eventsAggregated, 501);
    await fs.appendFile(file, jsonl([{ $rewindTo: "g1" }, gem("new", tok(1, 0, 0, 0, 0))]));
    assert.equal((await run([file], cursors, queuePath)).eventsAggregated, 1);
  });
});

test("gemini: the same session copied into two project dirs is counted once", async () => {
  await withTmp(async (dir) => {
    const queuePath = path.join(dir, "queue.jsonl");
    const body = JSON.stringify({ ...HEADER, messages: [gem("g1", tok(10, 0, 5, 0, 0))] });
    const a = path.join(dir, "hash-a", "session-x.json");
    const b = path.join(dir, "named-b", "session-x.json");
    for (const f of [a, b]) {
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, body);
    }
    const res = await run([a, b], { files: {} }, queuePath);
    assert.equal(res.eventsAggregated, 1);
    assert.equal((await lastRow(queuePath)).total_tokens, 15);
  });
});

test("readGeminiMessages: $patch.orderIds reorders before a later $rewindTo", () => {
  const records = ["a", "b", "c"].map((id) => gem(id, tok(1, 0, 0, 0, 0)));
  records.push({ $patch: { orderIds: ["c", "a", "b"] } }, { $rewindTo: "b" });
  const { messages } = readGeminiMessages(jsonl(records), "s.jsonl");
  assert.deepEqual(messages.map((m) => m.id), ["c", "a"]);
});

test("listGeminiSessionFiles finds both .json and .jsonl sessions", async () => {
  await withTmp(async (dir) => {
    const chats = path.join(dir, "proj", "chats");
    await fs.mkdir(chats, { recursive: true });
    for (const n of ["session-1.json", "session-2.jsonl", "notes.json"]) {
      await fs.writeFile(path.join(chats, n), "");
    }
    const files = (await listGeminiSessionFiles(dir)).map((f) => path.basename(f));
    assert.deepEqual(files, ["session-1.json", "session-2.jsonl"]);
  });
});
