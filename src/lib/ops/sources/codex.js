"use strict";

const { makeRolloutStrategy } = require("./_rollout-base");

module.exports = makeRolloutStrategy({
  id: "codex",
  displayName: "Codex CLI",
  envKey: "CODEX_HOME",
  defaultSubdir: ".codex",
});
