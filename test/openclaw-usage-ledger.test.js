const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  buildOpenclawUsageEvent,
  appendOpenclawUsageEvent,
  hashOpenclawSessionRef,
  readOpenclawUsageLedger,
  resolveOpenclawUsageLedgerPaths,
} = require("../src/lib/openclaw-usage-ledger");

async function readJsonl(filePath) {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("buildOpenclawUsageEvent hashes session keys and drops forbidden fields", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-ledger-"));
  const trackerDir = path.join(tmp, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const event = await buildOpenclawUsageEvent({
      trackerDir,
      payload: {
        emittedAt: "2026-04-05T01:30:00.000Z",
        source: "openclaw",
        agentId: "codex-dev",
        sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
        provider: "openai",
        model: "gpt-5.4",
        channel: "discord",
        chatType: "channel",
        trigger: "llm_output",
        inputTokens: 120,
        cachedInputTokens: 15,
        outputTokens: 33,
        reasoningOutputTokens: 7,
        totalTokens: 175,
        assistantTexts: ["secret answer"],
        lastAssistant: "secret answer",
        workspaceDir: "/Users/farmer/private/project",
        apiKey: "sk-secret",
        password: "pw-secret",
        token: "tok-secret",
        cookies: "session=secret",
      },
    });

    assert.equal(event.source, "openclaw");
    assert.equal(event.agentId, "codex-dev");
    assert.equal(event.provider, "openai");
    assert.equal(event.model, "gpt-5.4");
    assert.equal(event.channel, "discord");
    assert.equal(event.chatType, "channel");
    assert.equal(event.trigger, "llm_output");
    assert.equal(event.inputTokens, 120);
    assert.equal(event.cachedInputTokens, 15);
    assert.equal(event.outputTokens, 33);
    assert.equal(event.reasoningOutputTokens, 7);
    assert.equal(event.totalTokens, 175);
    assert.equal(typeof event.eventId, "string");
    assert.equal(typeof event.sessionRef, "string");
    assert.notEqual(
      event.sessionRef,
      "agent:codex-dev:discord:channel:1490019049302659232",
      "expected session key to be hashed before persistence",
    );
    assert.equal(event.sessionRef.length, 64);
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "sessionKey"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "assistantTexts"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "lastAssistant"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "workspaceDir"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "apiKey"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "password"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "token"));
    assert.ok(!Object.prototype.hasOwnProperty.call(event, "cookies"));

    await appendOpenclawUsageEvent({ trackerDir, event });
    const { ledgerPath } = resolveOpenclawUsageLedgerPaths({ trackerDir });
    const rows = await readJsonl(ledgerPath);
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "agentId",
      "cachedInputTokens",
      "channel",
      "chatType",
      "emittedAt",
      "eventId",
      "inputTokens",
      "model",
      "outputTokens",
      "provider",
      "reasoningOutputTokens",
      "sessionRef",
      "source",
      "totalTokens",
      "trigger",
    ]);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("appendOpenclawUsageEvent suppresses duplicate event ids", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-ledger-"));
  const trackerDir = path.join(tmp, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const payload = {
      emittedAt: "2026-04-05T01:31:00.000Z",
      source: "openclaw",
      agentId: "codex-dev",
      sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
      provider: "openai",
      model: "gpt-5.4",
      channel: "discord",
      chatType: "channel",
      trigger: "llm_output",
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 5,
      reasoningOutputTokens: 0,
      totalTokens: 15,
    };

    const first = await buildOpenclawUsageEvent({ trackerDir, payload });
    const second = await buildOpenclawUsageEvent({ trackerDir, payload });
    assert.equal(first.eventId, second.eventId, "expected deterministic event ids");

    const firstAppend = await appendOpenclawUsageEvent({ trackerDir, event: first });
    const secondAppend = await appendOpenclawUsageEvent({ trackerDir, event: second });

    assert.equal(firstAppend.appended, true);
    assert.equal(secondAppend.appended, false);

    const { ledgerPath } = resolveOpenclawUsageLedgerPaths({ trackerDir });
    const rows = await readJsonl(ledgerPath);
    assert.equal(rows.length, 1);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("hashOpenclawSessionRef uses a stable per-install salt", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-ledger-"));
  const trackerDir = path.join(tmp, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const a1 = await hashOpenclawSessionRef({
      trackerDir,
      sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
    });
    const a2 = await hashOpenclawSessionRef({
      trackerDir,
      sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
    });
    const b = await hashOpenclawSessionRef({
      trackerDir,
      sessionKey: "agent:codex-dev:discord:channel:1490019049302659999",
    });

    assert.equal(a1, a2);
    assert.notEqual(a1, b);

    const { saltPath } = resolveOpenclawUsageLedgerPaths({ trackerDir });
    const salt = (await fs.readFile(saltPath, "utf8")).trim();
    assert.ok(salt.length > 0);
    assert.notEqual(salt, "agent:codex-dev:discord:channel:1490019049302659232");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("readOpenclawUsageLedger streams sanitized events by offset", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-ledger-"));
  const trackerDir = path.join(tmp, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const first = await buildOpenclawUsageEvent({
      trackerDir,
      payload: {
        emittedAt: "2026-04-05T01:40:00.000Z",
        source: "openclaw",
        agentId: "agent-a",
        sessionKey: "session-a",
        provider: "openai",
        model: "gpt-5.4",
        trigger: "llm_output",
        inputTokens: 20,
        cachedInputTokens: 2,
        outputTokens: 4,
        reasoningOutputTokens: 0,
        totalTokens: 26,
      },
    });
    const second = await buildOpenclawUsageEvent({
      trackerDir,
      payload: {
        emittedAt: "2026-04-05T01:41:00.000Z",
        source: "openclaw",
        agentId: "agent-a",
        sessionKey: "session-b",
        provider: "openai",
        model: "gpt-5.4",
        trigger: "llm_output",
        inputTokens: 30,
        cachedInputTokens: 3,
        outputTokens: 5,
        reasoningOutputTokens: 1,
        totalTokens: 39,
      },
    });

    await appendOpenclawUsageEvent({ trackerDir, event: first });
    await appendOpenclawUsageEvent({ trackerDir, event: second });

    const initial = await readOpenclawUsageLedger({ trackerDir, offset: 0 });
    assert.equal(initial.events.length, 2);
    assert.ok(initial.endOffset > 0);
    assert.ok(initial.events.every((event) => !Object.prototype.hasOwnProperty.call(event, "sessionKey")));

    const next = await readOpenclawUsageLedger({ trackerDir, offset: initial.endOffset });
    assert.deepEqual(next.events, []);
    assert.equal(next.endOffset, initial.endOffset);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
