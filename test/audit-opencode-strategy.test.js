const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  runSourceAudit,
  getStrategy,
} = require("../src/lib/ops/audit-source");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-audit-opencode-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function writeMsg(storageRoot, sessionId, msgId, body) {
  const dir = path.join(storageRoot, "message", sessionId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${msgId}.json`), JSON.stringify(body), "utf8");
}

function assistantMsg({ id, ts, input = 0, output = 0, reasoning = 0, cacheRead = 0, cacheWrite = 0 }) {
  return {
    role: "assistant",
    id,
    modelID: "gpt-5",
    tokens: {
      input,
      output,
      reasoning,
      cache: { read: cacheRead, write: cacheWrite },
    },
    time: { created: ts - 1000, completed: ts },
  };
}

test("audit-source registers the opencode strategy", () => {
  const s = getStrategy("opencode");
  assert.ok(s && s.id === "opencode");
  assert.equal(typeof s.sessionRoot, "function");
  assert.equal(typeof s.walkSessions, "function");
  assert.equal(typeof s.extractUsage, "function");
  assert.equal(typeof s.iterateRecords, "function");
});

test("opencode strategy sums all channels (input + cache.write + cache.read + output + reasoning)", async () => {
  await withTempDir(async (dir) => {
    // OpenCode layout: <dir>/opencode/storage/message/ses_X/msg_*.json
    const opencodeHome = path.join(dir, "opencode");
    const storageRoot = path.join(opencodeHome, "storage");

    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = y.getTime() + 10 * 3600 * 1000; // 10:00 UTC yesterday

    // msg_A: input=100, cache.write=50, cache.read=1000, output=10, reasoning=5 -> total 1165
    await writeMsg(storageRoot, "ses_A", "msg_aaa", assistantMsg({
      id: "msg_aaa", ts, input: 100, output: 10, reasoning: 5, cacheRead: 1000, cacheWrite: 50,
    }));
    // duplicate of msg_A (same id, different file) -> skipped
    await writeMsg(storageRoot, "ses_A", "msg_aaa2", assistantMsg({
      id: "msg_aaa", ts: ts + 1000, input: 100, output: 10, reasoning: 5, cacheRead: 1000, cacheWrite: 50,
    }));
    // msg_B: another real message -> counted
    await writeMsg(storageRoot, "ses_A", "msg_bbb", assistantMsg({
      id: "msg_bbb", ts: ts + 5000, input: 1, output: 2, reasoning: 3, cacheRead: 4, cacheWrite: 5,
    }));
    // user message -> skipped by role filter
    await writeMsg(storageRoot, "ses_A", "msg_user", { role: "user", id: "msg_user", time: { completed: ts } });

    const dbJson = JSON.stringify([{ day: yIso, tokens: 1165 + (1 + 2 + 3 + 4 + 5) }]);

    const strategy = getStrategy("opencode");
    const result = runSourceAudit({
      strategy,
      days: 3,
      threshold: 5,
      dbJson,
      // force the strategy to look inside our temp dir
      home: dir,
      env: { OPENCODE_HOME: opencodeHome },
    });

    assert.equal(result.ok, true);
    assert.equal(result.source, "opencode");
    assert.equal(result.uniqueMessages, 2, "two unique ids (msg_aaa + msg_bbb)");
    assert.equal(result.duplicatesSkipped, 1);
    const row = result.rows.find((r) => r.day === yIso);
    assert.ok(row, "day row present");
    assert.equal(row.truth, 1165 + 15);
    assert.equal(row.db, 1165 + 15);
    assert.equal(result.exceedsThreshold, false);
  });
});

test("opencode strategy reports no-local-sessions when storage dir is empty", async () => {
  await withTempDir(async (dir) => {
    const result = runSourceAudit({
      strategy: getStrategy("opencode"),
      days: 3,
      threshold: 10,
      dbJson: "[]",
      home: dir,
      env: { OPENCODE_HOME: path.join(dir, "nothing-here") },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no-local-sessions");
    assert.equal(result.source, "opencode");
  });
});
