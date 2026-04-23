const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const { ensureDir } = require("./fs");

const DEFAULT_EVENTS = ["SessionEnd", "Stop"];
const DEFAULT_TIMEOUT = 30;
const MANAGED_START = "# --- vibeusage Kimi hooks START (managed, do not edit) ---";
const MANAGED_END = "# --- vibeusage Kimi hooks END ---";

function resolveKimiConfigDir({ home = os.homedir(), env = process.env } = {}) {
  const explicit = typeof env.KIMI_HOME === "string" ? env.KIMI_HOME.trim() : "";
  if (explicit) return path.resolve(explicit);
  return path.join(home, ".kimi");
}

function resolveKimiConfigPath({ configDir }) {
  return path.join(configDir, "config.toml");
}

function buildKimiHookCommand(notifyPath) {
  const cmd = typeof notifyPath === "string" ? notifyPath : "";
  return `/usr/bin/env node ${quoteArg(cmd)} --source=kimi`;
}

async function upsertKimiHook({
  configPath,
  hookCommand,
  events = DEFAULT_EVENTS,
  timeout = DEFAULT_TIMEOUT,
}) {
  const existing = await readFileOrEmpty(configPath);
  const normalizedEvents = normalizeEvents(events);
  const nextBlock = buildManagedBlock({
    hookCommand,
    events: normalizedEvents,
    timeout: normalizeTimeout(timeout),
  });
  const { content, changed } = replaceManagedBlock(existing, nextBlock);
  if (!changed) return { changed: false, backupPath: null };
  const backupPath = await writeWithBackup({ configPath, content });
  return { changed: true, backupPath };
}

async function removeKimiHook({ configPath }) {
  const existing = await readFileOrEmpty(configPath);
  if (!existing) return { removed: false, skippedReason: "config-missing", backupPath: null };
  const { content, changed } = stripManagedBlock(existing);
  if (!changed) return { removed: false, skippedReason: "hook-missing", backupPath: null };
  const backupPath = await writeWithBackup({ configPath, content });
  return { removed: true, skippedReason: null, backupPath };
}

async function isKimiHookConfigured({
  configPath,
  hookCommand,
  events = DEFAULT_EVENTS,
  timeout = DEFAULT_TIMEOUT,
}) {
  const probe = await probeKimiHook({ configPath, hookCommand, events, timeout });
  return probe.configured;
}

async function probeKimiHook({
  configPath,
  hookCommand,
  events = DEFAULT_EVENTS,
  timeout = DEFAULT_TIMEOUT,
}) {
  const existing = await readFileOrEmpty(configPath);
  if (!existing) {
    return { configured: false, anyPresent: false, drifted: false };
  }
  const block = extractManagedBlock(existing);
  if (!block) {
    return { configured: false, anyPresent: false, drifted: false };
  }
  const expected = buildManagedBlock({
    hookCommand,
    events: normalizeEvents(events),
    timeout: normalizeTimeout(timeout),
  });
  return {
    configured: block === expected,
    anyPresent: true,
    drifted: block !== expected,
  };
}

function buildManagedBlock({ hookCommand, events, timeout }) {
  const lines = [MANAGED_START];
  for (const event of events) {
    lines.push(
      "[[hooks]]",
      `event = ${tomlString(event)}`,
      `command = ${tomlString(hookCommand)}`,
      `timeout = ${timeout}`,
    );
    lines.push("");
  }
  lines.push(MANAGED_END);
  return lines.join("\n");
}

function replaceManagedBlock(existing, nextBlock) {
  const startIdx = existing.indexOf(MANAGED_START);
  const endIdx = existing.indexOf(MANAGED_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const blockEnd = endIdx + MANAGED_END.length;
    const current = existing.slice(startIdx, blockEnd);
    if (current === nextBlock) return { content: existing, changed: false };
    const before = existing.slice(0, startIdx);
    let after = existing.slice(blockEnd);
    if (after.startsWith("\n")) after = after.slice(1);
    const beforeTrimmed = before.replace(/\n+$/, "");
    const prefix = beforeTrimmed.length > 0 ? `${beforeTrimmed}\n\n` : "";
    const suffix = after.length > 0 ? `\n\n${after.replace(/^\n+/, "")}` : "\n";
    return { content: `${prefix}${nextBlock}${suffix}`, changed: true };
  }

  const base = existing.replace(/\n+$/, "");
  const prefix = base.length > 0 ? `${base}\n\n` : "";
  return { content: `${prefix}${nextBlock}\n`, changed: true };
}

function stripManagedBlock(existing) {
  const startIdx = existing.indexOf(MANAGED_START);
  const endIdx = existing.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { content: existing, changed: false };
  }
  const blockEnd = endIdx + MANAGED_END.length;
  const before = existing.slice(0, startIdx).replace(/\n+$/, "");
  let after = existing.slice(blockEnd);
  after = after.replace(/^\n+/, "");
  if (before.length === 0 && after.length === 0) {
    return { content: "", changed: true };
  }
  if (before.length === 0) return { content: `${after.endsWith("\n") ? after : `${after}\n`}`, changed: true };
  if (after.length === 0) return { content: `${before}\n`, changed: true };
  return { content: `${before}\n\n${after.endsWith("\n") ? after : `${after}\n`}`, changed: true };
}

function extractManagedBlock(existing) {
  const startIdx = existing.indexOf(MANAGED_START);
  const endIdx = existing.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
  const blockEnd = endIdx + MANAGED_END.length;
  return existing.slice(startIdx, blockEnd);
}

function normalizeEvents(raw) {
  const values = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized || out.includes(normalized)) continue;
    out.push(normalized);
  }
  return out.length > 0 ? out : DEFAULT_EVENTS.slice();
}

function normalizeTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT;
  return Math.floor(n);
}

function tomlString(value) {
  const v = typeof value === "string" ? value : String(value ?? "");
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function quoteArg(value) {
  const v = typeof value === "string" ? value : "";
  if (!v) return '""';
  if (/^[A-Za-z0-9_\-./:@]+$/.test(v)) return v;
  return `"${v.replace(/"/g, '\\"')}"`;
}

async function readFileOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return "";
    throw err;
  }
}

async function writeWithBackup({ configPath, content }) {
  await ensureDir(path.dirname(configPath));
  let backupPath = null;
  try {
    const st = await fs.stat(configPath);
    if (st && st.isFile()) {
      backupPath = `${configPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
      await fs.copyFile(configPath, backupPath);
    }
  } catch (_e) {
    // no existing file
  }
  await fs.writeFile(configPath, content, "utf8");
  return backupPath;
}

module.exports = {
  DEFAULT_EVENTS,
  DEFAULT_TIMEOUT,
  MANAGED_START,
  MANAGED_END,
  resolveKimiConfigDir,
  resolveKimiConfigPath,
  buildKimiHookCommand,
  upsertKimiHook,
  removeKimiHook,
  isKimiHookConfigured,
  probeKimiHook,
};
