"use strict";

/**
 * audit-claude.js
 *
 * Thin backward-compatible shim over audit-source.js. Retained so existing
 * consumers (`scripts/ops/compare-claude-ground-truth.cjs`, older doctor
 * imports) keep working. New code should import audit-source directly and
 * pass the claude strategy.
 */

const {
  DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT,
  runSourceAudit,
} = require("./audit-source");
const claudeStrategy = require("./sources/claude");

function runAudit(opts = {}) {
  const { projectsDir, ...rest } = opts;
  return runSourceAudit({
    ...rest,
    strategy: claudeStrategy,
    // Preserve the legacy `projectsDir` option so existing callers and tests
    // (test/doctor-audit-tokens.test.js) keep working without knowing about
    // the new sessionRootOverride plumbing.
    sessionRootOverride: projectsDir || rest.sessionRootOverride || null,
  });
}

module.exports = {
  DEFAULT_DAYS,
  DEFAULT_THRESHOLD_PCT,
  runAudit,
};
