"use strict";

const { makeRolloutStrategy } = require("./_rollout-base");

module.exports = makeRolloutStrategy({
  id: "every-code",
  displayName: "Every Code",
  envKey: "CODE_HOME",
  defaultSubdir: ".code",
});
