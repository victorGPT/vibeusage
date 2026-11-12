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
  for (const key of ["ui2049.state_screen.sign_in", "ui2049.landing.cta_title", "ui2049.landing.cta_meta"]) {
    assert.ok(hasCopyKey(csv, key), `expected copy registry to include ${key}`);
  }
});

test("both Sign in with GitHub buttons point at the same auth entry", () => {
  const source = read(landingPagePath);
  const hero = source.match(/<LandingHero[^>]*signInHref=\{(\w+)\}/);
  const cta = source.match(/<CtaBand[^>]*href=\{(\w+)\}/);
  assert.ok(hero && cta, "LandingHero and CtaBand take an auth href");
  assert.equal(hero[1], cta[1]);
});
