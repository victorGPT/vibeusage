const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureDir, readJson, writeJson } = require("./fs");

const OPENCLAW_SOURCE = "openclaw";
const ALLOWED_EVENT_FIELDS = [
  "eventId",
  "emittedAt",
  "source",
  "agentId",
  "sessionRef",
  "provider",
  "model",
  "channel",
  "chatType",
  "trigger",
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens",
];

function resolveOpenclawUsageLedgerPaths({ trackerDir } = {}) {
  if (!trackerDir) throw new Error("trackerDir is required");
  return {
    ledgerPath: path.join(trackerDir, "openclaw-usage-ledger.jsonl"),
    statePath: path.join(trackerDir, "openclaw-usage-ledger.state.json"),
    saltPath: path.join(trackerDir, "openclaw-usage-ledger.salt"),
  };
}

async function buildOpenclawUsageEvent({ trackerDir, payload } = {}) {
  if (!payload || typeof payload !== "object") throw new Error("payload is required");

  const source = normalizeString(payload.source) || OPENCLAW_SOURCE;
  const emittedAt = normalizeIso(payload.emittedAt) || new Date().toISOString();
  const agentId = normalizeString(payload.agentId);
  const provider = normalizeString(payload.provider);
  const model = normalizeString(payload.model);
  const channel = normalizeString(payload.channel);
  const chatType = normalizeString(payload.chatType);
  const trigger = normalizeString(payload.trigger);
  const sessionKey = normalizeString(payload.sessionKey);
  const existingSessionRef = normalizeHex(payload.sessionRef);
  const sessionRef = sessionKey
    ? await hashOpenclawSessionRef({ trackerDir, sessionKey })
    : existingSessionRef;

  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage : payload;
  const event = {
    eventId: normalizeString(payload.eventId),
    emittedAt,
    source,
    agentId,
    sessionRef,
    provider,
    model,
    channel,
    chatType,
    trigger,
    inputTokens: toNonNegativeInt(usage.inputTokens ?? usage.input_tokens),
    cachedInputTokens: toNonNegativeInt(usage.cachedInputTokens ?? usage.cached_input_tokens),
    outputTokens: toNonNegativeInt(usage.outputTokens ?? usage.output_tokens),
    reasoningOutputTokens: toNonNegativeInt(
      usage.reasoningOutputTokens ?? usage.reasoning_output_tokens,
    ),
    totalTokens: toNonNegativeInt(usage.totalTokens ?? usage.total_tokens),
  };

  if (!event.eventId) {
    event.eventId = deriveOpenclawEventId(event);
  }

  return stripEmptyAllowedFields(event);
}

async function appendOpenclawUsageEvent({ trackerDir, event, payload } = {}) {
  const nextEvent = event
    ? await buildOpenclawUsageEvent({ trackerDir, payload: event })
    : await buildOpenclawUsageEvent({ trackerDir, payload });
  const { ledgerPath, statePath } = resolveOpenclawUsageLedgerPaths({ trackerDir });

  await ensureDir(path.dirname(ledgerPath));

  const state = (await readJson(statePath)) || { version: 1, seenEventIds: {}, updatedAt: null };
  if (!state.seenEventIds || typeof state.seenEventIds !== "object") {
    state.seenEventIds = {};
  }

  if (state.seenEventIds[nextEvent.eventId]) {
    return { appended: false, duplicate: true, event: nextEvent };
  }

  await fs.appendFile(ledgerPath, `${JSON.stringify(nextEvent)}\n`, "utf8");
  state.version = 1;
  state.seenEventIds[nextEvent.eventId] = nextEvent.emittedAt || new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  await writeJson(statePath, state);

  return { appended: true, duplicate: false, event: nextEvent };
}

async function readOpenclawUsageLedger({ trackerDir, offset = 0 } = {}) {
  const { ledgerPath } = resolveOpenclawUsageLedgerPaths({ trackerDir });
  const buffer = await fs.readFile(ledgerPath).catch((err) => {
    if (err && err.code === "ENOENT") return null;
    throw err;
  });

  if (!buffer) {
    return { events: [], endOffset: 0 };
  }

  const startOffset = Math.max(0, Number(offset || 0));
  const endOffset = buffer.length;
  if (startOffset >= endOffset) {
    return { events: [], endOffset };
  }

  const raw = buffer.subarray(startOffset).toString("utf8");
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
    .map(stripToAllowedEventFields);

  return { events, endOffset };
}

async function hashOpenclawSessionRef({ trackerDir, sessionKey } = {}) {
  const normalized = normalizeString(sessionKey);
  if (!normalized) return null;

  const salt = await ensureOpenclawLedgerSalt({ trackerDir });
  return crypto.createHmac("sha256", salt).update(normalized).digest("hex");
}

async function ensureOpenclawLedgerSalt({ trackerDir } = {}) {
  const { saltPath } = resolveOpenclawUsageLedgerPaths({ trackerDir });
  await ensureDir(path.dirname(saltPath));

  try {
    const existing = (await fs.readFile(saltPath, "utf8")).trim();
    if (existing) return existing;
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  const salt = crypto.randomBytes(32).toString("hex");
  await fs.writeFile(saltPath, `${salt}\n`, { encoding: "utf8", mode: 0o600 });
  return salt;
}

function deriveOpenclawEventId(event) {
  const stable = JSON.stringify({
    emittedAt: normalizeIso(event.emittedAt),
    source: normalizeString(event.source) || OPENCLAW_SOURCE,
    agentId: normalizeString(event.agentId),
    sessionRef: normalizeHex(event.sessionRef),
    provider: normalizeString(event.provider),
    model: normalizeString(event.model),
    channel: normalizeString(event.channel),
    chatType: normalizeString(event.chatType),
    trigger: normalizeString(event.trigger),
    inputTokens: toNonNegativeInt(event.inputTokens),
    cachedInputTokens: toNonNegativeInt(event.cachedInputTokens),
    outputTokens: toNonNegativeInt(event.outputTokens),
    reasoningOutputTokens: toNonNegativeInt(event.reasoningOutputTokens),
    totalTokens: toNonNegativeInt(event.totalTokens),
  });
  return crypto.createHash("sha256").update(stable).digest("hex");
}

function stripEmptyAllowedFields(event) {
  const out = {};
  for (const field of ALLOWED_EVENT_FIELDS) {
    const value = event[field];
    if (value == null) continue;
    out[field] = value;
  }
  return out;
}

function stripToAllowedEventFields(event) {
  const out = {};
  for (const field of ALLOWED_EVENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(event, field)) continue;
    out[field] = event[field];
  }
  return out;
}

function normalizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIso(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const time = Date.parse(normalized);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function normalizeHex(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  return /^[a-f0-9]{64}$/i.test(normalized) ? normalized.toLowerCase() : null;
}

function toNonNegativeInt(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}

module.exports = {
  ALLOWED_EVENT_FIELDS,
  buildOpenclawUsageEvent,
  appendOpenclawUsageEvent,
  readOpenclawUsageLedger,
  hashOpenclawSessionRef,
  resolveOpenclawUsageLedgerPaths,
};
