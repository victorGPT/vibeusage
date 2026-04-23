const { isOpencodePluginInstalled, upsertOpencodePlugin, removeOpencodePlugin } = require("../opencode-config");
const { isDir } = require("./utils");

module.exports = {
  name: "opencode",
  summaryLabel: "OpenCode Plugin",
  statusLabel: "OpenCode plugin",
  async probe(ctx) {
    const hasConfigDir = await isDir(ctx.opencode.configDir);
    if (!hasConfigDir) {
      return baseProbe(this, {
        status: "not_installed",
        detail: "Config not found",
        initPreviewStatus: "updated",
        initPreviewDetail: "Will install plugin",
      });
    }
    const configured = await isOpencodePluginInstalled({ configDir: ctx.opencode.configDir });
    return baseProbe(this, {
      status: configured ? "ready" : "drifted",
      detail: configured ? "Plugin installed" : "Run vibeusage init to reconcile plugin",
      configured,
    });
  },
  async install(ctx) {
    const result = await upsertOpencodePlugin({
      configDir: ctx.opencode.configDir,
      notifyPath: ctx.notifyPath,
    });
    if (result?.skippedReason === "config-missing") {
      return action(this, "skipped", false, "Config not found");
    }
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Plugin installed" : "Plugin already installed",
    );
  },
  async uninstall(ctx) {
    if (!(await isDir(ctx.opencode.configDir))) {
      return action(this, "skipped", false, "config dir not found");
    }
    const result = await removeOpencodePlugin({ configDir: ctx.opencode.configDir });
    if (result.removed) {
      return action(this, "removed", true, ctx.opencode.configDir);
    }
    if (result.skippedReason === "plugin-missing") {
      return action(this, "unchanged", false, "no change", {
        skippedReason: result.skippedReason,
      });
    }
    if (result.skippedReason === "unexpected-content") {
      return action(this, "skipped", false, "unexpected content", {
        skippedReason: result.skippedReason,
      });
    }
    return action(this, "skipped", false, "config dir not found");
  },
  renderStatusValue(probe) {
    if (probe.status === "ready") return "set";
    if (probe.status === "not_installed") return "unset";
    return probe.status;
  },
};

function baseProbe(descriptor, values) {
  return {
    name: descriptor.name,
    summaryLabel: descriptor.summaryLabel,
    statusLabel: descriptor.statusLabel,
    configured: false,
    ...values,
  };
}

function action(descriptor, status, changed, detail, extras = {}) {
  return {
    name: descriptor.name,
    label: descriptor.summaryLabel,
    status,
    changed,
    detail,
    ...extras,
  };
}
