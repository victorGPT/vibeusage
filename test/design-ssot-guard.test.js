const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const GUARD = path.join(__dirname, "..", "dashboard", "scripts", "check-design-ssot.mjs");

function runGuard(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ssot-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return spawnSync(process.execPath, [GUARD, root], { encoding: "utf8" });
}

test("design guard passes spacing taken from the s1..s8 scale", () => {
  const out = runGuard({
    "src/ui/vu1/Ok.tsx": 'export const Ok = () => <div className="grid-page gap-s4 p-s2 mt-s8 m-0 -mt-s1" style={{ gap: "var(--spacing-s3)" }} />;\n',
    "src/ui/vu1/ok.css": "[data-vu1] { padding: var(--spacing-s2) 0; margin: 0 auto; gap: calc(var(--spacing-s4) * 2); }\n",
    "src/ui/vu1/alias.css": "[data-vu1] { padding: var(--spacing-inset); gap: var(--spacing-stack); margin-top: var(--spacing-section); }\n",
  });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test("design guard blocks off-scale spacing in classes, inline styles and CSS", () => {
  const out = runGuard({
    "src/pages/Bad.jsx": [
      'export const A = () => <div className="gap-5" />;',
      'export const B = () => <div className="p-[13px]" />;',
      "export const C = () => <div style={{ gap: 6 }} />;",
      'export const D = () => <div className="space-y-2" />;',
    ].join("\n"),
    "src/ui/vu1/bad.css": "[data-vu1] { padding: 13px; }\n",
  });
  assert.equal(out.status, 1);
  for (const hit of ["Bad.jsx:1", "Bad.jsx:2", "Bad.jsx:3", "Bad.jsx:4", "bad.css:1"]) {
    assert.match(out.stderr, new RegExp(hit.replace(".", "\\.")), `expected ${hit} flagged`);
  }
});

test("design guard blocks fractions of zero and multi-line inline styles", () => {
  const out = runGuard({
    "src/pages/Frac.jsx": [
      "export const A = () => <div style={{ gap: 0.5 }} />;",
      'export const B = () => <div className="p-0.5" />;',
      "export const C = () => (",
      "  <div",
      "    style={{",
      '      color: "red",',
      "      marginTop: 6,",
      "    }}",
      "  />",
      ");",
      "export const D = () => <div style={{ padding: 0 }} />;",
    ].join("\n"),
    "src/ui/vu1/frac.css": "[data-vu1] { margin: 0.5px; }\n",
  });
  assert.equal(out.status, 1);
  for (const hit of ["Frac.jsx:1", "Frac.jsx:2", "Frac.jsx:7", "frac.css:1"]) {
    assert.match(out.stderr, new RegExp(hit.replace(".", "\\.")), `expected ${hit} flagged`);
  }
  assert.doesNotMatch(out.stderr, /Frac\.jsx:11/, "padding: 0 is on the scale");
});

test("design guard leaves the kit's own spacing alone", () => {
  const out = runGuard({ "src/ui/hardware/hardware/kit.css": "[data-kit] { padding: 9px 11px; }\n" });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test("design guard blocks literal colors in CSS, the kit included", () => {
  const out = runGuard({
    "src/ui/vu1/c.css": [
      "[data-vu1] { color: #fff; }",
      "[data-vu1] { background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), transparent); }",
      "[data-vu1] { border-color: white; }",
      "[data-vu1] {",
      "  box-shadow:",
      "    0 1px 0 rgb(255 255 255 / 0.9);",
      "}",
      "[data-vu1] { --lit: oklch(0.72 0.19 150); }",
      "[data-vu1] { box-shadow: 0 0 0 1px rgb(0 0 0 / calc(0.5 * var(--k))); }",
    ].join("\n"),
    "src/ui/hardware/hardware/kit.css": "[data-kit] { fill: #1d1d1c; }\n",
  });
  assert.equal(out.status, 1);
  for (const hit of ["c.css:1", "c.css:2", "c.css:3", "c.css:6", "c.css:8", "c.css:9", "kit.css:1"]) {
    assert.match(out.stderr, new RegExp(hit.replace(".", "\\.") + " "), `expected ${hit} flagged`);
  }
});

test("design guard passes colors taken from tokens", () => {
  const out = runGuard({
    "src/ui/vu1/ok.css": [
      "/* a #fff highlight on white keys */",
      "[data-vu1]:not(#_) { color: var(--color-ink); background: transparent; border-color: currentColor; }",
      "[data-vu1] { --key-ink: oklch(from var(--theme) calc(l - 0.1) c h); }",
      "[data-vu1] { box-shadow: 0 0 0 1px hsl(var(--shadow-color) / 0.1); }",
      "[data-vu1] { --edge: color-mix(in oklab, var(--key-color) 70%, var(--palette-black)); }",
      "@media (max-width: 760px) { [data-vu1] { color: var(--color-legend); } }",
      "@supports (corner-shape: squircle) { [data-vu1] { corner-shape: squircle; } }",
    ].join("\n"),
    "src/styles/tokens.css": ":root { --palette-white: #fff; --radius-14: calc(14px * var(--corner-scale)); }\n",
  });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test("design guard blocks literal radii, the kit included", () => {
  const out = runGuard({
    "src/ui/vu1/r.css": [
      "[data-vu1] { border-radius: 6px; }",
      "[data-vu1] { border-top-left-radius: calc(4px * var(--corner-scale)); }",
      "[data-vu1] { --key-radius: 10px; }",
      "[data-vu1] { border-radius: calc(var(--radius-14) - 11px); }",
      "[data-vu1] { border-radius: var(--radius-75) / 25%; }",
    ].join("\n"),
    "src/ui/hardware/hardware/kit.css": "[data-kit] { border-radius: 0 3px 3px 0; }\n",
    "src/ui/vu1/Bad.tsx": 'export const B = () => <div className="rounded-[6px]" style={{ borderRadius: 4 }} />;\n',
  });
  assert.equal(out.status, 1);
  for (const hit of ["r.css:1", "r.css:2", "r.css:3", "r.css:4", "r.css:5", "kit.css:1", "Bad.tsx:1"]) {
    assert.match(out.stderr, new RegExp(hit.replace(".", "\\.") + " "), `expected ${hit} flagged`);
  }
});

test("design guard passes radii taken from tokens, 0 and 50%", () => {
  const out = runGuard({
    "src/ui/vu1/ok.css": [
      "[data-vu1] { border-radius: 50%; }",
      "[data-vu1] { border-radius: 0 var(--radius-4) var(--radius-4) 0 !important; }",
      "[data-vu1] { border-radius: calc(var(--radius-14) - var(--bezel-inset)); }",
      "[data-vu1] { border-radius: calc(var(--h) / 2) calc(var(--h) * 0.3); }",
      "[data-vu1] { border-radius: inherit; }",
    ].join("\n"),
  });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});
