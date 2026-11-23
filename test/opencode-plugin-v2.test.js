const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const {
  PLUGIN_MARKER,
  V2_EVENTS,
  buildOpencodePlugin,
  buildOpencodePluginV2,
  upsertOpencodePlugin,
  isOpencodePluginInstalled,
} = require("../src/lib/opencode-config");

async function withTmp(fn) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-opencode-plugin-"));
  try {
    return await fn(tmp);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function waitFor(file, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const text = await fs.readFile(file, "utf8").catch(() => null);
    if (text) return text;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

// Mirrors anomalyco/opencode@4cf9db95 packages/core/src/plugin/module.ts:81-93:
// default must be { id: string, effect: function } or { id: string, setup: function }.
function assertV2Module(mod) {
  const value = mod.default;
  assert.ok(value && typeof value === "object", "default export is an object");
  assert.equal(typeof value.id, "string");
  assert.ok(typeof value.effect === "function" || typeof value.setup === "function");
}

test("opencode v2 plugin passes the upstream module check and notifies when a turn ends", async () => {
  await withTmp(async (tmp) => {
    const marker = path.join(tmp, "notified.txt");
    const notifyPath = path.join(tmp, "notify.cjs");
    await fs.writeFile(
      notifyPath,
      `require("node:fs").writeFileSync(${JSON.stringify(marker)}, process.argv.slice(2).join(" "));\n`,
    );
    const pluginPath = path.join(tmp, "vibeusage-tracker.mjs");
    const text = buildOpencodePluginV2({ notifyPath });
    assert.ok(text.includes(PLUGIN_MARKER));
    await fs.writeFile(pluginPath, text);

    const mod = await import(pathToFileURL(pluginPath).href);
    assertV2Module(mod);

    let subscribed = null;
    const ctx = {
      event: {
        subscribe(options) {
          subscribed = options;
          return (async function* () {
            yield { type: "session.execution.succeeded", data: { sessionID: "ses_1" } };
          })();
        },
      },
    };
    const cleanup = await mod.default.setup(ctx);
    assert.deepEqual(subscribed.types, V2_EVENTS);
    assert.ok(V2_EVENTS.includes("session.execution.succeeded"));
    assert.equal(await waitFor(marker), "--source=opencode");

    assert.equal(typeof cleanup, "function");
    assert.equal(subscribed.signal.aborted, false);
    await cleanup();
    assert.equal(subscribed.signal.aborted, true);
  });
});

test("upsertOpencodePlugin writes the v2 plugin for opencode 2.x and v1 otherwise", async () => {
  await withTmp(async (tmp) => {
    const cases = [
      ["opencode v2.4.0", buildOpencodePluginV2],
      ["1.18.31", buildOpencodePlugin],
      [null, buildOpencodePlugin],
    ];
    for (const [version, build] of cases) {
      const configDir = path.join(tmp, String(version));
      const result = await upsertOpencodePlugin({
        configDir,
        notifyPath: "/tmp/notify.cjs",
        readVersion: () => version,
      });
      assert.equal(result.changed, true);
      assert.equal(await fs.readFile(result.pluginPath, "utf8"), build({ notifyPath: "/tmp/notify.cjs" }));
      assert.equal(await isOpencodePluginInstalled({ configDir }), true);
    }
  });
});
