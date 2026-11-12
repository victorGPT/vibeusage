const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const CSS_PATH = path.join(__dirname, "..", "dashboard", "src", "styles", "2049.css");

// Values from dashboard/design/2049/source/Main.dc.html, the 2049 spec board.
const COLORS = {
  background: "#03100f",
  card: "#061716",
  border: "#1f4e48",
  input: "#2c6b63",
  foreground: "#bfe9e1",
  "muted-foreground": "#6fa79e",
  hero: "#e2f8f3",
  primary: "#e0b04a",
  "primary-foreground": "#03100f",
  destructive: "#e5484d",
  ring: "#e0b04a",
  teal: "#7fd9cb",
};
const RADII = { sm: "3px", md: "8px", lg: "18px" };
const SPACING = { control: "32px", "control-lg": "48px", row: "40px" };

function themeTokens() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const theme = css.match(/@theme\s*\{([\s\S]*?)\}/);
  assert.ok(theme, "2049.css has an @theme block");
  const tokens = new Map();
  for (const m of theme[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());
  return tokens;
}

test("every 2049 color token exists with the spec value", () => {
  const tokens = themeTokens();
  for (const [name, value] of Object.entries(COLORS)) {
    assert.equal(tokens.get(`color-${name}`), value, `--color-${name}`);
  }
});

test("radii are exactly the three spec steps", () => {
  const tokens = themeTokens();
  const radii = [...tokens].filter(([k]) => k.startsWith("radius-"));
  assert.deepEqual(Object.fromEntries(radii.map(([k, v]) => [k.slice(7), v])), RADII);
});

test("every spacing token sits on the 4px grid", () => {
  const tokens = themeTokens();
  const spacing = [...tokens].filter(([k]) => k.startsWith("spacing"));
  assert.deepEqual(Object.fromEntries(spacing.map(([k, v]) => [k.slice(8), v])), SPACING);
  for (const [name, value] of spacing) {
    const px = Number(value.replace(/px$/, ""));
    assert.ok(Number.isInteger(px) && px % 4 === 0, `--${name}: ${value} is a multiple of 4px`);
  }
});

test("display and body fonts are Saira and Barlow", () => {
  const tokens = themeTokens();
  assert.match(tokens.get("font-display"), /^"Saira"/);
  assert.match(tokens.get("font-sans"), /^"Barlow"/);
  assert.match(tokens.get("font-command"), /^"JetBrains Mono"/);
});
