const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { cmdSync } = require("../src/commands/sync");
const { cmdStatus } = require("../src/commands/status");
const { collectTrackerDiagnostics } = require("../src/lib/diagnostics");
const { resolveTrackerPaths } = require("../src/lib/tracker-paths");
const { readHermesUsageLedger, resolveHermesUsageLedgerPaths } = require("../src/lib/hermes-usage-ledger");

function usageLine(overrides = {}) {
  return {
    version: 1,
    type: "usage",
    source: "hermes",
    session_id: "s1",
    platform: "cli",
    model: "openai/gpt-5.4",
    provider: "openai-codex",
    api_mode: "chat_completions",
    api_call_count: 1,
    input_tokens: 10,
    output_tokens: 4,
    cache_read_tokens: 3,
    cache_write_tokens: 2,
    reasoning_tokens: 1,
    total_tokens: 20,
    finish_reason: "stop",
    emitted_at: "2026-04-10T12:34:56.000Z",
    ...overrides,
  };
}

test("Hermes sync parses ledger into queue and remains idempotent", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-hermes-ledger-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const { trackerDir } = await resolveTrackerPaths({ home: tmp });
    await fs.mkdir(trackerDir, { recursive: true });
    const { ledgerPath } = resolveHermesUsageLedgerPaths({ trackerDir });
    const payload = [
      usageLine(),
      usageLine({ emitted_at: "2026-04-10T12:40:00.000Z", input_tokens: 5, output_tokens: 1, total_tokens: 9 }),
      { version: 1, type: "usage", source: "hermes", emitted_at: "bad-date", input_tokens: 99 },
      { version: 1, type: "session_start", source: "hermes", emitted_at: "2026-04-10T12:30:00.000Z" },
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n");
    await fs.writeFile(ledgerPath, `${payload}\n`, "utf8");

    process.stdout.write = () => true;
    await cmdSync([]);

    const queuePath = path.join(trackerDir, "queue.jsonl");
    const queueRaw = await fs.readFile(queuePath, "utf8");
    const queued = queueRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const hermesRows = queued.filter((row) => row.source === "hermes");
    assert.equal(hermesRows.length, 1);
    assert.equal(hermesRows[0].model, "openai/gpt-5.4");
    assert.equal(hermesRows[0].input_tokens, 15);
    assert.equal(hermesRows[0].cached_input_tokens, 10);
    assert.equal(hermesRows[0].output_tokens, 5);
    assert.equal(hermesRows[0].reasoning_output_tokens, 2);
    assert.equal(hermesRows[0].total_tokens, 29);

    const cursors = JSON.parse(await fs.readFile(path.join(trackerDir, "cursors.json"), "utf8"));
    assert.equal(typeof cursors.hermesLedger.offset, "number");
    assert.equal(cursors.hermesLedger.lastEventAt, "2026-04-10T12:40:00.000Z");

    await cmdSync([]);
    const queueRawAfter = await fs.readFile(queuePath, "utf8");
    assert.equal(queueRawAfter, queueRaw);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("Hermes ledger reader preserves incomplete trailing JSON for retry", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-hermes-tail-"));

  try {
    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    const { ledgerPath } = resolveHermesUsageLedgerPaths({ trackerDir });
    const first = `${JSON.stringify(usageLine())}\n`;
    const second = JSON.stringify(usageLine({ session_id: "s2", emitted_at: "2026-04-10T12:40:00.000Z" }));
    const partial = second.slice(0, Math.floor(second.length / 2));
    await fs.writeFile(ledgerPath, first + partial, "utf8");

    const firstRead = await readHermesUsageLedger({ trackerDir, offset: 0 });
    assert.equal(firstRead.events.length, 1);
    assert.equal(firstRead.events[0].session_id, "s1");
    assert.equal(firstRead.endOffset, Buffer.byteLength(first, "utf8"));

    await fs.appendFile(ledgerPath, `${second.slice(partial.length)}\n`, "utf8");
    const secondRead = await readHermesUsageLedger({ trackerDir, offset: firstRead.endOffset });
    assert.equal(secondRead.events.length, 1);
    assert.equal(secondRead.events[0].session_id, "s2");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("status and diagnostics expose Hermes plugin and ledger state", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-hermes-status-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevHermesHome = process.env.HERMES_HOME;
  const prevWrite = process.stdout.write;

  try {
    process.env.HOME = tmp;
    process.env.HERMES_HOME = path.join(tmp, ".hermes");
    process.env.CODEX_HOME = path.join(tmp, ".codex");
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });
    await fs.mkdir(path.join(process.env.HERMES_HOME, "plugins", "vibeusage"), { recursive: true });

    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    const { ledgerPath } = resolveHermesUsageLedgerPaths({ trackerDir });
    await fs.writeFile(
      ledgerPath,
      `${JSON.stringify(usageLine({ emitted_at: "2026-04-10T12:34:56.000Z" }))}\n`,
      "utf8",
    );
    await fs.writeFile(
      path.join(process.env.HERMES_HOME, "plugins", "vibeusage", "plugin.yaml"),
      '# VIBEUSAGE_HERMES_PLUGIN\nname: vibeusage\nversion: "1"\ndescription: "VibeUsage Hermes usage ledger plugin"\nauthor: "VibeUsage"\nprovides_hooks:\n  - "on_session_start"\n  - "post_api_request"\n  - "on_session_end"\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(process.env.HERMES_HOME, "plugins", "vibeusage", "__init__.py"),
      '# VIBEUSAGE_HERMES_PLUGIN\nLEDGER_PATH = "placeholder"\n\ndef register(ctx):\n    pass\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(trackerDir, "cursors.json"),
      JSON.stringify({ hermesLedger: { version: 1, offset: 123, updatedAt: "2026-04-10T12:35:00.000Z", lastEventAt: "2026-04-10T12:34:56.000Z" } }) + "\n",
      "utf8",
    );

    let out = "";
    process.stdout.write = (chunk, enc, cb) => {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    };
    await cmdStatus([]);
    assert.match(out, /- Hermes plugin: drifted|set/);
    assert.match(out, /- Hermes ledger: present/);
    assert.match(out, /- Hermes last ledger event: 2026-04-10T12:34:56.000Z/);

    const diagnostics = await collectTrackerDiagnostics({ home: tmp });
    assert.equal(typeof diagnostics.paths.hermes_home, "string");
    assert.equal(diagnostics.hermes.ledger_present, true);
    assert.equal(diagnostics.hermes.ledger_offset, 123);
    assert.equal(diagnostics.hermes.last_event_at, "2026-04-10T12:34:56.000Z");
    assert.equal(diagnostics.notify.hermes_plugin_status === "ready" || diagnostics.notify.hermes_plugin_status === "drifted", true);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevHermesHome === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = prevHermesHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
