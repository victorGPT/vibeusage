const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");

const DASHBOARD = path.join(__dirname, "..", "dashboard");

// A stale server answering 200 on the gate's port must fail the gate, not be audited in its place.
test("audit:ui exits 1 when its port is already served by another process", async () => {
  const stale = http.createServer((_req, res) => res.end("<!doctype html><title>stale preview</title>"));
  await new Promise((resolve) => stale.listen(0, "127.0.0.1", resolve));
  const { port } = stale.address();
  try {
    const gate = spawn(process.execPath, ["scripts/audit-ui.mjs"], {
      cwd: DASHBOARD,
      env: { ...process.env, AUDIT_UI_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    gate.stdout.on("data", (chunk) => (output += chunk));
    gate.stderr.on("data", (chunk) => (output += chunk));
    const code = await new Promise((resolve) => gate.on("exit", resolve));
    assert.equal(code, 1, output);
    assert.match(output, /audit:ui: listen EADDRINUSE/);
    assert.doesNotMatch(output, /groups of visible text/);
  } finally {
    stale.close();
  }
});
