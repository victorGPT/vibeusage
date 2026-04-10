const fs = require("node:fs/promises");
const path = require("node:path");

const ALLOWED_HERMES_LEDGER_FIELDS = [
  "version",
  "type",
  "source",
  "session_id",
  "platform",
  "model",
  "provider",
  "api_mode",
  "api_call_count",
  "input_tokens",
  "output_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "reasoning_tokens",
  "total_tokens",
  "finish_reason",
  "emitted_at",
];

function resolveHermesUsageLedgerPaths({ trackerDir } = {}) {
  if (!trackerDir) throw new Error("trackerDir is required");
  return {
    ledgerPath: path.join(trackerDir, "hermes.usage.jsonl"),
  };
}

async function readHermesUsageLedger({ trackerDir, offset = 0 } = {}) {
  const { ledgerPath } = resolveHermesUsageLedgerPaths({ trackerDir });
  const buffer = await fs.readFile(ledgerPath).catch((err) => {
    if (err && err.code === "ENOENT") return null;
    throw err;
  });

  if (!buffer) {
    return { events: [], endOffset: 0 };
  }

  const startOffset = Math.max(0, Number(offset || 0));
  const fileEndOffset = buffer.length;
  if (startOffset >= fileEndOffset) {
    return { events: [], endOffset: fileEndOffset };
  }

  const newlineIndex = buffer.lastIndexOf(0x0a);
  if (newlineIndex < startOffset) {
    return { events: [], endOffset: startOffset };
  }

  const endOffset = newlineIndex + 1;
  const raw = buffer.subarray(startOffset, endOffset).toString("utf8");
  const events = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean)
    .map(stripToAllowedHermesFields)
    .filter(isHermesLedgerEvent);

  return { events, endOffset };
}

async function readLastHermesUsageEvent({ trackerDir } = {}) {
  const { ledgerPath } = resolveHermesUsageLedgerPaths({ trackerDir });
  const text = await fs.readFile(ledgerPath, "utf8").catch((err) => {
    if (err && err.code === "ENOENT") return null;
    throw err;
  });
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
    const line = String(lines[idx] || "").trim();
    if (!line) continue;
    try {
      const parsed = stripToAllowedHermesFields(JSON.parse(line));
      if (isHermesLedgerEvent(parsed)) return parsed;
    } catch (_err) {
      // ignore malformed line
    }
  }
  return null;
}

function stripToAllowedHermesFields(event) {
  const out = {};
  for (const field of ALLOWED_HERMES_LEDGER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(event, field)) continue;
    out[field] = event[field];
  }
  return out;
}

function isHermesLedgerEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (normalizeString(event.source) !== "hermes") return false;
  const type = normalizeString(event.type);
  if (!type || !["session_start", "usage", "session_end"].includes(type)) return false;
  return true;
}

function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

module.exports = {
  ALLOWED_HERMES_LEDGER_FIELDS,
  resolveHermesUsageLedgerPaths,
  readHermesUsageLedger,
  readLastHermesUsageEvent,
};
