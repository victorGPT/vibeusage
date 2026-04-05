const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const {
  OPENCLAW_SESSION_PLUGIN_ID,
  resolveOpenclawSessionPluginPaths,
  ensureOpenclawSessionPluginFiles,
  probeOpenclawSessionPluginState,
  installOpenclawSessionPlugin,
  removeOpenclawSessionPluginConfig,
} = require("../src/lib/openclaw-session-plugin");
const { readOpenclawUsageLedger } = require("../src/lib/openclaw-usage-ledger");

async function seedTrackerLedgerRuntime(trackerDir) {
  const runtimeLibDir = path.join(trackerDir, "app", "src", "lib");
  await fs.mkdir(runtimeLibDir, { recursive: true });
  await fs.copyFile(
    path.join(__dirname, "..", "src", "lib", "openclaw-usage-ledger.js"),
    path.join(runtimeLibDir, "openclaw-usage-ledger.js"),
  );
  await fs.copyFile(
    path.join(__dirname, "..", "src", "lib", "fs.js"),
    path.join(runtimeLibDir, "fs.js"),
  );
}

test("probeOpenclawSessionPluginState detects linked + enabled plugin", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  const { pluginEntryDir, openclawConfigPath } = resolveOpenclawSessionPluginPaths({
    home,
    trackerDir,
    env: {},
  });
  await ensureOpenclawSessionPluginFiles({
    pluginDir: path.dirname(pluginEntryDir),
    trackerDir,
    packageName: "vibeusage",
  });
  await fs.mkdir(path.dirname(openclawConfigPath), { recursive: true });
  await fs.writeFile(
    openclawConfigPath,
    JSON.stringify(
      {
        plugins: {
          entries: {
            [OPENCLAW_SESSION_PLUGIN_ID]: { enabled: true },
          },
          load: {
            paths: [pluginEntryDir],
          },
          installs: {
            [OPENCLAW_SESSION_PLUGIN_ID]: {
              source: "path",
              sourcePath: pluginEntryDir,
              installPath: pluginEntryDir,
              version: "0.0.0",
            },
          },
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const state = await probeOpenclawSessionPluginState({ home, trackerDir, env: {} });
  assert.equal(state.configured, true);
  assert.equal(state.enabled, true);
  assert.equal(state.linked, true);
  assert.equal(state.installed, true);
  assert.equal(state.pluginFilesReady, true);

  await fs.rm(tmp, { recursive: true, force: true });
});

test("installOpenclawSessionPlugin returns skipped when openclaw CLI is missing", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  const result = await installOpenclawSessionPlugin({
    home,
    trackerDir,
    packageName: "vibeusage",
    env: { PATH: "", OPENCLAW_CONFIG_PATH: path.join(home, ".openclaw", "openclaw.json") },
  });

  assert.equal(result.configured, false);
  assert.equal(result.skippedReason, "openclaw-cli-missing");

  await fs.rm(tmp, { recursive: true, force: true });
});

test("removeOpenclawSessionPluginConfig removes linked config and plugin dir", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  const { pluginEntryDir, openclawConfigPath } = resolveOpenclawSessionPluginPaths({
    home,
    trackerDir,
    env: {},
  });
  await ensureOpenclawSessionPluginFiles({
    pluginDir: path.dirname(pluginEntryDir),
    trackerDir,
    packageName: "vibeusage",
  });
  await fs.mkdir(path.dirname(openclawConfigPath), { recursive: true });

  const keepPath = path.join(tmp, "keep-plugin-path");
  await fs.mkdir(keepPath, { recursive: true });

  await fs.writeFile(
    openclawConfigPath,
    JSON.stringify(
      {
        plugins: {
          entries: {
            [OPENCLAW_SESSION_PLUGIN_ID]: { enabled: true },
            keep_plugin: { enabled: true },
          },
          load: {
            paths: [pluginEntryDir, keepPath],
          },
          installs: {
            [OPENCLAW_SESSION_PLUGIN_ID]: {
              source: "path",
              sourcePath: pluginEntryDir,
              installPath: pluginEntryDir,
              version: "0.0.0",
            },
            keep_plugin: {
              source: "path",
              sourcePath: keepPath,
              installPath: keepPath,
              version: "0.0.0",
            },
          },
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const removed = await removeOpenclawSessionPluginConfig({ home, trackerDir, env: {} });
  assert.equal(removed.removed, true);

  const next = JSON.parse(await fs.readFile(openclawConfigPath, "utf8"));
  assert.equal(Boolean(next?.plugins?.entries?.[OPENCLAW_SESSION_PLUGIN_ID]), false);
  assert.equal(Boolean(next?.plugins?.entries?.keep_plugin), true);
  assert.deepEqual(next?.plugins?.load?.paths, [keepPath]);
  assert.equal(Boolean(next?.plugins?.installs?.[OPENCLAW_SESSION_PLUGIN_ID]), false);
  assert.equal(Boolean(next?.plugins?.installs?.keep_plugin), true);

  await assert.rejects(() => fs.stat(pluginEntryDir));

  await fs.rm(tmp, { recursive: true, force: true });
});

test("ensureOpenclawSessionPluginFiles registers llm_output and writes sanitized ledger events", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  await seedTrackerLedgerRuntime(trackerDir);

  try {
    const { pluginEntryDir } = resolveOpenclawSessionPluginPaths({ home, trackerDir, env: {} });
    await ensureOpenclawSessionPluginFiles({
      pluginDir: path.dirname(pluginEntryDir),
      trackerDir,
      packageName: "vibeusage",
    });

    const pkg = JSON.parse(await fs.readFile(path.join(pluginEntryDir, "package.json"), "utf8"));
    assert.deepEqual(pkg.openclaw?.extensions, ["./index.js"]);

    const mod = await import(pathToFileURL(path.join(pluginEntryDir, "index.js")).href);
    const handlers = new Map();
    mod.default({
      on(name, handler) {
        handlers.set(name, handler);
      },
    });

    assert.equal(typeof handlers.get("llm_output"), "function");
    assert.equal(handlers.has("agent_end"), false);
    assert.equal(handlers.has("gateway_start"), false);
    assert.equal(handlers.has("gateway_stop"), false);

    await handlers.get("llm_output")(
      {
        emittedAt: "2026-04-05T01:45:00.000Z",
        provider: "openai",
        model: "gpt-5.4",
        inputTokens: 120,
        cachedInputTokens: 15,
        outputTokens: 33,
        reasoningOutputTokens: 7,
        totalTokens: 175,
        assistantTexts: ["secret answer"],
        lastAssistant: "secret answer",
      },
      {
        agentId: "codex-dev",
        sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
        channel: "discord",
        chatType: "channel",
        trigger: "llm_output",
        workspaceDir: "/Users/farmer/private/project",
      },
    );

    const { events } = await readOpenclawUsageLedger({ trackerDir, offset: 0 });
    assert.equal(events.length, 1);
    assert.equal(events[0].source, "openclaw");
    assert.equal(events[0].agentId, "codex-dev");
    assert.equal(events[0].provider, "openai");
    assert.equal(events[0].model, "gpt-5.4");
    assert.equal(events[0].channel, "discord");
    assert.equal(events[0].chatType, "channel");
    assert.equal(events[0].trigger, "llm_output");
    assert.equal(events[0].inputTokens, 120);
    assert.equal(events[0].cachedInputTokens, 15);
    assert.equal(events[0].outputTokens, 33);
    assert.equal(events[0].reasoningOutputTokens, 7);
    assert.equal(events[0].totalTokens, 175);
    assert.ok(!Object.prototype.hasOwnProperty.call(events[0], "sessionKey"));
    assert.ok(!Object.prototype.hasOwnProperty.call(events[0], "assistantTexts"));
    assert.ok(!Object.prototype.hasOwnProperty.call(events[0], "lastAssistant"));
    assert.ok(!Object.prototype.hasOwnProperty.call(events[0], "workspaceDir"));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("ensureOpenclawSessionPluginFiles triggers auto sync after appending a sanitized event", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  await seedTrackerLedgerRuntime(trackerDir);

  const trackerBinPath = path.join(trackerDir, "app", "bin", "tracker.js");
  const depsMarkerPath = path.join(
    trackerDir,
    "app",
    "node_modules",
    "@insforge",
    "sdk",
    "package.json",
  );
  await fs.mkdir(path.dirname(trackerBinPath), { recursive: true });
  await fs.writeFile(trackerBinPath, "#!/usr/bin/env node\n", "utf8");
  await fs.mkdir(path.dirname(depsMarkerPath), { recursive: true });
  await fs.writeFile(depsMarkerPath, '{"name":"@insforge/sdk"}\n', "utf8");

  const calls = [];
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { unref() {} };
  };

  try {
    const { pluginEntryDir } = resolveOpenclawSessionPluginPaths({ home, trackerDir, env: {} });
    await ensureOpenclawSessionPluginFiles({
      pluginDir: path.dirname(pluginEntryDir),
      trackerDir,
      packageName: "vibeusage",
    });

    const mod = await import(pathToFileURL(path.join(pluginEntryDir, "index.js")).href);
    const handlers = new Map();
    mod.default({
      on(name, handler) {
        handlers.set(name, handler);
      },
    });

    await handlers.get("llm_output")(
      {
        emittedAt: "2026-04-05T01:45:00.000Z",
        provider: "openai",
        model: "gpt-5.4",
        inputTokens: 120,
        cachedInputTokens: 15,
        outputTokens: 33,
        reasoningOutputTokens: 7,
        totalTokens: 175,
      },
      {
        agentId: "codex-dev",
        sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
        trigger: "llm_output",
      },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, process.execPath);
    assert.deepEqual(calls[0].args.slice(-3), ["sync", "--auto", "--from-openclaw"]);
    assert.equal(calls[0].options.detached, true);
    assert.equal(calls[0].options.stdio, "ignore");
  } finally {
    childProcess.spawn = originalSpawn;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("ensureOpenclawSessionPluginFiles falls back to event.sessionId when ctx.sessionKey is missing", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  await seedTrackerLedgerRuntime(trackerDir);

  const trackerBinPath = path.join(trackerDir, "app", "bin", "tracker.js");
  const depsMarkerPath = path.join(
    trackerDir,
    "app",
    "node_modules",
    "@insforge",
    "sdk",
    "package.json",
  );
  await fs.mkdir(path.dirname(trackerBinPath), { recursive: true });
  await fs.writeFile(trackerBinPath, "#!/usr/bin/env node\n", "utf8");
  await fs.mkdir(path.dirname(depsMarkerPath), { recursive: true });
  await fs.writeFile(depsMarkerPath, '{"name":"@insforge/sdk"}\n', "utf8");

  const calls = [];
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { unref() {} };
  };

  try {
    const { pluginEntryDir } = resolveOpenclawSessionPluginPaths({ home, trackerDir, env: {} });
    await ensureOpenclawSessionPluginFiles({
      pluginDir: path.dirname(pluginEntryDir),
      trackerDir,
      packageName: "vibeusage",
    });

    const mod = await import(pathToFileURL(path.join(pluginEntryDir, "index.js")).href);
    const handlers = new Map();
    mod.default({
      on(name, handler) {
        handlers.set(name, handler);
      },
    });

    await handlers.get("llm_output")(
      {
        emittedAt: "2026-04-05T05:30:00.000Z",
        sessionId: "vibeusage-debug-probe",
        provider: "openai-codex",
        model: "gpt-5.4",
        usage: {
          input: 22009,
          output: 75,
          total: 22084,
        },
      },
      {
        agentId: "main",
        trigger: "user",
      },
    );

    const { events } = await readOpenclawUsageLedger({ trackerDir, offset: 0 });
    assert.equal(events.length, 1);
    assert.equal(events[0].agentId, "main");
    assert.equal(events[0].inputTokens, 22009);
    assert.equal(events[0].outputTokens, 75);
    assert.equal(events[0].totalTokens, 22084);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args.slice(-3), ["sync", "--auto", "--from-openclaw"]);
  } finally {
    childProcess.spawn = originalSpawn;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("ensureOpenclawSessionPluginFiles maps live usage.total into ledger totalTokens", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  await seedTrackerLedgerRuntime(trackerDir);

  try {
    const { pluginEntryDir } = resolveOpenclawSessionPluginPaths({ home, trackerDir, env: {} });
    await ensureOpenclawSessionPluginFiles({
      pluginDir: path.dirname(pluginEntryDir),
      trackerDir,
      packageName: "vibeusage",
    });

    const mod = await import(pathToFileURL(path.join(pluginEntryDir, "index.js")).href);
    const handlers = new Map();
    mod.default({
      on(name, handler) {
        handlers.set(name, handler);
      },
    });

    await handlers.get("llm_output")(
      {
        emittedAt: "2026-04-05T05:25:00.000Z",
        provider: "openai-codex",
        model: "gpt-5.4",
        input: 22009,
        output: 120,
        total: 22129,
      },
      {
        agentId: "codex-dev",
        sessionKey: "agent:codex-dev:discord:channel:1490019049302659232",
        trigger: "user",
      },
    );

    const { events } = await readOpenclawUsageLedger({ trackerDir, offset: 0 });
    assert.equal(events.length, 1);
    assert.equal(events[0].inputTokens, 22009);
    assert.equal(events[0].outputTokens, 120);
    assert.equal(events[0].totalTokens, 22129);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("ensureOpenclawSessionPluginFiles triggers sync without transcript env hints", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-openclaw-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const { pluginEntryDir } = resolveOpenclawSessionPluginPaths({ home, trackerDir, env: {} });
    await ensureOpenclawSessionPluginFiles({
      pluginDir: path.dirname(pluginEntryDir),
      trackerDir,
      packageName: "vibeusage",
    });

    const index = await fs.readFile(path.join(pluginEntryDir, "index.js"), "utf8");
    assert.match(index, /api\.on\('llm_output'/);
    assert.match(index, /sync', '--auto', '--from-openclaw/);
    assert.doesNotMatch(index, /api\.on\('agent_end'/);
    assert.doesNotMatch(index, /api\.on\('gateway_start'/);
    assert.doesNotMatch(index, /api\.on\('gateway_stop'/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_AGENT_ID/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_SESSION_KEY/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_SESSION_ID/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_TOTAL_TOKENS/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_INPUT_TOKENS/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_OUTPUT_TOKENS/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_MODEL/);
    assert.doesNotMatch(index, /VIBEUSAGE_OPENCLAW_PREV_UPDATED_AT/);
    assert.doesNotMatch(index, /sessions\.json/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
