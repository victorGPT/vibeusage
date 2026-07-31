"use strict";

const FUNCTION_PREFIX = "/functions";
const BACKEND_RUNTIME_UNAVAILABLE_MESSAGE =
  "Backend runtime unavailable (InsForge). Please retry later.";

const FUNCTION_SLUGS = Object.freeze({
  deviceTokenIssue: "vibeusage-device-token-issue",
  ingest: "vibeusage-ingest",
  syncPing: "vibeusage-sync-ping",
  usageSummary: "vibeusage-usage-summary",
  usageDaily: "vibeusage-usage-daily",
  usageHourly: "vibeusage-usage-hourly",
  usageMonthly: "vibeusage-usage-monthly",
  usageHeatmap: "vibeusage-usage-heatmap",
  usageModelBreakdown: "vibeusage-usage-model-breakdown",
  projectUsageSummary: "vibeusage-project-usage-summary",
  leaderboard: "vibeusage-leaderboard",
  leaderboardProfile: "vibeusage-leaderboard-profile",
  userStatus: "vibeusage-user-status",
  viewerIdentity: "vibeusage-viewer-identity",
  linkCodeInit: "vibeusage-link-code-init",
  linkCodeExchange: "vibeusage-link-code-exchange",
  publicViewProfile: "vibeusage-public-view-profile",
  publicVisibility: "vibeusage-public-visibility",
});

module.exports = {
  FUNCTION_PREFIX,
  BACKEND_RUNTIME_UNAVAILABLE_MESSAGE,
  FUNCTION_SLUGS,
};
