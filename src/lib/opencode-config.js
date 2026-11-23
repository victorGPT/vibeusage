const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");

const { ensureDir } = require("./fs");

const DEFAULT_PLUGIN_NAME = "vibeusage-tracker.js";
const PLUGIN_MARKER = "VIBEUSAGE_TRACKER_PLUGIN";
const DEFAULT_EVENT = "session.updated";
// opencode v2 has no session.updated; these end an execution (one turn), and the TUI's own usage
// view listens to session.execution.succeeded (anomalyco/opencode@4cf9db95 packages/tui/src/component/usage.tsx).
// Failed and interrupted turns spent tokens too.
const V2_EVENTS = ["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"];

function resolveOpencodeConfigDir({ home = os.homedir(), env = process.env } = {}) {
  const explicit =
    typeof env.OPENCODE_CONFIG_DIR === "string" ? env.OPENCODE_CONFIG_DIR.trim() : "";
  if (explicit) return path.resolve(explicit);
  const xdg = typeof env.XDG_CONFIG_HOME === "string" ? env.XDG_CONFIG_HOME.trim() : "";
  const base = xdg || path.join(home, ".config");
  return path.join(base, "opencode");
}

function resolveOpencodePluginDir({ configDir }) {
  return path.join(configDir, "plugin");
}

function buildOpencodePlugin({ notifyPath }) {
  const safeNotifyPath = typeof notifyPath === "string" ? notifyPath : "";
  return (
    `// ${PLUGIN_MARKER}\n` +
    `const notifyPath = ${JSON.stringify(safeNotifyPath)};\n` +
    `export const VibeUsagePlugin = async ({ $ }) => {\n` +
    `  return {\n` +
    `    event: async ({ event }) => {\n` +
    `      if (!event || event.type !== ${JSON.stringify(DEFAULT_EVENT)}) return;\n` +
    `      try {\n` +
    `        if (!notifyPath) return;\n` +
    `        const proc = $\`/usr/bin/env node ${"${notifyPath}"} --source=opencode\`;\n` +
    `        if (proc && typeof proc.catch === 'function') proc.catch(() => {});\n` +
    `      } catch (_) {}\n` +
    `    }\n` +
    `  };\n` +
    `};\n`
  );
}

// opencode v2 (anomalyco/opencode@4cf9db95 packages/core/src/plugin/module.ts) only loads
// `export default { id, setup }`; v1 rejects a default object without server(), so each gets its own shape.
function buildOpencodePluginV2({ notifyPath }) {
  const safeNotifyPath = typeof notifyPath === "string" ? notifyPath : "";
  return (
    `// ${PLUGIN_MARKER}\n` +
    `import { spawn } from "node:child_process";\n` +
    `const notifyPath = ${JSON.stringify(safeNotifyPath)};\n` +
    `export default {\n` +
    `  id: "vibeusage-tracker",\n` +
    `  setup: (ctx) => {\n` +
    `    const controller = new AbortController();\n` +
    `    (async () => {\n` +
    `      for await (const _ of ctx.event.subscribe({ types: ${JSON.stringify(V2_EVENTS)}, signal: controller.signal })) {\n` +
    `        if (!notifyPath) continue;\n` +
    `        try {\n` +
    `          const proc = spawn("/usr/bin/env", ["node", notifyPath, "--source=opencode"], { stdio: "ignore", detached: true });\n` +
    `          proc.on("error", () => {});\n` +
    `          proc.unref();\n` +
    `        } catch (_) {}\n` +
    `      }\n` +
    `    })().catch(() => {});\n` +
    `    return () => controller.abort();\n` +
    `  },\n` +
    `};\n`
  );
}

// "opencode v2.4.0" (v2) or "1.18.31" (v1); null when opencode is not on PATH.
function readOpencodeVersion() {
  try {
    return execFileSync("opencode", ["--version"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (_) {
    return null;
  }
}

function opencodeMajor(versionText) {
  const m = /(\d+)\.\d+\.\d+/.exec(String(versionText || ""));
  return m ? Number(m[1]) : null;
}

async function upsertOpencodePlugin({
  configDir,
  notifyPath,
  pluginName = DEFAULT_PLUGIN_NAME,
  readVersion = readOpencodeVersion,
}) {
  if (!configDir) return { changed: false, pluginPath: null, skippedReason: "config-missing" };
  const pluginDir = resolveOpencodePluginDir({ configDir });
  const pluginPath = path.join(pluginDir, pluginName);
  // ponytail: version read at init only; a v1->v2 upgrade needs `vibeusage init` again.
  const build = opencodeMajor(readVersion()) >= 2 ? buildOpencodePluginV2 : buildOpencodePlugin;
  const next = build({ notifyPath });
  const existing = await fs.readFile(pluginPath, "utf8").catch(() => null);

  if (existing === next) {
    return { changed: false, pluginPath, skippedReason: null };
  }

  await ensureDir(pluginDir);

  let backupPath = null;
  if (existing != null) {
    backupPath = `${pluginPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await fs.copyFile(pluginPath, backupPath).catch(() => {});
  }

  await fs.writeFile(pluginPath, next, "utf8");
  return { changed: true, pluginPath, backupPath, skippedReason: null };
}

async function removeOpencodePlugin({ configDir, pluginName = DEFAULT_PLUGIN_NAME }) {
  if (!configDir) return { removed: false, skippedReason: "config-missing" };
  const pluginPath = path.join(resolveOpencodePluginDir({ configDir }), pluginName);
  const existing = await fs.readFile(pluginPath, "utf8").catch(() => null);
  if (existing == null) return { removed: false, skippedReason: "plugin-missing" };
  if (!hasPluginMarker(existing)) return { removed: false, skippedReason: "unexpected-content" };
  await fs.unlink(pluginPath).catch(() => {});
  return { removed: true, skippedReason: null };
}

async function isOpencodePluginInstalled({ configDir, pluginName = DEFAULT_PLUGIN_NAME }) {
  if (!configDir) return false;
  const pluginPath = path.join(resolveOpencodePluginDir({ configDir }), pluginName);
  const existing = await fs.readFile(pluginPath, "utf8").catch(() => null);
  if (!existing) return false;
  return hasPluginMarker(existing);
}

function hasPluginMarker(text) {
  return typeof text === "string" && text.includes(PLUGIN_MARKER);
}

module.exports = {
  DEFAULT_EVENT,
  V2_EVENTS,
  DEFAULT_PLUGIN_NAME,
  PLUGIN_MARKER,
  resolveOpencodeConfigDir,
  resolveOpencodePluginDir,
  buildOpencodePlugin,
  buildOpencodePluginV2,
  upsertOpencodePlugin,
  removeOpencodePlugin,
  isOpencodePluginInstalled,
};
