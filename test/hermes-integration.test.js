const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { test } = require("node:test");

const { cmdInit } = require("../src/commands/init");
const { cmdUninstall } = require("../src/commands/uninstall");
const {
  HERMES_PLUGIN_MARKER,
  resolveHermesPluginPaths,
  installHermesPlugin,
  probeHermesPlugin,
  removeHermesPlugin,
} = require("../src/lib/hermes-config");

test("installHermesPlugin writes managed plugin files and probe returns ready", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-hermes-plugin-"));
  const home = path.join(tmp, "home");
  const trackerDir = path.join(home, ".vibeusage", "tracker");
  await fs.mkdir(path.join(home, ".hermes"), { recursive: true });
  await fs.mkdir(trackerDir, { recursive: true });

  try {
    const installed = await installHermesPlugin({ home, env: {}, trackerDir });
    assert.equal(installed.configured, true);
    assert.equal(installed.changed, true);

    const paths = resolveHermesPluginPaths({ home, env: {}, trackerDir });
    const pluginYaml = await fs.readFile(paths.pluginYamlPath, "utf8");
    const pluginInit = await fs.readFile(paths.pluginInitPath, "utf8");
    assert.match(pluginYaml, new RegExp(HERMES_PLUGIN_MARKER));
    assert.match(pluginInit, new RegExp(HERMES_PLUGIN_MARKER));
    assert.match(pluginInit, /post_api_request/);
    assert.match(pluginInit, /on_session_start/);
    assert.match(pluginInit, /hermes\.usage\.jsonl/);

    const probed = await probeHermesPlugin({ home, env: {}, trackerDir });
    assert.equal(probed.status, "ready");
    assert.equal(probed.configured, true);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("removeHermesPlugin refuses unexpected content and cmdInit/cmdUninstall manage Hermes plugin lifecycle", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-hermes-init-"));
  const prevHome = process.env.HOME;
  const prevCodexHome = process.env.CODEX_HOME;
  const prevToken = process.env.VIBEUSAGE_DEVICE_TOKEN;
  const prevHermesHome = process.env.HERMES_HOME;
  const prevWrite = process.stdout.write;

  try {
    const home = path.join(tmp, "home");
    process.env.HOME = home;
    process.env.HERMES_HOME = path.join(home, ".hermes");
    process.env.CODEX_HOME = path.join(home, ".codex");
    delete process.env.VIBEUSAGE_DEVICE_TOKEN;
    await fs.mkdir(path.join(home, ".hermes", "plugins", "vibeusage"), { recursive: true });
    await fs.mkdir(process.env.CODEX_HOME, { recursive: true });

    const trackerDir = path.join(home, ".vibeusage", "tracker");
    const paths = resolveHermesPluginPaths({ home, env: process.env, trackerDir });
    await fs.writeFile(paths.pluginYamlPath, "name: vibeusage\n", "utf8");
    await fs.writeFile(paths.pluginInitPath, "# custom content\n", "utf8");

    const refused = await removeHermesPlugin({ home, env: process.env, trackerDir });
    assert.equal(refused.removed, false);
    assert.equal(refused.skippedReason, "unexpected-content");

    process.stdout.write = () => true;
    await cmdInit(["--yes", "--no-auth", "--no-open", "--base-url", "https://example.invalid"]);

    const pluginYaml = await fs.readFile(paths.pluginYamlPath, "utf8");
    const pluginInit = await fs.readFile(paths.pluginInitPath, "utf8");
    assert.match(pluginYaml, new RegExp(HERMES_PLUGIN_MARKER));
    assert.match(pluginInit, new RegExp(HERMES_PLUGIN_MARKER));

    await cmdUninstall([]);
    await assert.rejects(fs.stat(paths.pluginDir), /ENOENT/);
  } finally {
    process.stdout.write = prevWrite;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevCodexHome;
    if (prevToken === undefined) delete process.env.VIBEUSAGE_DEVICE_TOKEN;
    else process.env.VIBEUSAGE_DEVICE_TOKEN = prevToken;
    if (prevHermesHome === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = prevHermesHome;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
