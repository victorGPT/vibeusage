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

test("opencode strategy also reads opencode.db v1 rows (id only in table column)", async () => {
  await withTempDir(async (dir) => {
    const opencodeHome = path.join(dir, "opencode");
    await fs.mkdir(opencodeHome, { recursive: true });
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = y.getTime() + 10 * 3600 * 1000;
    const data = (msg) => {
      const { id: _id, ...rest } = msg;
      return JSON.stringify(rest).replace(/'/g, "''");
    };
    // msg_v1: 1+2+3+4+5 = 15 ; user row skipped
    const a = data(assistantMsg({ id: "msg_v1", ts, input: 1, output: 2, reasoning: 3, cacheRead: 4, cacheWrite: 5 }));
    const u = data({ role: "user", id: "msg_u", time: { completed: ts } });
    const sql = `CREATE TABLE message (id text PRIMARY KEY, session_id text, data text);
      INSERT INTO message VALUES ('msg_v1', 'ses_v1', '${a}'), ('msg_u', 'ses_v1', '${u}');`;
    require("node:child_process").execFileSync("sqlite3", [path.join(opencodeHome, "opencode.db"), sql]);

    const result = runSourceAudit({
      strategy: getStrategy("opencode"),
      days: 3,
      threshold: 5,
      dbJson: JSON.stringify([{ day: yIso, tokens: 15 }]),
      home: dir,
      env: { OPENCODE_HOME: opencodeHome },
    });
    assert.equal(result.ok, true);
    assert.equal(result.uniqueMessages, 1);
    const row = result.rows.find((r) => r.day === yIso);
    assert.equal(row.truth, 15);
  });
});

test("opencode strategy reads opencode.db v2 session_message rows", async () => {
  await withTempDir(async (dir) => {
    const opencodeHome = path.join(dir, "opencode");
    await fs.mkdir(opencodeHome, { recursive: true });
    const now = new Date();
    const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const yIso = y.toISOString().slice(0, 10);
    const ts = y.getTime() + 10 * 3600 * 1000;
    const tokens = (input, output, reasoning, read, write) => ({ input, output, reasoning, cache: { read, write } });
    // v2 data has no role; type lives in the column (anomalyco/opencode migration 20260804233008_loose_psylocke)
    const row = (id, session, type, created, data) =>
      `('${id}', '${session}', '${type}', ${created}, ${created}, '${JSON.stringify(data)}')`;
    const rows = [
      // 10 + 2 + 1 + 1000 + 5 = 1018 (big cache_read)
      row("msg_a", "ses_a", "assistant", ts, { id: "msg_a", tokens: tokens(10, 2, 1, 1000, 5), time: { created: ts, completed: ts } }),
      // compaction usage: 4 + 1 = 5
      row("msg_c", "ses_a", "compaction", ts + 1, { id: "msg_c", tokens: tokens(4, 1, 0, 0, 0), time: { created: ts + 1, completed: ts + 1 } }),
      // still streaming (no tokens) -> skipped
      row("msg_s", "ses_a", "assistant", ts + 2, { id: "msg_s", time: { created: ts + 2 } }),
      // user row -> skipped
      row("msg_u", "ses_a", "user", ts, { id: "msg_u", time: { created: ts } }),
      // fork copy of msg_a (new id, parent's time_created) -> skipped
      row("msg_f", "ses_f", "assistant", ts, { id: "msg_f", tokens: tokens(10, 2, 1, 1000, 5), time: { created: ts, completed: ts } }),
    ];
    const sql = `CREATE TABLE message (id text PRIMARY KEY, session_id text, data text);
      CREATE TABLE session_v2 (id text PRIMARY KEY, fork_session_id text, time_created integer);
      CREATE TABLE session_message (id text PRIMARY KEY, session_id text, type text, time_created integer, time_updated integer, data text);
      INSERT INTO session_v2 VALUES ('ses_a', NULL, ${ts - 1000}), ('ses_f', 'ses_a', ${ts + 60000});
      INSERT INTO session_message VALUES ${rows.join(", ")};`;
    require("node:child_process").execFileSync("sqlite3", [path.join(opencodeHome, "opencode.db"), sql]);

    const result = runSourceAudit({
      strategy: getStrategy("opencode"),
      days: 3,
      threshold: 5,
      dbJson: JSON.stringify([{ day: yIso, tokens: 1023 }]),
      home: dir,
      env: { OPENCODE_HOME: opencodeHome },
    });
    assert.equal(result.ok, true);
    assert.equal(result.uniqueMessages, 2);
    assert.equal(result.rows.find((r) => r.day === yIso).truth, 1018 + 5);
  });
});

test("opencode strategy fails the audit when opencode.db cannot be read", async () => {
  await withTempDir(async (dir) => {
    const opencodeHome = path.join(dir, "opencode");
    await fs.mkdir(opencodeHome, { recursive: true });
    await fs.writeFile(path.join(opencodeHome, "opencode.db"), "not a sqlite database", "utf8");
    const today = new Date().toISOString().slice(0, 10);
    const result = runSourceAudit({
      strategy: getStrategy("opencode"),
      days: 3,
      threshold: 5,
      dbJson: JSON.stringify([{ day: today, tokens: 100 }]),
      home: dir,
      env: { OPENCODE_HOME: opencodeHome },
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "local-read-failed");
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
