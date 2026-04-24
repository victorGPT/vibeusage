const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { runSourceAudit, getStrategy } = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-gemini-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeGeminiSession(geminiHome, hash, name, messages) {
  const dir = path.join(geminiHome, "tmp", hash, "chats");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), JSON.stringify({ messages }), "utf8");
}

test("audit-source registers the gemini strategy", () => {
  const s = getStrategy("gemini");
  assert.ok(s && s.id === "gemini");
  assert.equal(typeof s.sessionRoot, "function");
  assert.equal(typeof s.walkSessions, "function");
  assert.equal(typeof s.iterateRecords, "function");
});

test("gemini strategy emits per-message deltas against cumulative tokens", async () => {
  await withTempDir(async (dir) => {
    const geminiHome = path.join(dir, ".gemini");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = (addSec) => new Date(y.getTime() + 10 * 3600 * 1000 + addSec * 1000).toISOString();

    // Cumulative tokens:
    //   msg_0 total=100
    //   msg_1 total=260  -> delta 160
    //   msg_2 total=260  -> delta 0, skipped
    //   msg_3 total=320  -> delta 60
    // Truth = 100 + 160 + 60 = 320
    const messages = [
      { role: "user", timestamp: ts(0), tokens: null }, // null tokens skipped
      {
        role: null,
        timestamp: ts(10),
        model: "gemini-3-flash-preview",
        tokens: { input: 80, output: 15, cached: 0, thoughts: 5, tool: 0, total: 100 },
      },
      {
        role: null,
        timestamp: ts(30),
        model: "gemini-3-flash-preview",
        tokens: { input: 210, output: 40, cached: 0, thoughts: 10, tool: 0, total: 260 },
      },
      {
        role: null,
        timestamp: ts(35),
        model: "gemini-3-flash-preview",
        tokens: { input: 210, output: 40, cached: 0, thoughts: 10, tool: 0, total: 260 },
      },
      {
        role: null,
        timestamp: ts(50),
        model: "gemini-3-flash-preview",
        tokens: { input: 260, output: 50, cached: 0, thoughts: 10, tool: 0, total: 320 },
      },
    ];

    await writeGeminiSession(geminiHome, "abc123", "session-2026-04-23T10-00-test.json", messages);

    const dbJson = JSON.stringify([{ day: yIso, tokens: 320 }]);

    const strategy = getStrategy("gemini");
    const result = runSourceAudit({
      strategy,
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: { GEMINI_HOME: geminiHome },
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "gemini");
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 320, `expected 320, got ${row.truth}`);
    assert.equal(row.db, 320);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("gemini strategy treats a total drop as a session reset, not as negative tokens", async () => {
  await withTempDir(async (dir) => {
    const geminiHome = path.join(dir, ".gemini");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = (addSec) => new Date(y.getTime() + 10 * 3600 * 1000 + addSec * 1000).toISOString();

    // Cumulative: 500, then drops to 200 (session resumed) -> delta = 200
    const messages = [
      {
        timestamp: ts(0),
        tokens: { input: 400, output: 90, cached: 0, thoughts: 10, tool: 0, total: 500 },
      },
      {
        timestamp: ts(30),
        tokens: { input: 150, output: 40, cached: 0, thoughts: 10, tool: 0, total: 200 },
      },
    ];
    await writeGeminiSession(geminiHome, "hash2", "session-2026-04-23T11-00-reset.json", messages);

    const dbJson = JSON.stringify([{ day: yIso, tokens: 500 + 200 }]);

    const result = runSourceAudit({
      strategy: getStrategy("gemini"),
      days: 3,
      threshold: 5,
      dbJson,
      home: dir,
      env: { GEMINI_HOME: geminiHome },
    });

    assert.equal(result.ok, true);
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row);
    assert.equal(row.truth, 700);
  });
});

test("gemini strategy reports no-local-sessions when tmp dir is missing", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("gemini"),
      days: 3,
      threshold: 10,
      dbJson: "[]",
      home: dir,
      env: { GEMINI_HOME: path.join(dir, "no-such") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
    assert.equal(result.source, "gemini");
  });
});
