const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { listOpencodeMessageFiles, parseOpencodeIncremental } = require("./rollout");

const BUCKET_SEPARATOR = "|";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatHourKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes() >= 30 ? 30 : 0,
  ).padStart(2, "0")}:00`;
}

function toBig(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.trim()) return BigInt(value);
  return 0n;
}

function addTotals(target, delta) {
  target.input_tokens += toBig(delta.input_tokens);
  target.cached_input_tokens += toBig(delta.cached_input_tokens);
  target.output_tokens += toBig(delta.output_tokens);
  target.reasoning_output_tokens += toBig(delta.reasoning_output_tokens);
  target.total_tokens += toBig(delta.total_tokens);
}

async function buildLocalHourlyTotals({ storageDir, source = "opencode" }) {
  const messageFiles = await listOpencodeMessageFiles(storageDir);
  const opencodeDbPath = path.resolve(storageDir, "..", "opencode.db");
  const queuePath = path.join(
    os.tmpdir(),
    `vibeusage-opencode-audit-${process.pid}-${Date.now()}.jsonl`,
  );
  const cursors = { version: 1, files: {}, hourly: null, opencode: null };

  await parseOpencodeIncremental({ messageFiles, opencodeDbPath, cursors, queuePath, source });
  await fs.rm(queuePath, { force: true }).catch(() => {});

  const byHour = new Map();
  let minDay = null;
  let maxDay = null;

  for (const [key, bucket] of Object.entries(cursors.hourly?.buckets || {})) {
    const [bucketSource, , hourStart] = String(key).split(BUCKET_SEPARATOR);
    if (bucketSource !== source || !hourStart) continue;
    const dt = new Date(hourStart);
    if (!Number.isFinite(dt.getTime())) continue;
    const hourKey = formatHourKey(dt);
    const dayKey = hourKey.slice(0, 10);

    if (!minDay || dayKey < minDay) minDay = dayKey;
    if (!maxDay || dayKey > maxDay) maxDay = dayKey;

    const totals = byHour.get(hourKey) || {
      input_tokens: 0n,
      cached_input_tokens: 0n,
      output_tokens: 0n,
      reasoning_output_tokens: 0n,
      total_tokens: 0n,
    };
    addTotals(totals, bucket.totals || {});
    byHour.set(hourKey, totals);
  }

  return { byHour, minDay, maxDay };
}

function normalizeServerRows(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row || !row.hour) continue;
    map.set(row.hour, {
      missing: Boolean(row.missing),
      totals: {
        input_tokens: toBig(row.input_tokens),
        cached_input_tokens: toBig(row.cached_input_tokens),
        output_tokens: toBig(row.output_tokens),
        reasoning_output_tokens: toBig(row.reasoning_output_tokens),
        total_tokens: toBig(row.total_tokens),
      },
    });
  }
  return map;
}

function diffTotals(local, server) {
  return {
    input_tokens: local.input_tokens - server.input_tokens,
    cached_input_tokens: local.cached_input_tokens - server.cached_input_tokens,
    output_tokens: local.output_tokens - server.output_tokens,
    reasoning_output_tokens: local.reasoning_output_tokens - server.reasoning_output_tokens,
    total_tokens: local.total_tokens - server.total_tokens,
  };
}

function maxAbsDelta(delta) {
  return [
    delta.input_tokens,
    delta.cached_input_tokens,
    delta.output_tokens,
    delta.reasoning_output_tokens,
    delta.total_tokens,
  ].reduce((acc, value) => {
    const abs = value < 0n ? -value : value;
    return abs > acc ? abs : acc;
  }, 0n);
}

function isValidDay(value) {
  if (!DAY_RE.test(value)) return false;
  const dt = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(dt.getTime());
}

function listDays(from, to) {
  if (!isValidDay(from) || !isValidDay(to)) return [];
  if (from > to) return [];
  const out = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let dt = start; dt <= end; dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000)) {
    const day = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate(),
    ).padStart(2, "0")}`;
    out.push(day);
  }
  return out;
}

async function auditOpencodeUsage({ storageDir, from, to, fetchHourly, includeMissing = false }) {
  const local = await buildLocalHourlyTotals({ storageDir, source: "opencode" });
  if (!local.minDay || !local.maxDay) {
    throw new Error("No local opencode data found");
  }

  const fromDay = from || local.minDay;
  const toDay = to || local.maxDay;
  const days = listDays(fromDay, toDay);
  if (days.length === 0) {
    throw new Error("Invalid date range for audit");
  }

  const diffs = [];
  let matched = 0;
  let mismatched = 0;
  let incomplete = 0;
  let maxDelta = 0n;

  for (const day of days) {
    const server = await fetchHourly(day);
    const serverByHour = normalizeServerRows(server?.data || []);
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hourKey = `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
        const localTotals = local.byHour.get(hourKey) || {
          input_tokens: 0n,
          cached_input_tokens: 0n,
          output_tokens: 0n,
          reasoning_output_tokens: 0n,
          total_tokens: 0n,
        };
        const serverEntry = serverByHour.get(hourKey) || null;
        if (serverEntry?.missing && !includeMissing) {
          incomplete += 1;
          continue;
        }
        const serverTotals = serverEntry?.totals || {
          input_tokens: 0n,
          cached_input_tokens: 0n,
          output_tokens: 0n,
          reasoning_output_tokens: 0n,
          total_tokens: 0n,
        };
        const delta = diffTotals(localTotals, serverTotals);
        const deltaMax = maxAbsDelta(delta);
        if (deltaMax === 0n) {
          matched += 1;
        } else {
          mismatched += 1;
          if (deltaMax > maxDelta) maxDelta = deltaMax;
          diffs.push({ hour: hourKey, local: localTotals, server: serverTotals, delta });
        }
      }
    }
  }

  return {
    summary: {
      days: days.length,
      slots: days.length * 48,
      matched,
      mismatched,
      incomplete,
      maxDelta,
    },
    diffs,
  };
}

module.exports = { auditOpencodeUsage, buildLocalHourlyTotals };
