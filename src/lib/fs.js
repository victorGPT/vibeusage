const fs = require("node:fs/promises");
const path = require("node:path");

// proper-lockfile is required lazily inside openLock(): some callers copy
// src/lib/fs.js into sandboxes that have no node_modules (e.g. the openclaw
// session plugin test, which materializes src/ under a tmp dir to test the
// ledger). Those callers only use ensureDir/readJson/etc and would crash on
// a top-level require.

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tmp, content, { encoding: "utf8" });
  await fs.rename(tmp, filePath);
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

async function readJsonStrict(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return { status: "ok", value: JSON.parse(raw), error: null };
  } catch (err) {
    if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return { status: "missing", value: null, error: err };
    }
    if (err && err.name === "SyntaxError") {
      return { status: "invalid", value: null, error: err };
    }
    return { status: "error", value: null, error: err };
  }
}

async function writeJson(filePath, obj) {
  await writeFileAtomic(filePath, JSON.stringify(obj, null, 2) + "\n");
}

async function chmod600IfPossible(filePath) {
  try {
    await fs.chmod(filePath, 0o600);
  } catch (_e) {}
}

// proper-lockfile gives us atomic mkdir-based mutual exclusion plus a heart-
// beat mechanism that auto-recovers from orphan locks without TOCTOU races:
//
//   - The holder process refreshes the lock-directory's mtime every `update`
//     ms. As long as that interval keeps running, the lock is "fresh".
//   - Any acquirer that finds the existing lock with mtime older than `stale`
//     ms takes it over via a compare-and-swap that is safe under concurrent
//     attempts (the library's own contract).
//   - If the holder dies (crash, SIGKILL, reboot) the heartbeat stops; the
//     next acquirer sees the stale mtime and recovers automatically.
//
// We deliberately set `stale` larger than the default to give a working sync
// some headroom against transient event-loop pauses (large JSON.parse, GC).
// We pass `realpath: false` because the lock target may not exist as a file
// — proper-lockfile creates the lock-directory at `lockPath` directly.
const LOCK_STALE_MS = 60_000;
const LOCK_UPDATE_MS = 10_000;

async function openLock(lockPath, { quietIfLocked } = {}) {
  // Lazy require: see top-of-file note about sandboxed callers.
  const lockfile = require("proper-lockfile");

  // Migration path: pre-proper-lockfile versions of vibeusage created the
  // lock as a regular *file* (fs.open with "wx"). proper-lockfile creates
  // it as a *directory* (mkdir). If we hand a stale legacy file off to
  // proper-lockfile, its mkdir will EEXIST and its internal rmdir-fallback
  // will then ENOTDIR, throwing instead of returning ELOCKED. Detect and
  // resolve that mismatch up front.
  const migration = await migrateLegacyLockFile(lockPath);
  if (migration === "yield-to-legacy-holder") {
    if (!quietIfLocked) process.stdout.write("Another sync is already running.\n");
    return null;
  }

  let release;
  try {
    release = await lockfile.lock(lockPath, {
      lockfilePath: lockPath,
      realpath: false,
      stale: LOCK_STALE_MS,
      update: LOCK_UPDATE_MS,
      retries: 0,
    });
  } catch (e) {
    if (e && e.code === "ELOCKED") {
      if (!quietIfLocked) process.stdout.write("Another sync is already running.\n");
      return null;
    }
    throw e;
  }
  return {
    async release() {
      try {
        await release();
      } catch (_e) {
        // Best-effort cleanup. proper-lockfile throws if the lock was already
        // compromised (e.g. taken over by another process while we were
        // running) — there is nothing useful to do at that point.
      }
    },
  };
}

// Detect a leftover lock file from the previous wx-based scheme. Three cases:
//   - "orphan"        — proven dead by PID liveness; safe to unlink and migrate.
//   - "alive"         — recorded PID is still running; yield with the standard
//                       "another sync running" UX.
//   - "indeterminate" — empty / corrupt / unreadable file. The original
//                       production openLock wrote a *zero-byte* file (it never
//                       called writeFile after fs.open(path, "wx")), so this
//                       is the **expected** legacy format. We cannot prove
//                       its holder is dead and we MUST NOT auto-delete: a
//                       still-running legacy sync would lose its lock and a
//                       new-format sync would start in parallel. Yield and
//                       print an actionable manual-cleanup notice.
async function migrateLegacyLockFile(lockPath) {
  let stat;
  try {
    stat = await fs.lstat(lockPath);
  } catch (e) {
    if (e && e.code === "ENOENT") return "no-legacy";
    throw e;
  }
  if (stat.isDirectory()) return "no-legacy"; // already in proper-lockfile format

  const verdict = await classifyLegacyFileLock(lockPath);
  if (verdict === "orphan") {
    await fs.unlink(lockPath).catch(() => {});
    return "migrated";
  }
  if (verdict === "indeterminate") {
    process.stderr.write(
      `vibeusage: legacy sync.lock at ${lockPath} carries no PID payload, ` +
        `so we cannot prove its owner is dead. Auto-deletion is unsafe — a ` +
        `still-running legacy sync would lose its lock. If no legacy ` +
        `vibeusage sync is actually running, remove it manually: rm ${JSON.stringify(
          lockPath,
        )}\n`,
    );
  }
  return "yield-to-legacy-holder";
}

async function classifyLegacyFileLock(lockPath) {
  let raw;
  try {
    raw = await fs.readFile(lockPath, "utf8");
  } catch (_e) {
    return "indeterminate";
  }
  if (!raw) return "indeterminate";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return "indeterminate";
  }
  const pid = parsed?.pid;
  if (!Number.isFinite(pid)) return "indeterminate";
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (e) {
    if (e && e.code === "ESRCH") return "orphan";
    return "alive"; // EPERM = pid exists but belongs to another user
  }
}

module.exports = {
  ensureDir,
  writeFileAtomic,
  readJson,
  readJsonStrict,
  writeJson,
  chmod600IfPossible,
  openLock,
};
