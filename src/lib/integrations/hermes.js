const { isDir } = require("./utils");
const { probeHermesPlugin, installHermesPlugin, removeHermesPlugin } = require("../hermes-config");

module.exports = {
  name: "hermes",
  summaryLabel: "Hermes Plugin",
  statusLabel: "Hermes plugin",
  async probe(ctx) {
    const hermesHomeExists = await isDir(ctx.hermes.hermesHome);
    if (!hermesHomeExists) {
      return baseProbe(this, {
        status: "not_installed",
        detail: "Hermes home not found",
        initPreviewStatus: "skipped",
        initPreviewDetail: "Hermes not detected",
      });
    }

    const state = await probeHermesPlugin({
      home: ctx.home,
      env: ctx.env,
      trackerDir: ctx.trackerPaths.trackerDir,
    });
    return baseProbe(this, state);
  },
  async install(ctx) {
    if (!(await isDir(ctx.hermes.hermesHome))) {
      return action(this, "skipped", false, "Hermes home not found");
    }
    const result = await installHermesPlugin({
      home: ctx.home,
      env: ctx.env,
      trackerDir: ctx.trackerPaths.trackerDir,
    });
    return action(
      this,
      result.changed ? "installed" : "set",
      Boolean(result.changed),
      result.changed ? "Plugin installed" : "Plugin already installed",
    );
  },
  async uninstall(ctx) {
    if (!(await isDir(ctx.hermes.hermesHome))) {
      return action(this, "skipped", false, "Hermes home not found", {
        skippedReason: "hermes-home-missing",
      });
    }
    const result = await removeHermesPlugin({
      home: ctx.home,
      env: ctx.env,
      trackerDir: ctx.trackerPaths.trackerDir,
    });
    if (result.removed) {
      return action(this, "removed", true, result.pluginDir || ctx.hermes.pluginDir);
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
    return action(this, "skipped", false, "Hermes home not found", {
      skippedReason: result.skippedReason || "hermes-home-missing",
    });
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
