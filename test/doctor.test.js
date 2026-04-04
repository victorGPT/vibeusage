const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { buildDoctorReport } = require("../src/lib/doctor");
const { cmdDoctor } = require("../src/commands/doctor");

test("doctor treats any HTTP response as reachable", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example" },
    fetch: async () => ({ status: 401 }),
  });
  const check = report.checks.find((c) => c.id === "network.base_url");

  assert.equal(check.status, "ok");
  assert.equal(check.meta.status_code, 401);
});

test("doctor warns when base_url is missing", async () => {
  const report = await buildDoctorReport({
    runtime: {},
    fetch: async () => ({ status: 200 }),
  });
  const check = report.checks.find((c) => c.id === "network.base_url");

  assert.equal(check.status, "warn");
  assert.equal(report.summary.warn, 2);
  assert.equal(report.summary.fail, 1);
  assert.equal(report.ok, true);
});

test("doctor marks network errors as fail", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example" },
    fetch: async () => {
      throw new Error("nope");
    },
  });
  const check = report.checks.find((c) => c.id === "network.base_url");

  assert.equal(check.status, "fail");
  assert.equal(report.summary.fail, 1);
  assert.equal(report.summary.warn, 1);
  assert.equal(report.ok, true);
});

test("doctor reports runtime config status", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example", deviceToken: "token" },
    fetch: async () => ({ status: 200 }),
  });
  const baseCheck = report.checks.find((c) => c.id === "runtime.base_url");
  const tokenCheck = report.checks.find((c) => c.id === "runtime.device_token");

  assert.equal(baseCheck.status, "ok");
  assert.equal(tokenCheck.status, "ok");
});

test("doctor surfaces unreadable supported OpenClaw diagnostics as warnings", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example" },
    fetch: async () => ({ status: 200 }),
    diagnostics: {
      notify: {
        openclaw_session_plugin_status: "unreadable",
        openclaw_session_plugin_detail: "OpenClaw config unreadable: invalid json",
        openclaw_session_plugin_configured: false,
      },
    },
  });
  const sessionCheck = report.checks.find((c) => c.id === "notify.openclaw_session_plugin");
  const hookCheck = report.checks.find((c) => c.id === "notify.openclaw_hook");

  assert.equal(sessionCheck.status, "warn");
  assert.equal(sessionCheck.meta.status, "unreadable");
  assert.equal(hookCheck, undefined);
});

test("doctor ignores legacy OpenClaw hook diagnostics when computing checks", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example" },
    fetch: async () => ({ status: 200 }),
    diagnostics: {
      notify: {
        openclaw_hook_status: "unreadable",
        openclaw_hook_detail: "should be ignored",
        openclaw_hook_configured: true,
      },
      upload: { last_error: null },
      opencode: { sqlite_status: "ok", sqlite_db_present: true },
    },
  });

  assert.equal(report.checks.find((c) => c.id === "notify.openclaw_hook"), undefined);
  const notifyConfigured = report.checks.find((c) => c.id === "notify.configured");
  assert.equal(notifyConfigured.meta.configured, false);
});

test("doctor marks invalid config.json as critical", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-"));
  const trackerDir = path.join(tmp, ".vibeusage", "tracker");
  await fs.mkdir(trackerDir, { recursive: true });
  const configPath = path.join(trackerDir, "config.json");
  await fs.writeFile(configPath, "{bad", "utf8");

  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example" },
    fetch: async () => ({ status: 200 }),
    paths: { trackerDir, configPath },
  });
  const configCheck = report.checks.find((c) => c.id === "fs.config_json");

  assert.equal(configCheck.status, "fail");
  assert.equal(configCheck.critical, true);
});

