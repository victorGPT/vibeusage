// Edge function: vibescore-usage-monthly
// Returns monthly token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam } = require('../shared/source');
const { getModelParam } = require('../shared/model');
const { resolveUsageModelsForCanonical } = require('../shared/model-identity');
const { applyCanaryFilter } = require('../shared/canary');
const {
  addDatePartsDays,
  addDatePartsMonths,
  formatDateParts,
  getLocalParts,
  getUsageTimeZoneContext,
  localDatePartsToUtc,
  parseDateParts
} = require('../shared/date');
const { toBigInt, toPositiveIntOrNull } = require('../shared/numbers');
const { forEachPage } = require('../shared/pagination');
const { logSlowQuery, withRequestLogging } = require('../shared/logging');
const { isDebugEnabled, withSlowQueryDebugPayload } = require('../shared/debug');

const MAX_MONTHS = 24;

module.exports = withRequestLogging('vibescore-usage-monthly', async function(request, logger) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const url = new URL(request.url);
  const debugEnabled = isDebugEnabled(url);
  const respond = (body, status, durationMs) => json(
    debugEnabled ? withSlowQueryDebugPayload(body, { logger, durationMs, status }) : body,
    status
  );

  if (request.method !== 'GET') return respond({ error: 'Method not allowed' }, 405, 0);

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return respond({ error: 'Missing bearer token' }, 401, 0);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) return respond({ error: 'Unauthorized' }, 401, 0);
  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return respond({ error: sourceResult.error }, 400, 0);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return respond({ error: modelResult.error }, 400, 0);
  const model = modelResult.model;
  const monthsRaw = url.searchParams.get('months');
  const monthsParsed = toPositiveIntOrNull(monthsRaw);
  const months = monthsParsed == null ? MAX_MONTHS : monthsParsed;
  if (months < 1 || months > MAX_MONTHS) return respond({ error: 'Invalid months' }, 400, 0);

  const toRaw = url.searchParams.get('to');
  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw
    ? parseDateParts(toRaw)
    : { year: todayParts.year, month: todayParts.month, day: todayParts.day };
  if (!toParts) return respond({ error: 'Invalid to date' }, 400, 0);

  const startMonthParts = addDatePartsMonths(
    { year: toParts.year, month: toParts.month, day: 1 },
    -(months - 1)
  );
  const from = formatDateParts(startMonthParts);
  const to = formatDateParts(toParts);

  if (!from || !to) return respond({ error: 'Invalid to date' }, 400, 0);

  const startUtc = localDatePartsToUtc(
    { ...startMonthParts, hour: 0, minute: 0, second: 0 },
    tzContext
  );
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();
  const modelFilter = await resolveUsageModelsForCanonical({
    edgeClient: auth.edgeClient,
    canonicalModel: model,
    effectiveDate: to
  });
  const canonicalModel = modelFilter.canonical;
  const usageModels = modelFilter.usageModels;
  const hasModelFilter = Array.isArray(usageModels) && usageModels.length > 0;

  const monthKeys = [];
  const buckets = new Map();

  for (let i = 0; i < months; i += 1) {
    const parts = addDatePartsMonths(startMonthParts, i);
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    monthKeys.push(key);
    buckets.set(key, {
      total: 0n,
      input: 0n,
      cached: 0n,
      output: 0n,
      reasoning: 0n
    });
  }

  const queryStartMs = Date.now();
  let rowCount = 0;
  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select('hour_start,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (hasModelFilter) query = query.in('model', usageModels);
      query = applyCanaryFilter(query, { source, model: canonicalModel });
      return query
        .gte('hour_start', startIso)
        .lt('hour_start', endIso)
        .order('hour_start', { ascending: true })
        .order('device_id', { ascending: true })
        .order('source', { ascending: true })
        .order('model', { ascending: true });
    },
    onPage: (rows) => {
      const pageRows = Array.isArray(rows) ? rows : [];
      rowCount += pageRows.length;
      for (const row of pageRows) {
        const ts = row?.hour_start;
        if (!ts) continue;
        const dt = new Date(ts);
        if (!Number.isFinite(dt.getTime())) continue;
        const localParts = getLocalParts(dt, tzContext);
        const key = `${localParts.year}-${String(localParts.month).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        bucket.total += toBigInt(row?.total_tokens);
        bucket.input += toBigInt(row?.input_tokens);
        bucket.cached += toBigInt(row?.cached_input_tokens);
        bucket.output += toBigInt(row?.output_tokens);
        bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
      }
    }
  });
  const queryDurationMs = Date.now() - queryStartMs;
  logSlowQuery(logger, {
    query_label: 'usage_monthly',
    duration_ms: queryDurationMs,
    row_count: rowCount,
    range_months: months,
    source: source || null,
    model: canonicalModel || null,
    tz: tzContext?.timeZone || null,
    tz_offset_minutes: Number.isFinite(tzContext?.offsetMinutes) ? tzContext.offsetMinutes : null
  });

  if (error) return respond({ error: error.message }, 500, queryDurationMs);

  const monthly = monthKeys.map((key) => {
    const bucket = buckets.get(key);
    return {
      month: key,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
  });

  return respond({ from, to, months, data: monthly }, 200, queryDurationMs);
});
