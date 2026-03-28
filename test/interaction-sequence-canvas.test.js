const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "ops", "interaction-sequence-canvas.cjs");

async function writeFixture(rootDir, relPath, contents = "") {
  const fullPath = path.join(rootDir, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, contents);
  return fullPath;
}

function runGenerator({ rootDir, outPath }) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, "--root", rootDir, "--out", outPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const err = new Error(`generator failed: ${result.stderr || result.stdout}`);
    err.exitCode = result.status;
    throw err;
  }
  return result.stdout;
}

async function readCanvas(outPath) {
  const raw = await fs.readFile(outPath, "utf8");
  return JSON.parse(raw);
}

async function setupTrackerSyncFixtures(rootDir) {
  await writeFixture(rootDir, "src/commands/sync.js", "module.exports = {};\n");
  await writeFixture(rootDir, "src/lib/rollout.js", "module.exports = {};\n");
  await writeFixture(rootDir, "src/lib/uploader.js", "module.exports = {};\n");
  await writeFixture(rootDir, "src/lib/vibeusage-api.js", "module.exports = {};\n");
  await writeFixture(rootDir, "insforge-src/functions-esm/vibeusage-ingest.js", "export {};\n");
  await writeFixture(rootDir, "insforge-src/functions-esm/vibeusage-sync-ping.js", "export {};\n");
}

async function setupLinkCodeFixtures(rootDir) {
  await writeFixture(rootDir, "src/commands/init.js", "module.exports = {};\n");
  await writeFixture(rootDir, "insforge-src/functions-esm/vibeusage-link-code-init.js", "export {};\n");
  await writeFixture(rootDir, "insforge-src/functions-esm/vibeusage-link-code-exchange.js", "export {};\n");
}

test("interaction sequence canvas includes pinned tracker sync scenario", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-seq-"));
  await setupTrackerSyncFixtures(rootDir);

  const config = {
    version: 1,
    max_scenarios: 3,
    pin: ["tracker-sync-ingest"],
    exclude: [],
    labels: { "tracker-sync-ingest": "Tracker Sync -> Ingest" },
  };
  await writeFixture(rootDir, "interaction_sequence.config.json", JSON.stringify(config, null, 2));

  const outPath = path.join(rootDir, "interaction_sequence.canvas");
  runGenerator({ rootDir, outPath });

  const canvas = await readCanvas(outPath);
  assert.ok(Array.isArray(canvas.nodes));
  assert.ok(Array.isArray(canvas.edges));
  assert.ok(canvas.nodes.length > 0);
  assert.ok(canvas.edges.length > 0);

  const groupNode = canvas.nodes.find(
    (node) =>
      node.type === "group" &&
      typeof node.label === "string" &&
      node.label.includes("Tracker Sync"),
  );
  assert.ok(groupNode, "expected pinned scenario group to exist");
});

test("interaction sequence canvas honors exclude list", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-seq-"));
  await setupTrackerSyncFixtures(rootDir);
  await setupLinkCodeFixtures(rootDir);

  const config = {
    version: 1,
    max_scenarios: 3,
    pin: ["tracker-sync-ingest"],
    exclude: ["link-code-exchange"],
  };
  await writeFixture(rootDir, "interaction_sequence.config.json", JSON.stringify(config, null, 2));

  const outPath = path.join(rootDir, "interaction_sequence.canvas");
  runGenerator({ rootDir, outPath });

  const canvas = await readCanvas(outPath);
  const excluded = canvas.nodes.find(
    (node) =>
      node.type === "group" && typeof node.label === "string" && node.label.includes("Link Code"),
  );
  assert.equal(excluded, undefined);
});
