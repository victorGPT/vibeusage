const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const cp = require("node:child_process");
const { test } = require("node:test");

const { parseOpencodeIncremental } = require("../src/lib/rollout");

// Synthetic opencode.db fixtures. v2 schema follows anomalyco/opencode
// packages/core/src/database/migration/20260804233008_loose_psylocke.ts (trimmed to the columns we read).
const V1_SCHEMA = [
  "CREATE TABLE project (id text PRIMARY KEY, worktree text);",
  "CREATE TABLE session (id text PRIMARY KEY, project_id text);",
  "CREATE TABLE message (id text PRIMARY KEY, session_id text, time_created integer, time_updated integer, data text);",
  // pre-split v1 dbs already carry a session_message table; it must not trigger the v2 query
  "CREATE TABLE session_message (id text PRIMARY KEY, session_id text, type text, time_created integer, time_updated integer, data text, seq integer);",
].join("\n");
const V2_SCHEMA = [
  V1_SCHEMA,
  "CREATE TABLE session_v2 (id text PRIMARY KEY, project_id text, fork_session_id text, time_created integer);",
].join("\n");

const T = (iso) => Date.parse(iso);
const sql = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

function sqlite(dbPath, script) {
  cp.execFileSync("sqlite3", [dbPath], { input: script });
}

function v2Row({ id, session, type = "assistant", seq, created, updated, data }) {
  return `INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data) VALUES (${[
    id, session, type, seq, created, updated, JSON.stringify(data),
  ].map(sql).join(", ")});`;
}

function assistant({ id, created, completed, tokens }) {
  return {
    id,
    type: "assistant",
    agent: "build",
    model: { id: "gpt-5", providerID: "openai" },
    content: [],
    ...(tokens ? { tokens } : {}),
    time: { created, ...(completed ? { completed } : {}) },
  };
}

const tok = (input, output, reasoning, read, write) => ({ input, output, reasoning, cache: { read, write } });

async function withTmp(fn) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-opencode-v2-"));
  try {
    return await fn(tmp);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function readQueue(queuePath) {
  const text = await fs.readFile(queuePath, "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

test("opencode v2 session_message rows are counted with all token channels", async () => {
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    sqlite(
      dbPath,
      [
        V2_SCHEMA,
        "INSERT INTO session_v2 VALUES ('ses_a', 'prj', NULL, " + t0 + ");",
        "INSERT INTO session_v2 VALUES ('ses_b', 'prj', NULL, " + t0 + ");",
        "INSERT INTO session_v2 VALUES ('ses_fork', 'prj', 'ses_a', " + (t0 + 600000) + ");",
        v2Row({ id: "msg_u1", session: "ses_a", type: "user", seq: 1, created: t0, updated: t0, data: { id: "msg_u1", type: "user", text: "synthetic", time: { created: t0 } } }),
        // big cache_read, small input/output: 10 + 5 + 1000 + 2 + 1 = 1018
        v2Row({ id: "msg_a1", session: "ses_a", seq: 2, created: t0 + 1000, updated: t0 + 2000, data: assistant({ id: "msg_a1", created: t0 + 1000, completed: t0 + 2000, tokens: tok(10, 2, 1, 1000, 5) }) }),
        // compaction request usage: 4 + 1 = 5
        v2Row({ id: "msg_c1", session: "ses_a", type: "compaction", seq: 3, created: t0 + 3000, updated: t0 + 4000, data: { id: "msg_c1", type: "compaction", status: "completed", reason: "auto", summary: "synthetic", model: { id: "gpt-5", providerID: "openai" }, tokens: tok(4, 1, 0, 0, 0), time: { created: t0 + 3000 } } }),
        // another session, started earlier and still streaming: no tokens yet
        v2Row({ id: "msg_a2", session: "ses_b", seq: 1, created: t0 + 500, updated: t0 + 500, data: assistant({ id: "msg_a2", created: t0 + 500 }) }),
        // fork copy of msg_a1 keeps the parent's timestamps; it must not be counted again
        v2Row({ id: "msg_evt_2", session: "ses_fork", seq: 2, created: t0 + 1000, updated: t0 + 2000, data: assistant({ id: "msg_evt_2", created: t0 + 1000, completed: t0 + 2000, tokens: tok(10, 2, 1, 1000, 5) }) }),
      ].join("\n"),
    );
    const cursors = { version: 1, files: {}, updatedAt: null };

    const first = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(first.sqliteStatus, "ok");
    assert.equal(first.eventsAggregated, 2);
    let queued = await readQueue(queuePath);
    assert.equal(queued.length, 1);
    assert.equal(queued[0].source, "opencode");
    assert.equal(queued[0].model, "gpt-5");
    assert.equal(queued[0].input_tokens, 19); // 10 + 5 + 4
    assert.equal(queued[0].cached_input_tokens, 1000);
    assert.equal(queued[0].output_tokens, 3);
    assert.equal(queued[0].reasoning_output_tokens, 1);
    assert.equal(queued[0].total_tokens, 1023); // 1018 + 5

    // msg_a2 finishes: tokens land and time_updated moves forward; its time_created is older than the cursor
    const done = assistant({ id: "msg_a2", created: t0 + 500, completed: t0 + 9000, tokens: tok(7, 3, 0, 0, 0) });
    sqlite(dbPath, `UPDATE session_message SET data = ${sql(JSON.stringify(done))}, time_updated = ${t0 + 9000} WHERE id = 'msg_a2';`);

    const second = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(second.eventsAggregated, 1);
    queued = await readQueue(queuePath);
    assert.equal(queued.at(-1).total_tokens, 1033); // 1023 + 7 + 3

    const third = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(third.eventsAggregated, 0);
  });
});

test("opencode v2 rows already counted from v1 (same session|id) are not counted again", async () => {
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    sqlite(
      dbPath,
      [
        V2_SCHEMA,
        "INSERT INTO session_v2 VALUES ('ses_a', 'prj', NULL, " + t0 + ");",
        v2Row({ id: "msg_a1", session: "ses_a", seq: 1, created: t0, updated: t0, data: assistant({ id: "msg_a1", created: t0, completed: t0, tokens: tok(10, 2, 0, 0, 0) }) }),
      ].join("\n"),
    );
    const cursors = { version: 1, files: {}, updatedAt: null, opencode: { messages: { "ses_a|msg_a1": { lastTotals: null } } } };

    const res = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(res.eventsAggregated, 0);
    assert.equal((await readQueue(queuePath)).length, 0);
  });
});

test("opencode v1 db (message table) is still read when session_v2 is absent", async () => {
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    const data = { role: "assistant", modelID: "gpt-5", tokens: tok(4, 1, 0, 0, 0), time: { created: t0, completed: t0 } };
    sqlite(
      dbPath,
      [
        V1_SCHEMA,
        "INSERT INTO session VALUES ('ses_v1', 'prj');",
        `INSERT INTO message VALUES ('msg_v1', 'ses_v1', ${t0}, ${t0}, ${sql(JSON.stringify(data))});`,
      ].join("\n"),
    );
    const cursors = { version: 1, files: {}, updatedAt: null };

    const res = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(res.sqliteStatus, "ok");
    assert.equal(res.eventsAggregated, 1);
    const queued = await readQueue(queuePath);
    assert.equal(queued[0].total_tokens, 5);
  });
});
