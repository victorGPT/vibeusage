const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");

const { ensureDir, writeFileAtomic } = require("./fs");

const HERMES_PLUGIN_ID = "vibeusage";
const HERMES_PLUGIN_MARKER = "VIBEUSAGE_HERMES_PLUGIN";
const HERMES_PLUGIN_TEMPLATE_VERSION = 1;

function resolveHermesHome({ home = os.homedir(), env = process.env } = {}) {
  const explicit = typeof env.HERMES_HOME === "string" ? env.HERMES_HOME.trim() : "";
  if (explicit) return path.resolve(explicit);
  return path.join(home, ".hermes");
}

function resolveHermesPluginPaths({ home = os.homedir(), env = process.env, trackerDir } = {}) {
  if (!trackerDir) throw new Error("trackerDir is required");

  const hermesHome = resolveHermesHome({ home, env });
  const pluginDir = path.join(hermesHome, "plugins", HERMES_PLUGIN_ID);
  return {
    hermesHome,
    pluginId: HERMES_PLUGIN_ID,
    pluginDir,
    pluginYamlPath: path.join(pluginDir, "plugin.yaml"),
    pluginInitPath: path.join(pluginDir, "__init__.py"),
    ledgerPath: path.join(trackerDir, "hermes.usage.jsonl"),
  };
}

async function probeHermesPlugin({ home = os.homedir(), env = process.env, trackerDir } = {}) {
  const paths = resolveHermesPluginPaths({ home, env, trackerDir });
  const expectedYaml = buildHermesPluginYaml();
  const expectedInit = buildHermesPluginInit({ ledgerPath: paths.ledgerPath });
  const hermesHomeExists = await pathExists(paths.hermesHome);

  if (!hermesHomeExists) {
    return {
      configured: false,
      status: "not_installed",
      detail: "Hermes home not found",
      initPreviewStatus: "updated",
      initPreviewDetail: "Will install plugin",
      ...paths,
    };
  }

  const pluginDirExists = await pathExists(paths.pluginDir);
  if (!pluginDirExists) {
    return {
      configured: false,
      status: "not_installed",
      detail: "Plugin not installed",
      initPreviewStatus: "updated",
      initPreviewDetail: "Will install plugin",
      ...paths,
    };
  }

  const yamlState = await readTextStrict(paths.pluginYamlPath);
  const initState = await readTextStrict(paths.pluginInitPath);
  if (yamlState.status === "error" || initState.status === "error") {
    return {
      configured: false,
      status: "unreadable",
      detail: yamlState.error || initState.error || "Plugin unreadable",
      ...paths,
    };
  }
  if (yamlState.status === "missing" || initState.status === "missing") {
    return {
      configured: false,
      status: "drifted",
      detail: "Run vibeusage init to reconcile plugin",
      ...paths,
    };
  }

  const configured = yamlState.value === expectedYaml && initState.value === expectedInit;
  return {
    configured,
    status: configured ? "ready" : "drifted",
    detail: configured ? "Plugin installed" : "Run vibeusage init to reconcile plugin",
    ...paths,
  };
}

async function installHermesPlugin({ home = os.homedir(), env = process.env, trackerDir } = {}) {
  const paths = resolveHermesPluginPaths({ home, env, trackerDir });
  const nextYaml = buildHermesPluginYaml();
  const nextInit = buildHermesPluginInit({ ledgerPath: paths.ledgerPath });
  const currentYaml = await fs.readFile(paths.pluginYamlPath, "utf8").catch(() => null);
  const currentInit = await fs.readFile(paths.pluginInitPath, "utf8").catch(() => null);
  const changed = currentYaml !== nextYaml || currentInit !== nextInit;

  await ensureDir(paths.pluginDir);
  await writeFileAtomic(paths.pluginYamlPath, nextYaml);
  await writeFileAtomic(paths.pluginInitPath, nextInit);
  return { configured: true, changed, ...paths };
}

async function removeHermesPlugin({ home = os.homedir(), env = process.env, trackerDir } = {}) {
  const paths = resolveHermesPluginPaths({ home, env, trackerDir });
  const hadPluginDir = await pathExists(paths.pluginDir);
  if (!hadPluginDir) {
    return { removed: false, skippedReason: "plugin-missing", ...paths };
  }

  const yamlText = await fs.readFile(paths.pluginYamlPath, "utf8").catch(() => null);
  const initText = await fs.readFile(paths.pluginInitPath, "utf8").catch(() => null);
  const markerPresent = hasHermesPluginMarker(yamlText) && hasHermesPluginMarker(initText);
  if (!markerPresent) {
    return { removed: false, skippedReason: "unexpected-content", ...paths };
  }

  await fs.rm(paths.pluginDir, { recursive: true, force: true }).catch(() => {});
  return { removed: true, ...paths };
}

function buildHermesPluginYaml() {
  return readTemplateFile("plugin.yaml");
}

function buildHermesPluginInit({ ledgerPath }) {
  const safeLedgerPath = typeof ledgerPath === "string" ? ledgerPath : "";
  return readTemplateFile("__init__.py").replace("__LEDGER_PATH__", safeLedgerPath);
}

function hasHermesPluginMarker(text) {
  return typeof text === "string" && text.includes(HERMES_PLUGIN_MARKER);
}

async function readTextStrict(filePath) {
  try {
    return { status: "ok", value: await fs.readFile(filePath, "utf8"), error: null };
  } catch (err) {
    if (err?.code === "ENOENT" || err?.code === "ENOTDIR") {
      return { status: "missing", value: null, error: null };
    }
    return { status: "error", value: null, error: err?.message || String(err) };
  }
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (_err) {
    return false;
  }
}

function readTemplateFile(name) {
  const templatePath = path.join(__dirname, "..", "templates", "hermes-vibeusage-plugin", name);
  return fssync.readFileSync(templatePath, "utf8");
}

module.exports = {
  HERMES_PLUGIN_ID,
  HERMES_PLUGIN_MARKER,
  HERMES_PLUGIN_TEMPLATE_VERSION,
  resolveHermesHome,
  resolveHermesPluginPaths,
  probeHermesPlugin,
  installHermesPlugin,
  removeHermesPlugin,
  buildHermesPluginYaml,
  buildHermesPluginInit,
  hasHermesPluginMarker,
};
