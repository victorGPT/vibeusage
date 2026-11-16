const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const CSS_PATH = path.join(__dirname, "..", "dashboard", "src", "styles", "vu1.css");

// :root of the VU1 UI mock (.nawaban/vu1-mock.html, 11-17 grid revision): --s1..--s8, --gutter, --shell.
const SCALE = { s1: "4px", s2: "8px", s3: "12px", s4: "16px", s5: "24px", s6: "32px", s7: "48px", s8: "64px" };

function read() {
  return fs.readFileSync(CSS_PATH, "utf8");
}

function themeTokens() {
  const theme = read().match(/@theme static\s*\{([\s\S]*?)\}/);
  assert.ok(theme, "vu1.css has an @theme static block");
  const tokens = new Map();
  for (const m of theme[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());
  return tokens;
}

test("the spacing scale is exactly the mock's --s1..--s8", () => {
  const tokens = themeTokens();
  const scale = [...tokens].filter(([k]) => /^spacing-s\d$/.test(k));
  assert.deepEqual(Object.fromEntries(scale.map(([k, v]) => [k.slice(8), v])), SCALE);
});

test("gutters and shell match the mock grid", () => {
  const tokens = themeTokens();
  assert.equal(tokens.get("spacing-gutter"), "var(--spacing-s5)");
  assert.equal(tokens.get("spacing-gutter-device"), "var(--spacing-s4)");
  assert.equal(tokens.get("container-shell"), "1200px");
});

test("the page gutter narrows to --s4 at 760px, as in the mock", () => {
  assert.match(read(), /@media \(max-width: 760px\)\s*\{\s*:root\s*\{\s*--spacing-gutter: var\(--spacing-s4\);/);
});

test("page and device grids are 12 columns on their gutters", () => {
  const css = read();
  for (const [name, gutter] of [["grid-page", "gutter"], ["grid-device", "gutter-device"]]) {
    const block = css.match(new RegExp(`@utility ${name}\\s*\\{([^}]*)\\}`));
    assert.ok(block, `@utility ${name}`);
    assert.match(block[1], /grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/);
    assert.match(block[1], new RegExp(`column-gap: var\\(--spacing-${gutter}\\);`));
  }
});
