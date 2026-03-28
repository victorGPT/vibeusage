"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadEdgeFunction(slug, options = {}) {
  const reload = options?.reload === true;
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "insforge-src",
    "functions-esm",
    `${slug}.js`,
  );
  const href = pathToFileURL(sourcePath).href + (reload ? `?t=${Date.now()}` : "");
  const mod = await import(href);
  return mod.default;
}

module.exports = {
  loadEdgeFunction,
};
