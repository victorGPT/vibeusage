const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const cp = require("node:child_process");
const { test } = require("node:test");

const { promisify } = require("node:util");
const { parseOpencodeIncremental } = require("../src/lib/rollout");
const { readOpencodeSqliteRows } = require("../src/lib/opencode-sqlite");

const execFileAsync = promisify(cp.execFile);

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

test("opencode v2 rows migrated after a sync, with older timestamps, are still counted once", async () => {
  // upstream migrates v1 sessions one by one in the background and keeps their original timestamps
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    sqlite(
      dbPath,
      [
        V2_SCHEMA,
        "INSERT INTO session_v2 VALUES ('ses_new', 'prj', NULL, " + t0 + ");",
        "INSERT INTO session_v2 VALUES ('ses_old', 'prj', NULL, " + (t0 - 60000) + ");",
        v2Row({ id: "msg_new", session: "ses_new", seq: 1, created: t0, updated: t0, data: assistant({ id: "msg_new", created: t0, completed: t0, tokens: tok(2, 1, 0, 0, 0) }) }),
      ].join("\n"),
    );
    const cursors = { version: 1, files: {}, updatedAt: null };
    const first = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(first.eventsAggregated, 1);

    const old = [];
    for (let i = 0; i < 100; i += 1) {
      const at = t0 - 60000 + i;
      old.push(v2Row({ id: "msg_old" + i, session: "ses_old", seq: i + 1, created: at, updated: at, data: assistant({ id: "msg_old" + i, created: at, completed: at, tokens: tok(1, 0, 0, 0, 0) }) }));
    }
    sqlite(dbPath, old.join("\n"));

    const second = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath });
    assert.equal(second.eventsAggregated, 100);
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

test("opencode sqlite rows: 130k rows in one read do not overflow the stack", async () => {
  await withTmp(async (tmp) => {
    const t0 = T("2026-11-20T10:01:00.000Z");
    const data = JSON.stringify({ tokens: tok(1, 0, 0, 0, 0), time: { created: t0 } });
    const rows = Array.from({ length: 130000 }, (_, i) => ({ id: "m" + i, session_id: "s", role: "assistant", time_created: t0 + i, data }));
    const cursors = { version: 1, files: {}, updatedAt: null };
    const res = await parseOpencodeIncremental({
      opencodeDbPath: path.join(tmp, "opencode.db"),
      cursors,
      queuePath: path.join(tmp, "queue.jsonl"),
      readSqliteRows: async () => ({ status: "ok", checkedAt: "2026-11-20T00:00:00.000Z", inode: 1, rows }),
    });
    assert.equal(res.eventsAggregated, 130000);
    assert.equal(cursors.opencodeSqlite.lastTimeCreated, t0 + 129999);
  });
});

test("opencode v2 reads in pages and later syncs only read new or updated rows", async () => {
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    const rowsFor = (from, to, at) => {
      const out = [];
      for (let i = from; i < to; i += 1) {
        out.push(v2Row({ id: "msg_" + i, session: "ses_a", seq: i + 1, created: at + i, updated: at + i, data: assistant({ id: "msg_" + i, created: at + i, completed: at + i, tokens: tok(1, 0, 0, 0, 0) }) }));
      }
      return out.join("\n");
    };
    sqlite(dbPath, [V2_SCHEMA, "INSERT INTO session_v2 VALUES ('ses_a', 'prj', NULL, " + t0 + ");", rowsFor(0, 5, t0)].join("\n"));
    const cursors = { version: 1, files: {}, updatedAt: null };
    let queries = 0;
    let returned = 0;
    const readSqliteRows = async (args) => {
      const res = await readOpencodeSqliteRows({
        ...args,
        pageSize: 2,
        execFileFn: async (...a) => {
          queries += 1;
          return execFileAsync(...a);
        },
      });
      returned = res.rows.length;
      return res;
    };

    const first = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    assert.equal(first.eventsAggregated, 5);
    assert.equal(queries, 5); // probe + time bound + pages of 2, 2, 1

    // 3 rows migrated later with old timestamps, plus nothing else changed
    sqlite(dbPath, rowsFor(5, 8, t0 - 60000));
    const second = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    assert.equal(second.eventsAggregated, 3);
    // 3 new rowids + the 1 row at the time_updated cursor (>=); not the whole table
    assert.equal(returned, 4);

    const third = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    assert.equal(third.eventsAggregated, 0);
  });
});

test("opencode v2 row finishing while pages are read is not lost behind the cursors", async () => {
  await withTmp(async (tmp) => {
    const dbPath = path.join(tmp, "opencode.db");
    const queuePath = path.join(tmp, "queue.jsonl");
    const t0 = T("2026-11-20T10:01:00.000Z");
    sqlite(
      dbPath,
      [
        V2_SCHEMA,
        "INSERT INTO session_v2 VALUES ('ses_a', 'prj', NULL, " + t0 + ");",
        // a is still streaming (no tokens) when the first page is read
        v2Row({ id: "msg_a", session: "ses_a", seq: 1, created: t0, updated: t0, data: assistant({ id: "msg_a", created: t0 }) }),
        v2Row({ id: "msg_b", session: "ses_a", seq: 2, created: t0 + 100, updated: t0 + 100, data: assistant({ id: "msg_b", created: t0 + 100, completed: t0 + 100, tokens: tok(1, 0, 0, 0, 0) }) }),
        v2Row({ id: "msg_c", session: "ses_a", seq: 3, created: t0 + 100, updated: t0 + 100, data: assistant({ id: "msg_c", created: t0 + 100, completed: t0 + 100, tokens: tok(1, 0, 0, 0, 0) }) }),
      ].join("\n"),
    );
    const cursors = { version: 1, files: {}, updatedAt: null };
    let pages = 0;
    let mutated = false;
    const readSqliteRows = (args) =>
      readOpencodeSqliteRows({
        ...args,
        pageSize: 1,
        execFileFn: async (...a) => {
          const res = await execFileAsync(...a);
          if (/LIMIT/.test(a[1][2]) && (pages += 1) === 1 && !mutated) {
            mutated = true;
            // between page 1 and page 2: a finishes, c is touched again
            const done = assistant({ id: "msg_a", created: t0, completed: t0 + 200, tokens: tok(5, 0, 0, 0, 0) });
            sqlite(dbPath, `UPDATE session_message SET data = ${sql(JSON.stringify(done))}, time_updated = ${t0 + 200} WHERE id = 'msg_a';
UPDATE session_message SET time_updated = ${t0 + 300} WHERE id = 'msg_c';`);
          }
          return res;
        },
      });

    const first = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    const second = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    const third = await parseOpencodeIncremental({ opencodeDbPath: dbPath, cursors, queuePath, readSqliteRows });
    assert.equal(first.eventsAggregated + second.eventsAggregated, 3);
    assert.equal(third.eventsAggregated, 0);
    const queued = await readQueue(queuePath);
    assert.equal(queued.at(-1).total_tokens, 7); // b 1 + c 1 + a 5
  });
});
