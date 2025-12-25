// Edge function: vibescore-events-retention
// Purges legacy events older than a cutoff (default 30 days).
// Optionally purges ingest batch metrics when requested.
// Requires service role token in Authorization header.

'use strict';

const { handleOptions, json, requireMethod, readJson } = require('../shared/http');
const { getBearerToken } = require('../shared/auth');
const { getAnonKey, getBaseUrl, getServiceRoleKey } = require('../shared/env');

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'POST');
  if (methodErr) return methodErr;

  const serviceRoleKey = getServiceRoleKey();
  if (!serviceRoleKey) return json({ error: 'Service role key missing' }, 500);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer || bearer !== serviceRoleKey) return json({ error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (body.error) return json({ error: body.error }, body.status);

  const days = clampDays(body.data?.days);
  const dryRun = Boolean(body.data?.dry_run);
  const includeIngestBatches = Boolean(body.data?.include_ingest_batches);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(cutoff.getTime())) return json({ error: 'Invalid cutoff' }, 400);

  const baseUrl = getBaseUrl();
  const anonKey = getAnonKey();
  const serviceClient = createClient({
    baseUrl,
    anonKey: anonKey || serviceRoleKey,
    edgeFunctionToken: serviceRoleKey
  });

  const cutoffIso = cutoff.toISOString();
  const eventsResult = await purgeTable({
    serviceClient,
    table: 'vibescore_tracker_events',
    cutoffColumn: 'token_timestamp',
    cutoffIso,
    dryRun,
    countColumn: 'event_id'
  });
  if (eventsResult.error) return json({ error: eventsResult.error }, 500);

  let ingestResult = { deleted: 0 };
  if (includeIngestBatches) {
    ingestResult = await purgeTable({
      serviceClient,
      table: 'vibescore_tracker_ingest_batches',
      cutoffColumn: 'created_at',
      cutoffIso,
      dryRun,
      countColumn: 'batch_id'
    });
    if (ingestResult.error) return json({ error: ingestResult.error }, 500);
  }

  return json(
    {
      ok: true,
      dry_run: dryRun,
      days,
      cutoff: cutoff.toISOString(),
      deleted: eventsResult.deleted,
      deleted_ingest_batches: ingestResult.deleted,
      ingest_batches_enabled: includeIngestBatches
    },
    200
  );
};

async function purgeTable({ serviceClient, table, cutoffColumn, cutoffIso, dryRun, countColumn }) {
  if (!serviceClient) return { deleted: 0, error: 'Service client missing' };
  const countSelect = countColumn || '*';

  if (dryRun) {
    const { count, error } = await serviceClient.database
      .from(table)
      .select(countSelect, { count: 'exact' })
      .lt(cutoffColumn, cutoffIso)
      .limit(1);
    if (error) return { deleted: 0, error: formatError(error) };
    return { deleted: toSafeInt(count), error: null };
  }

  const before = await serviceClient.database
    .from(table)
    .select(countSelect, { count: 'exact' })
    .lt(cutoffColumn, cutoffIso)
    .limit(1);
  if (before.error) return { deleted: 0, error: formatError(before.error) };

  const { error: deleteErr } = await serviceClient.database
    .from(table)
    .delete()
    .lt(cutoffColumn, cutoffIso);
  if (deleteErr) return { deleted: 0, error: formatError(deleteErr) };

  const after = await serviceClient.database
    .from(table)
    .select(countSelect, { count: 'exact' })
    .lt(cutoffColumn, cutoffIso)
    .limit(1);
  if (after.error) return { deleted: 0, error: formatError(after.error) };

  return { deleted: Math.max(0, toSafeInt(before.count) - toSafeInt(after.count)), error: null };
}

function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function formatError(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || JSON.stringify(error);
}

function clampDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  if (n <= 0) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.floor(n));
}
