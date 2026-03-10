const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  buildMessageQuery,
  parseMessageRows,
  readOpencodeSqliteRows,
} = require("../src/lib/opencode-sqlite");

test("parseMessageRows parses newline-delimited sqlite json output", () => {
  const rows = parseMessageRows(
    [
      JSON.stringify({ id: "m1", session_id: "s1", time_created: 1 }),
      "",
      "not-json",
      JSON.stringify({ id: "m2", session_id: "s2", time_created: 2 }),
    ].join("\n"),
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "m1");
  assert.equal(rows[1].id, "m2");
});

test("buildMessageQuery uses the requested lower bound", () => {
  const sql = buildMessageQuery(1234);
  assert.match(sql, /WHERE m\.time_created >= 1234/);
  assert.match(sql, /LEFT JOIN session s ON s\.id = m\.session_id/);
});

test("readOpencodeSqliteRows resets cursor when inode changes", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-opencode-sqlite-"));
  try {
    const dbPath = path.join(tmp, "opencode.db");
    await fs.writeFile(dbPath, "", "utf8");
    let receivedSql = "";

    const result = await readOpencodeSqliteRows({
      dbPath,
      lastTimeCreated: 9999,
      expectedInode: 1,
      execFileFn: async (_cmd, args) => {
        receivedSql = args[2];
        return { stdout: `${JSON.stringify({ id: "m1", session_id: "s1", time_created: 10 })}\n` };
      },
    });

    assert.equal(result.status, "ok");
    assert.equal(result.cursorReset, true);
    assert.match(receivedSql, /WHERE m\.time_created >= 0/);
    assert.equal(result.rows.length, 1);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
