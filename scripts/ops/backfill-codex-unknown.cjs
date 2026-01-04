"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");

const DEFAULT_TRACKER_DIR = path.join(os.homedir(), ".vibeusage", "tracker");
const TOKEN_FIELDS = [
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens",
];

function printHelp() {
  process.stdout.write(
    [
      "Backfill Codex unknown buckets",
      "",
      "Usage:",
      "  node scripts/ops/backfill-codex-unknown.cjs [--dry-run|--apply] [--sync] [--summary] [--limit N]",
      "  node scripts/ops/backfill-codex-unknown.cjs --tracker-dir <path>",
      "",
      "Options:",
      "  --dry-run        Default. Print planned corrections only.",
      "  --apply          Append corrections to queue.jsonl and update cursors.json.",
      "  --sync           After --apply, run: npx vibeusage sync --drain.",
      "  --summary        Print counts only (no per-hour details).",
      "  --limit N        Limit detailed output rows (default: 20).",
      "  --tracker-dir    Override tracker dir (default: ~/.vibeusage/tracker).",
      "  --queue-path     Override queue.jsonl path.",
      "  --cursors-path   Override cursors.json path.",
      "  --help           Show this help.",
      "",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const out = {
    mode: "dry-run",
    sync: false,
    summary: false,
    limit: 20,
    trackerDir: null,
    queuePath: null,
    cursorsPath: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a === "--apply") {
      out.mode = "apply";
      continue;
    }
    if (a === "--dry-run") {
      out.mode = "dry-run";
      continue;
    }
    if (a === "--sync") {
      out.sync = true;
      continue;
    }
    if (a === "--summary") {
      out.summary = true;
      continue;
    }
    if (a === "--limit") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error("--limit must be a non-negative number");
      out.limit = Math.floor(v);
      continue;
    }
    if (a === "--tracker-dir") {
      out.trackerDir = argv[++i] || null;
      continue;
    }
    if (a === "--queue-path") {
      out.queuePath = argv[++i] || null;
      continue;
    }
    if (a === "--cursors-path") {
      out.cursorsPath = argv[++i] || null;
      continue;
    }
    throw new Error(`Unknown option: ${a}`);
  }

  return out;
}

function parseBucketKey(key) {
  if (typeof key !== "string") return null;
  const first = key.indexOf("|");
  if (first <= 0) return null;
  const second = key.indexOf("|", first + 1);
  if (second <= first + 1) return null;
  return {
    source: key.slice(0, first),
    model: key.slice(first + 1, second),
    hourStart: key.slice(second + 1),
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function addTotals(a, b) {
  const out = {};
  for (const k of TOKEN_FIELDS) {
    out[k] = toNumber(a?.[k]) + toNumber(b?.[k]);
  }
  return out;
}

function totalsKey(totals) {
  return TOKEN_FIELDS.map((k) => String(toNumber(totals?.[k]))).join("|");
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  const payload = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(filePath, payload, "utf8");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const trackerDir = opts.trackerDir || process.env.VIBESCORE_TRACKER_DIR || DEFAULT_TRACKER_DIR;
  const queuePath = opts.queuePath || path.join(trackerDir, "queue.jsonl");
  const cursorsPath = opts.cursorsPath || path.join(trackerDir, "cursors.json");

  const cursors = await readJson(cursorsPath).catch((err) => {
    throw new Error(`Failed to read cursors.json: ${err.message}`);
  });
  const hourly = cursors?.hourly || {};
  const buckets = hourly?.buckets || {};

  const groups = new Map();
  for (const [key, bucket] of Object.entries(buckets)) {
    if (!bucket || !bucket.totals) continue;
    const parsed = parseBucketKey(key);
    if (!parsed || parsed.source !== "codex") continue;
    let group = groups.get(parsed.hourStart);
    if (!group) {
      group = { unknown: null, known: [] };
      groups.set(parsed.hourStart, group);
    }
    if (parsed.model === "unknown") {
      group.unknown = { bucket, key };
    } else {
      group.known.push({ model: parsed.model, bucket, key });
    }
  }

  const zeroTotals = {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
  };
  const zeroKey = totalsKey(zeroTotals);

  const records = [];
  const summaries = [];
  let totalUnknownTokens = 0;

  for (const [hourStart, group] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!group.unknown || group.known.length === 0) continue;
    const unknownTotals = group.unknown.bucket.totals || {};
    const unknownTotalTokens = toNumber(unknownTotals.total_tokens);
    if (unknownTotalTokens <= 0) continue;

    let dominant = null;
    for (const entry of group.known) {
      const total = toNumber(entry.bucket?.totals?.total_tokens);
      if (
        !dominant ||
        total > dominant.total ||
        (total === dominant.total && entry.model < dominant.model)
      ) {
        dominant = { model: entry.model, bucket: entry.bucket, total };
      }
    }

    if (!dominant) continue;

    const mergedTotals = addTotals(dominant.bucket.totals, unknownTotals);
    totalUnknownTokens += unknownTotalTokens;

    records.push({
      source: "codex",
      model: "unknown",
      hour_start: hourStart,
      ...zeroTotals,
    });
    records.push({
      source: "codex",
      model: dominant.model,
      hour_start: hourStart,
      ...mergedTotals,
    });

    if (opts.mode === "apply") {
      dominant.bucket.queuedKey = totalsKey(mergedTotals);
      group.unknown.bucket.retractedUnknownKey = zeroKey;
      group.unknown.bucket.alignedModel = null;
    }

    summaries.push({
      hourStart,
      dominantModel: dominant.model,
      unknownTotal: unknownTotalTokens,
      mergedTotal: mergedTotals.total_tokens,
    });
  }

  if (summaries.length === 0) {
    process.stdout.write("No codex unknown buckets require backfill.\n");
    return;
  }

  if (opts.summary) {
    process.stdout.write(
      [
        `Buckets: ${summaries.length}`,
        `Records to append: ${records.length}`,
        `Unknown total tokens: ${totalUnknownTokens}`,
      ].join("\n") + "\n"
    );
  } else {
    process.stdout.write(`Buckets: ${summaries.length}\n`);
    const limit = opts.limit ?? 20;
    const display = limit > 0 ? summaries.slice(0, limit) : [];
    for (const entry of display) {
      process.stdout.write(
        `${entry.hourStart} -> ${entry.dominantModel} (unknown ${entry.unknownTotal}, merged ${entry.mergedTotal})\n`
      );
    }
    if (summaries.length > display.length) {
      process.stdout.write(`... and ${summaries.length - display.length} more\n`);
    }
  }

  if (opts.mode !== "apply") {
    process.stdout.write("Dry-run only. Re-run with --apply to append corrections.\n");
    return;
  }

  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  const lines = records.map((rec) => JSON.stringify(rec)).join("\n") + "\n";
  await fs.appendFile(queuePath, lines, "utf8");

  hourly.updatedAt = new Date().toISOString();
  cursors.updatedAt = new Date().toISOString();
  await writeJson(cursorsPath, cursors);

  process.stdout.write(`Appended records: ${records.length}\n`);

  if (opts.sync) {
    const res = cp.spawnSync("npx", ["vibeusage", "sync", "--drain"], {
      stdio: "inherit",
    });
    if (res.status !== 0) {
      throw new Error(`sync failed with exit code ${res.status}`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
