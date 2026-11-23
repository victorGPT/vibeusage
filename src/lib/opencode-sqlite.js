const fs = require("node:fs/promises");
const cp = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(cp.execFile);

function buildMessageQuery(lastTimeCreated) {
  const since = Number.isFinite(lastTimeCreated) ? Math.max(0, Math.trunc(lastTimeCreated)) : 0;
  return [
    "SELECT json_object(",
    "'id', m.id,",
    "'session_id', m.session_id,",
    "'time_created', m.time_created,",
    "'role', json_extract(m.data, '$.role'),",
    "'project_worktree', p.worktree,",
    "'data', m.data",
    ")",
    "FROM message m",
    "LEFT JOIN session s ON s.id = m.session_id",
    "LEFT JOIN project p ON p.id = s.project_id",
    `WHERE m.time_created >= ${since}`,
    "ORDER BY m.time_created ASC;",
  ].join(" ");
}

// opencode v2 (anomalyco/opencode migration 20260804233008_loose_psylocke) moved messages to
// session_message(id, session_id, type, seq, time_created, time_updated, data) under session_v2.
// Detect it by session_v2: pre-split v1 dbs already have a session_message table.
const V2_PROBE_QUERY = "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'session_v2';";

// Cursor on rowid OR time_updated. Upstream's background v1 migration inserts rows with their
// original (old) timestamps but new rowids, so rowid catches them; tokens land at step end and
// bump time_updated, so time_updated catches rows that were still streaming (no tokens yet).
// session|id seen-keys keep it exact. Read in rowid pages so one sqlite3 call stays small.
// data is trimmed to the fields the parser reads.
const V2_PAGE_SIZE = 20000;

function buildMessageQueryV2({ afterRowid = 0, lastRowid = 0, lastTimeUpdated = 0, limit = V2_PAGE_SIZE } = {}) {
  const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
  return [
    "SELECT json_object(",
    "'rowid', m.rowid,",
    "'id', m.id,",
    "'session_id', m.session_id,",
    "'time_created', m.time_updated,",
    "'role', 'assistant',",
    "'project_worktree', p.worktree,",
    "'data', json_object(",
    "'tokens', json_extract(m.data, '$.tokens'),",
    "'time', json_extract(m.data, '$.time'),",
    "'model', json_extract(m.data, '$.model')",
    ")",
    ")",
    "FROM session_message m",
    "LEFT JOIN session_v2 s ON s.id = m.session_id",
    "LEFT JOIN project p ON p.id = s.project_id",
    `WHERE m.rowid > ${int(afterRowid)}`,
    `AND (m.rowid > ${int(lastRowid)} OR m.time_updated >= ${int(lastTimeUpdated)})`,
    "AND m.type IN ('assistant', 'compaction')",
    "AND json_extract(m.data, '$.tokens') IS NOT NULL",
    // A fork copies its parent's rows under new ids but keeps their time_created, which predates the fork.
    "AND NOT (s.fork_session_id IS NOT NULL AND m.time_created < s.time_created)",
    "ORDER BY m.rowid ASC",
    `LIMIT ${Math.max(1, int(limit))};`,
  ].join(" ");
}

function parseMessageRows(stdout) {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed !== "object") continue;
      rows.push(parsed);
    } catch (_) {}
  }
  return rows;
}

function normalizeErrorCode(error) {
  return typeof error?.code === "string" && error.code.trim() ? error.code.trim() : null;
}

async function readOpencodeSqliteRows({
  dbPath,
  lastTimeCreated = 0,
  lastRowid = 0,
  expectedInode = 0,
  pageSize = V2_PAGE_SIZE,
  statFn = fs.stat,
  execFileFn = execFileAsync,
}) {
  const checkedAt = new Date().toISOString();
  const st = await statFn(dbPath).catch(() => null);
  if (!st || !st.isFile()) {
    return {
      status: "missing-db",
      checkedAt,
      rows: [],
      inode: 0,
      cursorReset: false,
      errorCode: null,
    };
  }

  try {
    const inode = Number.isFinite(st.ino) ? st.ino : 0;
    const reset = Boolean(expectedInode && inode && expectedInode !== inode);
    const effectiveLastTimeCreated = reset ? 0 : lastTimeCreated;
    const run = async (query) =>
      parseMessageRows(
        (await execFileFn("sqlite3", ["-readonly", dbPath, query], { maxBuffer: 64 * 1024 * 1024 })).stdout,
      );
    const probe = await execFileFn("sqlite3", ["-readonly", dbPath, V2_PROBE_QUERY]);
    let rows;
    if (String(probe?.stdout || "").trim() === "1") {
      rows = [];
      let afterRowid = 0;
      for (;;) {
        const page = await run(
          buildMessageQueryV2({
            afterRowid,
            lastRowid: reset ? 0 : lastRowid,
            lastTimeUpdated: effectiveLastTimeCreated,
            limit: pageSize,
          }),
        );
        for (const row of page) rows.push(row);
        if (page.length < pageSize) break;
        afterRowid = Number(page[page.length - 1].rowid);
      }
    } else {
      rows = await run(buildMessageQuery(effectiveLastTimeCreated));
    }
    return {
      status: "ok",
      checkedAt,
      rows,
      inode,
      cursorReset: Boolean(expectedInode && inode && expectedInode !== inode),
      errorCode: null,
    };
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    if (error && error.code === "ENOENT") {
      return {
        status: "missing-sqlite3",
        checkedAt,
        rows: [],
        inode: Number.isFinite(st.ino) ? st.ino : 0,
        cursorReset: false,
        error,
        errorCode,
      };
    }
    return {
      status: "query-failed",
      checkedAt,
      rows: [],
      inode: Number.isFinite(st.ino) ? st.ino : 0,
      cursorReset: false,
      error,
      errorCode,
    };
  }
}

module.exports = {
  buildMessageQuery,
  buildMessageQueryV2,
  parseMessageRows,
  readOpencodeSqliteRows,
};
