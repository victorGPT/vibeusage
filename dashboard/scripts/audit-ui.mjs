#!/usr/bin/env node
// Serves the built dashboard and runs the layout audits against it at phone, tablet and desktop widths:
// audit-small-type (no visible text under --font-size-label) audit-edges (one left and one right
// line inside every device), audit-toast (the upgrade toast covers nothing at phone widths) and
// audit-axis (usage chart axis labels at least --spacing-s2 apart). Exits 1 when any run fails. Run after `npm run build`.
// The server is this process's own socket on a port the OS hands out, so the audits can only reach
// this build; a taken port (AUDIT_UI_PORT pins one) fails the gate instead of auditing whoever holds it.
//   node scripts/audit-ui.mjs
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const WIDTHS = [360, 375, 390, 1024, 1440];
const AUDITS = ["scripts/audit-small-type.mjs", "scripts/audit-edges.mjs", "scripts/audit-toast.mjs", "scripts/audit-axis.mjs"];
const DIST = path.resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

// Static files from dist; any path without a file falls back to index.html, as the SPA host does.
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(DIST, pathname);
  const inside = file.startsWith(DIST + path.sep);
  const body = (inside && (await readFile(file).catch(() => null))) || (await readFile(path.join(DIST, "index.html")));
  const type = inside && path.extname(file) in TYPES && body ? TYPES[path.extname(file)] : "text/html";
  res.writeHead(200, { "content-type": type }).end(body);
});

let failed = 0;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(process.env.AUDIT_UI_PORT) || 0, "127.0.0.1", resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const audit of AUDITS) {
    for (const width of WIDTHS) {
      // Async, so this process keeps serving while the audit's browser loads the pages.
      const code = await new Promise((resolve) => {
        const run = spawn(process.execPath, [audit, base, String(width)], { stdio: "inherit" });
        run.on("exit", resolve);
      });
      if (code !== 0) failed += 1;
    }
  }
} catch (error) {
  console.error(`audit:ui: ${error.message}`);
  failed += 1;
} finally {
  server.close();
}
console.log(failed ? `audit:ui: ${failed} run(s) failed` : "audit:ui: all runs pass");
process.exit(failed ? 1 : 0);
