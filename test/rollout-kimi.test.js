const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { listKimiSessionFiles, parseKimiIncremental } = require("../src/lib/rollout");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-kimi-rollout-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function statusUpdateLine({ ts, tokenUsage, messageId = "chatcmpl-test" }) {
  return JSON.stringify({
    timestamp: ts,
    message: {
      type: "StatusUpdate",
      payload: {
        context_usage: 0.1,
        token_usage: tokenUsage,
        message_id: messageId,
      },
    },
  });
}

async function readJsonLines(filePath) {
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!text.trim()) return [];
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("listKimiSessionFiles walks <projectHash>/<sessionId>/wire.jsonl entries", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const projectDir = path.join(sessionsDir, "projecthash");
    const sessionA = path.join(projectDir, "aaaa");
    const sessionB = path.join(projectDir, "bbbb");
    await fs.mkdir(sessionA, { recursive: true });
    await fs.mkdir(sessionB, { recursive: true });
    await fs.writeFile(path.join(sessionA, "wire.jsonl"), "");
    await fs.writeFile(path.join(sessionB, "wire.jsonl"), "");
    await fs.writeFile(path.join(sessionA, "context.jsonl"), "");

    const files = await listKimiSessionFiles(sessionsDir);
    assert.equal(files.length, 2);
    assert.ok(files.every((p) => p.endsWith("/wire.jsonl")));
    assert.ok(files.includes(path.join(sessionA, "wire.jsonl")));
  });
});

test("listKimiSessionFiles returns empty array when sessions dir is missing", async () => {
  await withTempDir(async (dir) => {
    const files = await listKimiSessionFiles(path.join(dir, "missing"));
    assert.deepEqual(files, []);
  });
});

test("parseKimiIncremental aggregates StatusUpdate token_usage into hourly buckets", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const sessionDir = path.join(sessionsDir, "proj", "sess");
    await fs.mkdir(sessionDir, { recursive: true });
    const wirePath = path.join(sessionDir, "wire.jsonl");
    // 2026-04-01T00:10:00Z
    const ts = 1775001000;
    const lines = [
      statusUpdateLine({
        ts,
        tokenUsage: {
          input_other: 100,
          input_cache_read: 50,
          input_cache_creation: 10,
          output: 20,
        },
      }),
      statusUpdateLine({
        ts: ts + 60,
        tokenUsage: {
          input_other: 5,
          input_cache_read: 0,
          input_cache_creation: 0,
          output: 7,
        },
        messageId: "chatcmpl-2",
      }),
      // Non-StatusUpdate line must be ignored
      JSON.stringify({ timestamp: ts + 1, message: { type: "TurnBegin", payload: {} } }),
    ];
    await fs.writeFile(wirePath, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parseKimiIncremental({
      sessionFiles: [wirePath],
      cursors,
      queuePath,
    });
    assert.equal(result.filesProcessed, 1);
    assert.equal(result.eventsAggregated, 2);
    assert.equal(result.bucketsQueued, 1);

    const queued = await readJsonLines(queuePath);
    assert.equal(queued.length, 1);
    const bucket = queued[0];
    assert.equal(bucket.source, "kimi");
    assert.equal(bucket.model, "unknown");
    // input_tokens = input_other + input_cache_creation
    assert.equal(bucket.input_tokens, 100 + 10 + 5 + 0);
    assert.equal(bucket.cached_input_tokens, 50);
    assert.equal(bucket.output_tokens, 20 + 7);
    assert.equal(bucket.reasoning_output_tokens, 0);
    // total_tokens = input_tokens + cached + output (= 115 + 50 + 27)
    assert.equal(bucket.total_tokens, 115 + 50 + 27);
  });
});

test("parseKimiIncremental resumes from cursor without double counting", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const sessionDir = path.join(sessionsDir, "proj", "sess");
    await fs.mkdir(sessionDir, { recursive: true });
    const wirePath = path.join(sessionDir, "wire.jsonl");
    const firstLine = statusUpdateLine({
      ts: 1775001000,
      tokenUsage: { input_other: 10, input_cache_read: 0, input_cache_creation: 0, output: 4 },
    });
    await fs.writeFile(wirePath, `${firstLine}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    await parseKimiIncremental({ sessionFiles: [wirePath], cursors, queuePath });

    const secondLine = statusUpdateLine({
      ts: 1775002000,
      tokenUsage: { input_other: 2, input_cache_read: 1, input_cache_creation: 0, output: 3 },
      messageId: "chatcmpl-2",
    });
    await fs.appendFile(wirePath, `${secondLine}\n`, "utf8");

    const result = await parseKimiIncremental({ sessionFiles: [wirePath], cursors, queuePath });
    assert.equal(result.eventsAggregated, 1);

    const queued = await readJsonLines(queuePath);
    // Two queued aggregation events (first run + incremental run) — both for same bucket
    assert.ok(queued.length >= 2);
    const totalInput = queued.reduce((sum, ev) => sum + Number(ev.input_tokens || 0), 0);
    assert.equal(totalInput, 10 + 2);
  });
});

test("parseKimiIncremental ignores lines without token_usage", async () => {
  await withTempDir(async (dir) => {
    const sessionsDir = path.join(dir, "sessions");
    const sessionDir = path.join(sessionsDir, "proj", "sess");
    await fs.mkdir(sessionDir, { recursive: true });
    const wirePath = path.join(sessionDir, "wire.jsonl");
    const lines = [
      JSON.stringify({ timestamp: 1775001000, message: { type: "TurnBegin", payload: {} } }),
      JSON.stringify({ timestamp: 1775001001, message: { type: "StatusUpdate", payload: {} } }),
      "not-json",
      statusUpdateLine({
        ts: 1775001002,
        tokenUsage: { input_other: 0, input_cache_read: 0, input_cache_creation: 0, output: 0 },
      }),
    ];
    await fs.writeFile(wirePath, `${lines.join("\n")}\n`, "utf8");

    const queuePath = path.join(dir, "queue.jsonl");
    const cursors = { version: 1, files: {}, updatedAt: null };
    const result = await parseKimiIncremental({ sessionFiles: [wirePath], cursors, queuePath });
    assert.equal(result.eventsAggregated, 0);
    assert.equal(result.bucketsQueued, 0);
  });
});
