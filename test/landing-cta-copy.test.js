const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const copyPath = path.join(root, "dashboard", "src", "content", "copy.csv");
const landingPagePath = path.join(root, "dashboard", "src", "pages", "LandingPage.jsx");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasCopyKey(csv, key) {
  return csv.startsWith(`${key},`) || csv.includes(`\n${key},`);
}

test("landing CTA copy keys exist", () => {
  const csv = read(copyPath);
  for (const key of ["vu1.landing.sign_in", "vu1.landing.leaderboard", "vu1.top.sign_in"]) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("the top bar Sign in and the hero Sign in key point at the same auth entry", () => {
  const source = read(landingPagePath);
  const bar = source.match(/onSignIn=\{\(\) => window\.location\.assign\((\w+)\)\}/);
  const hero = source.match(/data-tone="primary"[^>]*href=\{(\w+)\}/);
  assert.ok(bar && hero, "TopBar onSignIn and the hero key take an auth href");
  assert.equal(bar[1], hero[1]);
});
