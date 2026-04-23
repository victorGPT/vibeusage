const {
  isKimiHookConfigured,
  upsertKimiHook,
  removeKimiHook,
  probeKimiHook,
} = require("../kimi-config");
const { isDir, isFile } = require("./utils");

module.exports = {
  name: "kimi",
  summaryLabel: "Kimi",
  statusLabel: "Kimi hooks",
  async probe(ctx) {
    const hasConfigDir = await isDir(ctx.kimi.configDir);
    if (!hasConfigDir) {
      return baseProbe(this, { status: "not_installed", detail: "Config not found" });
    }
    const hasConfigFile = await isFile(ctx.kimi.configPath);
    if (!hasConfigFile) {
      return baseProbe(this, {
        status: "not_installed",
        detail: "config.toml not found",
      });
    }
    const state = await probeKimiHook({
      configPath: ctx.kimi.configPath,
      hookCommand: ctx.kimi.hookCommand,
    });
    if (state.configured) {
      return baseProbe(this, {
        status: "ready",
        detail: "Hooks installed",
        configured: true,
      });
    }
    return baseProbe(this, {
      status: state.drifted ? "drifted" : "not_installed",
      detail: state.drifted
        ? "Run vibeusage init to reconcile hooks"
        : "Run vibeusage init to install hooks",
    });
  },
  async install(ctx) {
    if (!(await isDir(ctx.kimi.configDir))) {
      return action(this, "skipped", false, "Config not found");
    }
    if (!(await isFile(ctx.kimi.configPath))) {
      return action(this, "skipped", false, "config.toml not found");
    }
    const result = await upsertKimiHook({
      configPath: ctx.kimi.configPath,
      hookCommand: ctx.kimi.hookCommand,
    });
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Hooks installed" : "Hooks already installed",
    );
  },
  async uninstall(ctx) {
    if (!(await isDir(ctx.kimi.configDir))) {
      return action(this, "skipped", false, "config dir not found");
    }
    const result = await removeKimiHook({ configPath: ctx.kimi.configPath });
    if (result.removed) {
      return action(this, "removed", true, ctx.kimi.configPath);
    }
    if (result.skippedReason === "hook-missing") {
      return action(this, "unchanged", false, "no change", {
        skippedReason: result.skippedReason,
      });
    }
    return action(this, "skipped", false, "config.toml not found");
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

// Expose for tests / diagnostics that want the probe-only check.
module.exports.isKimiHookConfigured = isKimiHookConfigured;