test("doctor --out writes json to file and stdout", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-"));
  const prevHome = process.env.HOME;
  const prevCwd = process.cwd();
  const prevFetch = globalThis.fetch;
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    process.env.HOME = tmp;
    process.chdir(tmp);
    globalThis.fetch = async () => ({ status: 204 });
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = undefined;

    await cmdDoctor(["--out", "doctor.json"]);

    const out = outCapture.read();
    assert.ok(out.trim().startsWith("{"));
    const payload = JSON.parse(out);
    assert.equal(payload.version, 1);

    const filePayload = JSON.parse(await fs.readFile(path.join(tmp, "doctor.json"), "utf8"));
    assert.equal(filePayload.version, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    process.chdir(prevCwd);
    globalThis.fetch = prevFetch;
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor sets exitCode on critical failures", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-"));
  const prevHome = process.env.HOME;
  const prevFetch = globalThis.fetch;
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    process.env.HOME = tmp;
    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.writeFile(path.join(trackerDir, "config.json"), "{bad", "utf8");
    globalThis.fetch = async () => ({ status: 200 });
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json"]);

    assert.equal(process.exitCode, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    globalThis.fetch = prevFetch;
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor supports CLI base-url override", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-"));
  const prevHome = process.env.HOME;
  const prevFetch = globalThis.fetch;
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    process.env.HOME = tmp;
    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.writeFile(
      path.join(trackerDir, "config.json"),
      JSON.stringify({ baseUrl: "https://config.example", deviceToken: "t" }),
      "utf8",
    );
    globalThis.fetch = async () => ({ status: 200 });
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json", "--base-url", "https://override.example"]);

    const payload = JSON.parse(outCapture.read());
    const baseCheck = payload.checks.find((c) => c.id === "runtime.base_url");
    assert.equal(baseCheck.meta.base_url, "https://override.example");
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    globalThis.fetch = prevFetch;
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor tolerates null config.json payload", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-"));
  const prevHome = process.env.HOME;
  const prevFetch = globalThis.fetch;
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    process.env.HOME = tmp;
    const trackerDir = path.join(tmp, ".vibeusage", "tracker");
    await fs.mkdir(trackerDir, { recursive: true });
    await fs.writeFile(path.join(trackerDir, "config.json"), "null", "utf8");
    globalThis.fetch = async () => ({ status: 200 });
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json"]);

    const payload = JSON.parse(outCapture.read());
    assert.equal(payload.version, 1);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    globalThis.fetch = prevFetch;
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("doctor does not migrate legacy tracker directory", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-doctor-legacy-"));
  const prevHome = process.env.HOME;
  const prevFetch = globalThis.fetch;
  const prevWrite = process.stdout.write;
  const prevErr = process.stderr.write;
  const prevExit = process.exitCode;

  try {
    process.env.HOME = tmp;
    const legacyTrackerDir = path.join(tmp, ".vibescore", "tracker");
    await fs.mkdir(legacyTrackerDir, { recursive: true });
    await fs.writeFile(
      path.join(legacyTrackerDir, "config.json"),
      JSON.stringify({ baseUrl: "https://legacy.example", deviceToken: "legacy-token" }) + "\n",
      "utf8",
    );
    globalThis.fetch = async () => ({ status: 200 });
    const outCapture = createWriteCapture();
    const errCapture = createWriteCapture();
    process.stdout.write = outCapture.write;
    process.stderr.write = errCapture.write;
    process.exitCode = 0;

    await cmdDoctor(["--json"]);

    const payload = JSON.parse(outCapture.read());
    const configCheck = payload.checks.find((c) => c.id === "fs.config_json");
    assert.equal(configCheck.status, "warn");
    assert.match(configCheck.meta.path, /\.vibeusage\/tracker\/config\.json$/);
    const newTrackerDir = path.join(tmp, ".vibeusage", "tracker");
    await assert.rejects(fs.stat(newTrackerDir));
    await fs.stat(legacyTrackerDir);
  } finally {
    process.stdout.write = prevWrite;
    process.stderr.write = prevErr;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    globalThis.fetch = prevFetch;
    process.exitCode = prevExit;
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
test("doctor includes opencode sqlite support check", async () => {
  const report = await buildDoctorReport({
    runtime: { baseUrl: "https://example", deviceToken: "token" },
    fetch: async () => ({ status: 200 }),
    diagnostics: {
      notify: {},
      upload: { last_error: null },
      opencode: {
        sqlite_status: "ok",
        sqlite_db_present: true,
      },
    },
  });

  const check = report.checks.find((entry) => entry.id === "opencode.sqlite_support");
  assert.ok(check);
  assert.equal(check.status, "ok");
});

test("doctor warns when opencode sqlite has never been checked or db is missing", async () => {
  for (const sqliteStatus of ["never_checked", "missing-db"]) {
    const report = await buildDoctorReport({
      runtime: { baseUrl: "https://example", deviceToken: "token" },
      fetch: async () => ({ status: 200 }),
      diagnostics: {
        notify: {},
        upload: { last_error: null },
        opencode: {
          sqlite_status: sqliteStatus,
          sqlite_db_present: sqliteStatus !== "missing-db",
        },
      },
    });

    const check = report.checks.find((entry) => entry.id === "opencode.sqlite_support");
    assert.equal(check.status, "warn");
  }
});

test("doctor fails opencode sqlite support without marking it critical", async () => {
  for (const sqliteStatus of ["missing-sqlite3", "query-failed"]) {
    const report = await buildDoctorReport({
      runtime: { baseUrl: "https://example", deviceToken: "token" },
      fetch: async () => ({ status: 200 }),
      diagnostics: {
        notify: {},
        upload: { last_error: null },
        opencode: {
          sqlite_status: sqliteStatus,
          sqlite_db_present: true,
        },
      },
    });

    const check = report.checks.find((entry) => entry.id === "opencode.sqlite_support");
    assert.equal(check.status, "fail");
    assert.equal(check.critical, false);
    assert.equal(report.summary.critical, 0);
  }
});

function createWriteCapture() {
  let out = "";
  return {
    write(chunk, enc, cb) {
      out += typeof chunk === "string" ? chunk : chunk.toString(enc || "utf8");
      if (typeof cb === "function") cb();
      return true;
    },
    read() {
      return out;
    },
  };
}
