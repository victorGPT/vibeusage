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

async function readOpencodeSqliteRows({
  dbPath,
  lastTimeCreated = 0,
  expectedInode = 0,
  statFn = fs.stat,
  execFileFn = execFileAsync,
}) {
  const st = await statFn(dbPath).catch(() => null);
  if (!st || !st.isFile()) {
    return { status: "missing-db", rows: [], inode: 0 };
  }

  try {
    const inode = Number.isFinite(st.ino) ? st.ino : 0;
    const effectiveLastTimeCreated =
      expectedInode && inode && expectedInode !== inode ? 0 : lastTimeCreated;
    const { stdout } = await execFileFn(
      "sqlite3",
      ["-readonly", dbPath, buildMessageQuery(effectiveLastTimeCreated)],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    return {
      status: "ok",
      rows: parseMessageRows(stdout),
      inode,
      cursorReset: Boolean(expectedInode && inode && expectedInode !== inode),
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        status: "missing-sqlite3",
        rows: [],
        inode: Number.isFinite(st.ino) ? st.ino : 0,
        error,
      };
    }
    return {
      status: "query-failed",
      rows: [],
      inode: Number.isFinite(st.ino) ? st.ino : 0,
      error,
    };
  }
}

module.exports = {
  buildMessageQuery,
  parseMessageRows,
  readOpencodeSqliteRows,
};
