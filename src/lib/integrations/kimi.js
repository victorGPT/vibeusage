const {
  isKimiHookConfigured,
  upsertKimiHook,
  removeKimiHook,
  probeKimiHook,
} = require("../kimi-config");
const { isDir, isFile } = require("./utils");

// Same hook block for legacy kimi-cli (~/.kimi) and Kimi Code CLI (~/.kimi-code); both report source=kimi.
function createKimiIntegration({ name, summaryLabel, statusLabel, ctxKey }) {
  return {
    name,
    summaryLabel,
    statusLabel,
    async probe(ctx) {
      const hasConfigDir = await isDir(ctx[ctxKey].configDir);
      if (!hasConfigDir) {
        return baseProbe(this, { status: "not_installed", detail: "Config not found" });
      }
      const hasConfigFile = await isFile(ctx[ctxKey].configPath);
      if (!hasConfigFile) {
        return baseProbe(this, {
          status: "not_installed",
          detail: "config.toml not found",
        });
      }
      const state = await probeKimiHook({
        configPath: ctx[ctxKey].configPath,
        hookCommand: ctx[ctxKey].hookCommand,
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
      if (!(await isDir(ctx[ctxKey].configDir))) {
        return action(this, "skipped", false, "Config not found");
      }
      if (!(await isFile(ctx[ctxKey].configPath))) {
        return action(this, "skipped", false, "config.toml not found");
      }
      const result = await upsertKimiHook({
        configPath: ctx[ctxKey].configPath,
        hookCommand: ctx[ctxKey].hookCommand,
      });
      return action(
        this,
        result.changed ? "installed" : "set",
        Boolean(result.changed),
        result.changed ? "Hooks installed" : "Hooks already installed",
      );
    },
    async uninstall(ctx) {
      if (!(await isDir(ctx[ctxKey].configDir))) {
        return action(this, "skipped", false, "config dir not found");
      }
      const result = await removeKimiHook({ configPath: ctx[ctxKey].configPath });
      if (result.removed) {
        return action(this, "removed", true, ctx[ctxKey].configPath);
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
}

module.exports = createKimiIntegration({
  name: "kimi",
  summaryLabel: "Kimi",
  statusLabel: "Kimi hooks",
  ctxKey: "kimi",
});
module.exports.kimiCode = createKimiIntegration({
  name: "kimi-code",
  summaryLabel: "Kimi Code",
  statusLabel: "Kimi Code hooks",
  ctxKey: "kimiCode",
});

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
