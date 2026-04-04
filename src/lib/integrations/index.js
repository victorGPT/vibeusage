const { createIntegrationContext } = require("./context");
const codex = require("./codex");
const everyCode = require("./every-code");
const claude = require("./claude");
const gemini = require("./gemini");
const opencode = require("./opencode");
const openclawSession = require("./openclaw-session");

const INTEGRATIONS = [
  codex,
  everyCode,
  claude,
  gemini,
  opencode,
  openclawSession,
];

function listIntegrations() {
  return INTEGRATIONS.slice();
}

async function probeIntegrations(context) {
  const ctx = await ensureContext(context);
  const results = [];
  for (const integration of INTEGRATIONS) {
    results.push(await integration.probe(ctx));
  }
  return results;
}

async function installIntegrations(context) {
  const ctx = await ensureContext(context);
  const results = [];
  for (const integration of INTEGRATIONS) {
    results.push(await integration.install(ctx));
  }
  return results;
}

async function uninstallIntegrations(context) {
  const ctx = await ensureContext(context);
  const results = [];
  for (const integration of INTEGRATIONS) {
    results.push(await integration.uninstall(ctx));
  }
  return results;
}

function summarizeProbeForInitPreview(probe) {
  switch (probe.status) {
    case "ready":
      return { label: probe.summaryLabel, status: "set", detail: "Already configured" };
    case "not_installed":
      if (probe.initPreviewStatus) {
        return {
          label: probe.summaryLabel,
          status: probe.initPreviewStatus,
          detail: probe.initPreviewDetail || probe.detail,
        };
      }
      return { label: probe.summaryLabel, status: "skipped", detail: probe.detail };
    case "unsupported_legacy":
      return { label: probe.summaryLabel, status: "updated", detail: "Will replace legacy config" };
    case "unreadable":
      return { label: probe.summaryLabel, status: "skipped", detail: probe.detail || "Config unreadable" };
    default:
      return { label: probe.summaryLabel, status: "updated", detail: "Will reconcile config" };
  }
}

async function ensureContext(context) {
  if (context?.trackerPaths && context?.notifyPath) return context;
  return createIntegrationContext(context);
}

module.exports = {
  listIntegrations,
  createIntegrationContext,
  probeIntegrations,
  installIntegrations,
  uninstallIntegrations,
  summarizeProbeForInitPreview,
};
