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

test("design guard leaves the vendored SPEC-01 kit alone", () => {
  const out = runGuard({ "src/ui/hardware/hardware/kit.css": "[data-kit] { padding: 9px 11px; }\n" });
  assert.equal(out.status, 0, out.stdout + out.stderr);
});
