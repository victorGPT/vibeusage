#!/usr/bin/env node
// Serves the built dashboard (vite preview) and runs the layout audits against it at phone, tablet and
// desktop widths: audit-small-type (no visible text under --font-size-label) and audit-edges (one left
// and one right line inside every device). Exits 1 when any run fails. Run after `npm run build`.
//   node scripts/audit-ui.mjs
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const PORT = 4317;
const BASE = `http://localhost:${PORT}`;
const WIDTHS = [360, 375, 390, 1024, 1440];
const AUDITS = ["scripts/audit-small-type.mjs", "scripts/audit-edges.mjs"];

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
let failed = 0;
try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const up = await fetch(BASE).then((res) => res.ok, () => false);
    if (up) break;
    if (Date.now() > deadline) throw new Error(`vite preview did not answer on ${BASE}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  for (const audit of AUDITS) {
    for (const width of WIDTHS) {
      const run = spawnSync(process.execPath, [audit, BASE, String(width)], { stdio: "inherit" });
      if (run.status !== 0) failed += 1;
    }
  }
} finally {
  server.kill();
}
console.log(failed ? `audit:ui: ${failed} run(s) failed` : "audit:ui: all runs pass");
process.exit(failed ? 1 : 0);
