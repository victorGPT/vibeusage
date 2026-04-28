const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { openLock } = require("../src/lib/fs");

async function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "vibeusage-lock-"));
}

test("openLock acquires when no lock exists, releases cleanly", async () => {
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  const lock = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(lock, "should return a lock handle");

  // proper-lockfile creates lockPath as a directory with the heartbeat mtime.
  const stat = await fs.stat(lockPath);
  assert.ok(stat.isDirectory(), "lock path is a directory while held");

  await lock.release();

  await assert.rejects(fs.access(lockPath), /ENOENT/);
});

test("openLock yields while another holder is alive; release lets the next caller in", async () => {
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  const first = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(first);

  const second = await openLock(lockPath, { quietIfLocked: true });
  assert.equal(second, null, "concurrent acquire must yield");

  await first.release();

  const third = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(third, "release must clear the way for the next caller");
  await third.release();
});

test("openLock auto-recovers from an orphan lock with a stale heartbeat mtime", async () => {
  // Real-world scenario: a sync process died abnormally (SIGKILL, system
  // restart) before its heartbeat could refresh. proper-lockfile detects
  // the stale mtime on the lock directory and takes it over for us. No
  // manual recovery code on our side.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  // Forge an "orphan" lock directory with a heartbeat mtime older than our
  // 60s stale window. This is exactly what a crashed sync leaves behind
  // once enough time has passed without a heartbeat refresh.
  await fs.mkdir(lockPath);
  const oldMtime = new Date(Date.now() - 5 * 60 * 1000);
  await fs.utimes(lockPath, oldMtime, oldMtime);

  const recovered = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(recovered, "stale orphan lock must be auto-recovered");
  await recovered.release();
});

test("openLock yields to a live cross-process holder whose heartbeat is fresh", async () => {
  // Spawn a child that acquires the lock and stays alive (with active timers
  // so its heartbeat keeps refreshing). Concurrent acquire attempts from
  // this process must yield until the child releases or dies.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  // proper-lockfile's heartbeat timer is unref'd, so the child needs its own
  // ref'd timer to keep its event loop alive — mirroring how a real sync
  // process stays alive via its ongoing fs/network work.
  const childScript = `
    const { openLock } = require(${JSON.stringify(path.resolve("src/lib/fs.js"))});
    (async () => {
      const lock = await openLock(${JSON.stringify(lockPath)}, { quietIfLocked: true });
      if (!lock) { process.stdout.write("FAIL\\n"); process.exit(2); }
      process.stdout.write("HELD\\n");
      // Keep the event loop alive (ref'd timer); the lock heartbeat will
      // ride along.
      const keepalive = setInterval(() => {}, 1000);
      process.on("SIGTERM", async () => {
        clearInterval(keepalive);
        await lock.release();
        process.exit(0);
      });
    })();
  `;
  const child = spawn(process.execPath, ["-e", childScript], {
    stdio: ["ignore", "pipe", "inherit"],
  });

  await new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      if (buf.includes("HELD")) {
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.once("error", reject);
  });

  try {
    const blocked = await openLock(lockPath, { quietIfLocked: true });
    assert.equal(blocked, null, "fresh heartbeat from cross-process holder must keep us out");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
});

test("openLock migrates an orphaned legacy file lock (pre-proper-lockfile format)", async () => {
  // Pre-upgrade vibeusage created the lock as a regular file via fs.open
  // "wx". After upgrade, proper-lockfile expects a directory at the same
  // path. Without explicit migration, it would mkdir-EEXIST then rmdir-
  // ENOTDIR and throw instead of yielding. The new migration path detects
  // the legacy file, confirms the recorded pid is dead, removes it, and
  // hands a clean slate to proper-lockfile.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  const ghostPid = 4194303;
  await fs.writeFile(
    lockPath,
    JSON.stringify({ pid: ghostPid, startedAtMs: Date.now() - 60_000 }),
  );

  const lock = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(lock, "orphaned legacy file lock must be migrated and reclaimed");

  // After migration, the lock path is a directory (proper-lockfile format),
  // not a file.
  const stat = await fs.stat(lockPath);
  assert.ok(stat.isDirectory(), "post-migration lock path must be a directory");

  await lock.release();
});

test("openLock refuses to auto-delete a zero-byte legacy lock (the actual pre-fix prod format)", async () => {
  // The original openLock did `fs.open(path, "wx")` and never called
  // writeFile, so the lock file it left behind was always 0 bytes. With no
  // PID payload we cannot prove its holder is dead, and auto-deleting would
  // race a still-running legacy sync. Migration must yield + warn, not
  // unlink.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");
  await fs.writeFile(lockPath, "");

  const captured = [];
  const realStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  let lock;
  try {
    lock = await openLock(lockPath, { quietIfLocked: true });
  } finally {
    process.stderr.write = realStderrWrite;
  }

  assert.equal(lock, null, "must yield rather than auto-delete an empty legacy lock");

  const stat = await fs.stat(lockPath);
  assert.ok(stat.isFile(), "zero-byte legacy lock must remain in place for manual cleanup");
  assert.equal(stat.size, 0);

  const stderr = captured.join("");
  assert.match(stderr, /no PID payload/);
  assert.match(stderr, new RegExp(`rm .*${path.basename(lockPath)}`));
});

test("openLock yields to a still-alive legacy file lock holder rather than crashing", async () => {
  // Worst-case upgrade scenario: an old-format vibeusage sync is genuinely
  // still running while a new-format sync starts. We must not delete the
  // legacy holder's file, and we must not let proper-lockfile's mkdir+rmdir
  // path throw ENOTDIR. Yield with the standard "another sync running" UX.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  await fs.writeFile(
    lockPath,
    JSON.stringify({ pid: process.pid, startedAtMs: Date.now() }),
  );

  const lock = await openLock(lockPath, { quietIfLocked: true });
  assert.equal(lock, null, "must yield to a live legacy holder");

  // Legacy file must remain untouched — we did not create it, we do not
  // get to delete it while its holder is alive.
  const stat = await fs.stat(lockPath);
  assert.ok(stat.isFile(), "live legacy file lock must remain in place");
});

test("openLock does not flag a long-running, still-beating holder as stale", async () => {
  // Regression check: the previous wall-clock-age implementation would have
  // misclassified a long-running but actively beating lock as orphaned.
  // proper-lockfile's heartbeat is the correctness signal, so a holder with
  // a fresh mtime must not be taken over no matter how long ago it started.
  const dir = await tmpDir();
  const lockPath = path.join(dir, "sync.lock");

  const first = await openLock(lockPath, { quietIfLocked: true });
  assert.ok(first);

  // The holder has been "running" for hours, but the heartbeat keeps the
  // mtime fresh — proper-lockfile's update interval ticks during the test.
  // Even if we forcibly age the directory, the next heartbeat will refresh
  // it; instead we just verify that a peer attempt yields immediately.
  const peer = await openLock(lockPath, { quietIfLocked: true });
  assert.equal(peer, null, "peer must yield to a beating holder");

  await first.release();
});
