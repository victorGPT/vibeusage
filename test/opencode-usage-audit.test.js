const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { auditOpencodeUsage } = require("../src/lib/opencode-usage-audit");

function buildMessage({ model = "gpt-4o", createdMs, completedMs, tokens }) {
  return {
    id: "msg_1",
    sessionID: "ses_1",
    modelID: model,
    time: { created: createdMs, completed: completedMs },
    tokens: {
      input: tokens.input,
      output: tokens.output,
      reasoning: tokens.reasoning,
      cache: { read: tokens.cached },
    },
  };
}

test("auditOpencodeUsage reports mismatch when server totals differ", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-audit-"));
  try {
    const messageDir = path.join(tmp, "message", "ses_1");
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, "msg_1.json");

    const message = buildMessage({
      createdMs: Date.parse("2025-12-29T10:14:00.000Z"),
      completedMs: Date.parse("2025-12-29T10:15:00.000Z"),
      tokens: { input: 4, output: 1, reasoning: 0, cached: 0 },
    });
    await fs.writeFile(messagePath, JSON.stringify(message), "utf8");

    const fetchHourly = async () => ({
      day: "2025-12-29",
      data: [
        {
          hour: "2025-12-29T10:00:00",
          total_tokens: "999",
          input_tokens: "999",
          cached_input_tokens: "0",
          output_tokens: "0",
          reasoning_output_tokens: "0",
        },
      ],
    });

    const result = await auditOpencodeUsage({
      storageDir: tmp,
      from: "2025-12-29",
      to: "2025-12-29",
      fetchHourly,
    });

    assert.equal(result.summary.mismatched, 1);
    assert.ok(result.diffs.length > 0);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("auditOpencodeUsage derives day range from local data", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-audit-"));
  try {
    const messageDir = path.join(tmp, "message", "ses_1");
    await fs.mkdir(messageDir, { recursive: true });

    const messageA = buildMessage({
      createdMs: Date.parse("2025-12-30T10:14:00.000Z"),
      completedMs: Date.parse("2025-12-30T10:15:00.000Z"),
      tokens: { input: 4, output: 1, reasoning: 0, cached: 0 },
    });
    await fs.writeFile(path.join(messageDir, "msg_1.json"), JSON.stringify(messageA), "utf8");

    const messageB = buildMessage({
      createdMs: Date.parse("2025-12-31T11:14:00.000Z"),
      completedMs: Date.parse("2025-12-31T11:15:00.000Z"),
      tokens: { input: 3, output: 2, reasoning: 1, cached: 0 },
    });
    await fs.writeFile(path.join(messageDir, "msg_2.json"), JSON.stringify(messageB), "utf8");

    const days = [];
    const fetchHourly = async (day) => {
      days.push(day);
      return { day, data: [] };
    };

    const result = await auditOpencodeUsage({
      storageDir: tmp,
      fetchHourly,
    });

    assert.deepEqual(days, ["2025-12-30", "2025-12-31"]);
    assert.equal(result.summary.days, 2);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("runAuditCli returns 2 when diffs exist", async () => {
  const { runAuditCli } = require("../scripts/ops/opencode-usage-audit.cjs");
  const code = await runAuditCli(["--from", "2025-12-29", "--to", "2025-12-29"], {
    env: { VIBEUSAGE_ACCESS_TOKEN: "token" },
    audit: async () => ({
      summary: { days: 1, slots: 48, matched: 47, mismatched: 1, maxDelta: 10n },
      diffs: [
        {
          hour: "2025-12-29T10:00:00",
          local: { total_tokens: 5n },
          server: { total_tokens: 10n },
          delta: { total_tokens: -5n },
        },
      ],
    }),
    log: () => {},
    error: () => {},
  });
  assert.equal(code, 2);
});

test("runAuditCli honors OPENCODE_HOME when resolving storage", async () => {
  const { runAuditCli } = require("../scripts/ops/opencode-usage-audit.cjs");
  const opencodeHome = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-home-"));
  try {
    let observedStorage = null;
    const code = await runAuditCli(["--from", "2025-12-29", "--to", "2025-12-29"], {
      env: {
        VIBEUSAGE_ACCESS_TOKEN: "token",
        OPENCODE_HOME: opencodeHome,
      },
      audit: async ({ storageDir }) => {
        observedStorage = storageDir;
        return {
          summary: { days: 1, slots: 48, matched: 48, mismatched: 0, incomplete: 0, maxDelta: 0n },
          diffs: [],
        };
      },
      log: () => {},
      error: () => {},
    });
    assert.equal(code, 0);
    assert.equal(observedStorage, path.resolve(opencodeHome, "storage"));
  } finally {
    await fs.rm(opencodeHome, { recursive: true, force: true });
  }
});

test("auditOpencodeUsage ignores missing hourly slots by default", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-audit-"));
  try {
    const messageDir = path.join(tmp, "message", "ses_1");
    await fs.mkdir(messageDir, { recursive: true });
    const messagePath = path.join(messageDir, "msg_1.json");

    const message = buildMessage({
      createdMs: Date.parse("2025-12-29T10:14:00.000Z"),
      completedMs: Date.parse("2025-12-29T10:15:00.000Z"),
      tokens: { input: 4, output: 1, reasoning: 0, cached: 0 },
    });
    await fs.writeFile(messagePath, JSON.stringify(message), "utf8");

    const fetchHourly = async () => ({
      day: "2025-12-29",
      data: [
        {
          hour: "2025-12-29T10:00:00",
          total_tokens: "0",
          input_tokens: "0",
          cached_input_tokens: "0",
          output_tokens: "0",
          reasoning_output_tokens: "0",
          missing: true,
        },
      ],
    });

    const result = await auditOpencodeUsage({
      storageDir: tmp,
      from: "2025-12-29",
      to: "2025-12-29",
      fetchHourly,
    });

    assert.equal(result.summary.mismatched, 0);
    assert.equal(result.summary.incomplete, 1);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("auditOpencodeUsage reads sqlite-backed local totals when storage files are absent", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-audit-sqlite-"));
  try {
    const storageDir = path.join(tmp, "storage");
    await fs.mkdir(storageDir, { recursive: true });
    const dbPath = path.join(tmp, "opencode.db");

    const payload = JSON.stringify(
      buildMessage({
        createdMs: Date.parse("2025-12-29T10:14:00.000Z"),
        completedMs: Date.parse("2025-12-29T10:15:00.000Z"),
        tokens: { input: 4, output: 1, reasoning: 0, cached: 0 },
      }),
    ).replace(/'/g, "''");

    cp.execFileSync("sqlite3", [
      dbPath,
      [
        "create table project (id text primary key, worktree text not null);",
        "create table session (id text primary key, project_id text not null, time_created integer, data text);",
        "create table message (id text primary key, session_id text not null, time_created integer, data text not null);",
        "insert into project (id, worktree) values ('proj_1', '/tmp/example-project');",
        "insert into session (id, project_id, time_created, data) values ('ses_1', 'proj_1', 1767003240000, '{}');",
        `insert into message (id, session_id, time_created, data) values ('msg_1', 'ses_1', 1767003300000, '${payload}');`,
      ].join(" "),
    ]);

    const fetchHourly = async () => ({
      day: "2025-12-29",
      data: [
        {
          hour: "2025-12-29T10:00:00",
          total_tokens: "999",
          input_tokens: "999",
          cached_input_tokens: "0",
          output_tokens: "0",
          reasoning_output_tokens: "0",
        },
      ],
    });

    const result = await auditOpencodeUsage({
      storageDir,
      from: "2025-12-29",
      to: "2025-12-29",
      fetchHourly,
    });

    assert.equal(result.summary.days, 1);
    assert.equal(result.summary.mismatched, 1);
    assert.equal(result.diffs[0].local.total_tokens, 5n);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
