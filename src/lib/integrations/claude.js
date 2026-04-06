const { probeClaudeHook, removeClaudeHook } = require("../claude-config");
const {
  installClaudePlugin,
  probeClaudePluginState,
  removeClaudePluginConfig,
} = require("../claude-plugin");
const { isDir, isFile } = require("./utils");

module.exports = {
  name: "claude",
  summaryLabel: "Claude",
  statusLabel: "Claude plugin",
  async probe(ctx) {
    const hasConfigDir = await isDir(ctx.claude.configDir);
    if (!hasConfigDir) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }

    const pluginState = await probeClaudePluginState({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
    });
    if (pluginState.unreadable) {
      return baseProbe(this, { status: "unreadable", detail: pluginState.detail });
    }
    if (pluginState.configured) {
      return baseProbe(this, {
        status: "ready",
        detail: "Plugin installed",
        configured: true,
        pluginState,
      });
    }

    const hasSettings = await isFile(ctx.claude.settingsPath);
    if (!hasSettings) {
      return baseProbe(this, {
        status: pluginState.pluginFilesReady || pluginState.marketplaceDeclared ? "drifted" : "not_installed",
        detail:
          pluginState.pluginFilesReady || pluginState.marketplaceDeclared
            ? "Run vibeusage init to reconcile plugin"
            : "Run vibeusage init to install plugin",
        pluginState,
      });
    }

    const hookState = await probeClaudeHook({
      settingsPath: ctx.claude.settingsPath,
      hookCommand: ctx.claude.hookCommand,
    });
    const status = hookState.anyPresent
      ? "unsupported_legacy"
      : pluginState.installed || pluginState.marketplaceDeclared || pluginState.pluginFilesReady
        ? "drifted"
        : "not_installed";
    return baseProbe(this, {
      status,
      detail:
        status === "unsupported_legacy"
          ? "Legacy hook config detected; run vibeusage init"
          : status === "drifted"
            ? "Run vibeusage init to reconcile plugin"
            : "Run vibeusage init to install plugin",
      hookState,
      pluginState,
    });
  },
  async install(ctx) {
    if (!(await isDir(ctx.claude.configDir))) {
      return action(this, "skipped", false, "Config not found");
    }
    const result = await installClaudePlugin({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      notifyPath: ctx.notifyPath,
      env: ctx.env,
    });
    if (result.skippedReason === "claude-cli-missing") {
      return action(this, "skipped", false, "Claude CLI not found", {
        skippedReason: result.skippedReason,
      });
    }
    if (!result.configured) {
      return action(this, "skipped", false, result.error || "Claude plugin install incomplete", {
        skippedReason: result.skippedReason || "claude-plugin-install-incomplete",
      });
    }
    if (result.configured && (await isFile(ctx.claude.settingsPath))) {
      await removeClaudeHook({
        settingsPath: ctx.claude.settingsPath,
        hookCommand: ctx.claude.hookCommand,
      }).catch(() => {});
    }
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Plugin installed" : "Plugin already installed",
    );
  },
  async uninstall(ctx) {
    const result = await removeClaudePluginConfig({
      home: ctx.home,
      trackerDir: ctx.trackerPaths.trackerDir,
      env: ctx.env,
    });
    if (await isFile(ctx.claude.settingsPath)) {
      await removeClaudeHook({
        settingsPath: ctx.claude.settingsPath,
        hookCommand: ctx.claude.hookCommand,
      }).catch(() => {});
    }
    if (result.skippedReason === "claude-cli-missing") {
      return action(this, "skipped", false, "Claude CLI not found", {
        skippedReason: result.skippedReason,
      });
    }
    if (result.removed) {
      return action(this, "removed", true, result.pluginRef || "Claude plugin removed");
    }
    if (result.skippedReason === "plugin-missing") {
      return action(this, "unchanged", false, "no change", {
        skippedReason: result.skippedReason,
      });
    }
    return action(this, "skipped", false, "Claude plugin not found");
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
