const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const {
  CLAUDE_PLUGIN_MARKETPLACE_NAME,
  CLAUDE_PLUGIN_ID,
  resolveClaudePluginPaths,
  ensureClaudePluginFiles,
  probeClaudePluginState,
  installClaudePlugin,
} = require("../src/lib/claude-plugin");

test("ensureClaudePluginFiles writes marketplace + plugin skeleton with Stop and SessionEnd hooks", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-claude-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const paths = resolveClaudePluginPaths({ home, trackerDir });
    await ensureClaudePluginFiles({
      trackerDir,
      notifyPath: path.join(home, ".vibeusage", "bin", "notify.cjs"),
    });

    const marketplace = JSON.parse(
      await fs.readFile(path.join(paths.marketplaceDir, ".claude-plugin", "marketplace.json"), "utf8"),
    );
    const plugin = JSON.parse(
      await fs.readFile(path.join(paths.pluginRootDir, ".claude-plugin", "plugin.json"), "utf8"),
    );
    const hooks = JSON.parse(
      await fs.readFile(path.join(paths.pluginRootDir, "hooks", "hooks.json"), "utf8"),
    );

    assert.equal(marketplace.name, CLAUDE_PLUGIN_MARKETPLACE_NAME);
    assert.equal(marketplace.owner?.name, "VibeUsage");
    assert.equal(marketplace.plugins?.[0]?.name, CLAUDE_PLUGIN_ID);
    assert.equal(marketplace.plugins?.[0]?.source, `./plugins/${CLAUDE_PLUGIN_ID}`);
    assert.equal(plugin.name, CLAUDE_PLUGIN_ID);
    assert.ok(Array.isArray(hooks?.hooks?.Stop), "expected Stop hooks array");
    assert.ok(Array.isArray(hooks?.hooks?.SessionEnd), "expected SessionEnd hooks array");
    const stopCommand = hooks.hooks.Stop[0]?.hooks?.[0]?.command || "";
    const sessionEndCommand = hooks.hooks.SessionEnd[0]?.hooks?.[0]?.command || "";
    assert.match(stopCommand, /notify\.cjs --source=claude/);
    assert.match(sessionEndCommand, /notify\.cjs --source=claude/);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("probeClaudePluginState detects ready user-scoped plugin", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-claude-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const paths = resolveClaudePluginPaths({ home, trackerDir });
    await ensureClaudePluginFiles({
      trackerDir,
      notifyPath: path.join(home, ".vibeusage", "bin", "notify.cjs"),
    });

    await fs.mkdir(path.dirname(paths.settingsPath), { recursive: true });
    await fs.mkdir(path.dirname(paths.installedPluginsPath), { recursive: true });
    await fs.writeFile(
      paths.settingsPath,
      JSON.stringify(
        {
          enabledPlugins: {
            [paths.pluginRef]: true,
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      paths.knownMarketplacesPath,
      JSON.stringify(
        {
          [CLAUDE_PLUGIN_MARKETPLACE_NAME]: {
            source: { source: "path", path: paths.marketplaceDir },
            installLocation: path.join(home, ".claude", "plugins", "marketplaces", CLAUDE_PLUGIN_MARKETPLACE_NAME),
            lastUpdated: "2026-04-06T00:00:00.000Z",
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      paths.installedPluginsPath,
      JSON.stringify(
        {
          version: 2,
          plugins: {
            [paths.pluginRef]: [
              {
                scope: "user",
                installPath: path.join(home, ".claude", "plugins", "cache", CLAUDE_PLUGIN_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID, "1.0.0"),
                version: "1.0.0",
                installedAt: "2026-04-06T00:00:00.000Z",
                lastUpdated: "2026-04-06T00:00:00.000Z",
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const state = await probeClaudePluginState({ home, trackerDir });
    assert.equal(state.configured, true);
    assert.equal(state.enabled, true);
    assert.equal(state.installed, true);
    assert.equal(state.marketplaceDeclared, true);
    assert.equal(state.pluginFilesReady, true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("probeClaudePluginState rejects marketplace entries that point to a different path", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-claude-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const paths = resolveClaudePluginPaths({ home, trackerDir });
    await ensureClaudePluginFiles({
      trackerDir,
      notifyPath: path.join(home, ".vibeusage", "bin", "notify.cjs"),
    });

    await fs.mkdir(path.dirname(paths.settingsPath), { recursive: true });
    await fs.mkdir(path.dirname(paths.installedPluginsPath), { recursive: true });
    await fs.writeFile(
      paths.settingsPath,
      JSON.stringify(
        {
          enabledPlugins: {
            [paths.pluginRef]: true,
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      paths.knownMarketplacesPath,
      JSON.stringify(
        {
          [CLAUDE_PLUGIN_MARKETPLACE_NAME]: {
            source: { source: "path", path: path.join(tmp, "other-marketplace") },
            installLocation: path.join(home, ".claude", "plugins", "marketplaces", CLAUDE_PLUGIN_MARKETPLACE_NAME),
            lastUpdated: "2026-04-06T00:00:00.000Z",
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    await fs.writeFile(
      paths.installedPluginsPath,
      JSON.stringify(
        {
          version: 2,
          plugins: {
            [paths.pluginRef]: [
              {
                scope: "user",
                installPath: path.join(home, ".claude", "plugins", "cache", CLAUDE_PLUGIN_MARKETPLACE_NAME, CLAUDE_PLUGIN_ID, "1.0.0"),
                version: "1.0.0",
                installedAt: "2026-04-06T00:00:00.000Z",
                lastUpdated: "2026-04-06T00:00:00.000Z",
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const state = await probeClaudePluginState({ home, trackerDir });
    assert.equal(state.marketplaceDeclared, false);
    assert.equal(state.configured, false);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("probeClaudePluginState returns unreadable when plugin registry cannot be read", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-claude-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const paths = resolveClaudePluginPaths({ home, trackerDir });
    await ensureClaudePluginFiles({
      trackerDir,
      notifyPath: path.join(home, ".vibeusage", "bin", "notify.cjs"),
    });

    await fs.mkdir(path.dirname(paths.settingsPath), { recursive: true });
    await fs.mkdir(path.dirname(paths.knownMarketplacesPath), { recursive: true });
    await fs.writeFile(paths.settingsPath, JSON.stringify({ enabledPlugins: {} }, null, 2) + "\n", "utf8");
    await fs.writeFile(paths.knownMarketplacesPath, JSON.stringify({}, null, 2) + "\n", "utf8");
    await fs.mkdir(paths.installedPluginsPath, { recursive: true });

    const state = await probeClaudePluginState({ home, trackerDir });
    assert.equal(state.unreadable, true);
    assert.equal(state.detail, "Claude plugin registry unreadable");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("installClaudePlugin returns skipped when Claude CLI is missing", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-claude-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const result = await installClaudePlugin({
      home,
      trackerDir,
      notifyPath: path.join(home, ".vibeusage", "bin", "notify.cjs"),
      env: { PATH: "" },
    });

    assert.equal(result.configured, false);
    assert.equal(result.skippedReason, "claude-cli-missing");
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
