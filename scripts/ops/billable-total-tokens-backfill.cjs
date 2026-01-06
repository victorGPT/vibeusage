#!/usr/bin/env node

'use strict';

const { computeBillableTotalTokens } = require('../../insforge-src/shared/usage-billable');

const BILLABLE_RULE_VERSION = 1;
const CURSOR_FIELDS = ['hour_start', 'user_id', 'device_id', 'source', 'model'];

function parseArgs(argv) {
  const out = {
    from: null,
    to: null,
    batchSize: 500,
    sleepMs: 250,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from') {
      out.from = argv[++i] || null;
      continue;
    }
    if (arg === '--to') {
      out.to = argv[++i] || null;
      continue;
    }
    if (arg === '--batch-size') {
      out.batchSize = Number(argv[++i] || '0');
      continue;
    }
    if (arg === '--sleep-ms') {
      out.sleepMs = Number(argv[++i] || '0');
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(out.batchSize) || out.batchSize <= 0) {
    throw new Error('--batch-size must be a positive number');
  }
  if (!Number.isFinite(out.sleepMs) || out.sleepMs < 0) {
    throw new Error('--sleep-ms must be a non-negative number');
  }

  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'Backfill billable_total_tokens on vibescore_tracker_hourly',
      '',
      'Usage:',
      '  node scripts/ops/billable-total-tokens-backfill.cjs [--from <iso>] [--to <iso>] [--batch-size N] [--sleep-ms N] [--dry-run]',
      '',
      'Options:',
      '  --from <iso>     Inclusive lower bound for hour_start (ISO).',
      '  --to <iso>       Exclusive upper bound for hour_start (ISO).',
      '  --batch-size N   Rows per batch (default: 500).',
      '  --sleep-ms N     Sleep between batches (default: 250).',
      '  --dry-run        Compute counts without writing updates.',
      '  --help           Show this help.',
      ''
    ].join('\n')
  );
}

function buildUpdates(rows) {
  const updates = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.billable_total_tokens != null && row.billable_total_tokens !== '') continue;
    if (!row?.user_id || !row?.device_id || !row?.source || !row?.model || !row?.hour_start) continue;
    const billable = computeBillableTotalTokens({ source: row.source, totals: row });
    updates.push({
      user_id: row.user_id,
      device_id: row.device_id,
      source: row.source,
      model: row.model,
      hour_start: row.hour_start,
      billable_total_tokens: billable.toString(),
      billable_rule_version: BILLABLE_RULE_VERSION
    });
  }
  return updates;
}

function buildCursorFilter(cursor) {
  if (!cursor) return null;
  const clauses = [];
  for (let i = 0; i < CURSOR_FIELDS.length; i++) {
    const field = CURSOR_FIELDS[i];
    if (cursor[field] == null) return null;
    if (i === 0) {
      clauses.push(`${field}.gt.${cursor[field]}`);
      continue;
    }
    const parts = [];
    for (let j = 0; j < i; j++) {
      const prevField = CURSOR_FIELDS[j];
      parts.push(`${prevField}.eq.${cursor[prevField]}`);
    }
    parts.push(`${field}.gt.${cursor[field]}`);
    clauses.push(`and(${parts.join(',')})`);
  }
  return `(${clauses.join(',')})`;
}

function buildCursorFromRow(row) {
  if (!row) return null;
  const cursor = {};
  for (const field of CURSOR_FIELDS) {
    cursor[field] = row[field];
  }
  return cursor;
}

async function fetchBatch({ baseUrl, serviceRoleKey, from, to, limit, cursor }) {
  const url = new URL('/api/database/records/vibescore_tracker_hourly', baseUrl);
  url.searchParams.set(
    'select',
    'user_id,device_id,source,model,hour_start,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens,total_tokens,billable_total_tokens'
  );
  url.searchParams.set('billable_total_tokens', 'is.null');
  url.searchParams.set('order', 'hour_start.asc,user_id.asc,device_id.asc,source.asc,model.asc');
  url.searchParams.set('limit', String(limit));
  if (from) url.searchParams.set('hour_start', `gte.${from}`);
  if (to) url.searchParams.set('hour_start', `lt.${to}`);
  const cursorFilter = buildCursorFilter(cursor);
  if (cursorFilter) url.searchParams.set('or', cursorFilter);

  const res = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch failed: HTTP ${res.status} ${text || ''}`.trim());
  }
  return res.json();
}

async function upsertBatch({ baseUrl, serviceRoleKey, updates }) {
  if (!updates.length) return { updated: 0 };
  const url = new URL('/api/database/records/vibescore_tracker_hourly', baseUrl);
  url.searchParams.set('on_conflict', 'user_id,device_id,source,model,hour_start');
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed: HTTP ${res.status} ${text || ''}`.trim());
  }
  return { updated: updates.length };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBackfill({
  from,
  to,
  batchSize,
  sleepMs,
  dryRun,
  fetchBatch: fetchBatchImpl,
  upsertBatch: upsertBatchImpl,
  logger
}) {
  const logLine = typeof logger === 'function'
    ? logger
    : (line) => process.stdout.write(`${line}\n`);

  let cursor = null;
  let totalSeen = 0;
  let totalUpdated = 0;

  while (true) {
    const rows = await fetchBatchImpl({
      from,
      to,
      limit: batchSize,
      cursor
    });

    if (!Array.isArray(rows) || rows.length === 0) break;

    totalSeen += rows.length;
    const updates = buildUpdates(rows);
    totalUpdated += updates.length;

    if (!dryRun) {
      await upsertBatchImpl({ updates });
    }

    logLine(
      `batch cursor=${cursor ? 'set' : 'start'} rows=${rows.length} updates=${updates.length} total_updated=${totalUpdated}`
    );

    cursor = buildCursorFromRow(rows[rows.length - 1]);
    if (!cursor || CURSOR_FIELDS.some((field) => cursor[field] == null)) {
      throw new Error('Invalid cursor from batch rows');
    }

    if (sleepMs) await sleep(sleepMs);
  }

  logLine(`${dryRun ? 'dry-run' : 'apply'} complete: rows=${totalSeen} updates=${totalUpdated}`);
  return { totalSeen, totalUpdated };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const baseUrl =
    process.env.INSFORGE_BASE_URL ||
    process.env.VIBESCORE_INSFORGE_BASE_URL ||
    process.env.VIBEUSAGE_INSFORGE_BASE_URL ||
    '';
  const serviceRoleKey =
    process.env.INSFORGE_SERVICE_ROLE_KEY ||
    process.env.VIBESCORE_SERVICE_ROLE_KEY ||
    process.env.VIBEUSAGE_SERVICE_ROLE_KEY ||
    '';

  if (!baseUrl) throw new Error('Missing base URL: set INSFORGE_BASE_URL');
  if (!serviceRoleKey) throw new Error('Missing service role key: set INSFORGE_SERVICE_ROLE_KEY');

  await runBackfill({
    from: opts.from,
    to: opts.to,
    batchSize: opts.batchSize,
    sleepMs: opts.sleepMs,
    dryRun: opts.dryRun,
    fetchBatch: (args) => fetchBatch({ baseUrl, serviceRoleKey, ...args }),
    upsertBatch: (args) => upsertBatch({ baseUrl, serviceRoleKey, ...args })
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}

module.exports = {
  BILLABLE_RULE_VERSION,
  buildUpdates,
  buildCursorFilter,
  runBackfill
};
