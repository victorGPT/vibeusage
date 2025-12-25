// Edge function: vibescore-usage-monthly
// Returns monthly token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserIdFast } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { getSourceParam } = require('../shared/source');
const { getModelParam } = require('../shared/model');
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

const MAX_MONTHS = 24;

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserIdFast({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const tzContext = getUsageTimeZoneContext(url);
  const sourceResult = getSourceParam(url);
  if (!sourceResult.ok) return json({ error: sourceResult.error }, 400);
  const source = sourceResult.source;
  const modelResult = getModelParam(url);
  if (!modelResult.ok) return json({ error: modelResult.error }, 400);
  const model = modelResult.model;
  const monthsRaw = url.searchParams.get('months');
  const monthsParsed = toPositiveIntOrNull(monthsRaw);
  const months = monthsParsed == null ? MAX_MONTHS : monthsParsed;
  if (months < 1 || months > MAX_MONTHS) return json({ error: 'Invalid months' }, 400);

  const toRaw = url.searchParams.get('to');
  const todayParts = getLocalParts(new Date(), tzContext);
  const toParts = toRaw
    ? parseDateParts(toRaw)
    : { year: todayParts.year, month: todayParts.month, day: todayParts.day };
  if (!toParts) return json({ error: 'Invalid to date' }, 400);

  const startMonthParts = addDatePartsMonths(
    { year: toParts.year, month: toParts.month, day: 1 },
    -(months - 1)
  );
  const from = formatDateParts(startMonthParts);
  const to = formatDateParts(toParts);

  if (!from || !to) return json({ error: 'Invalid to date' }, 400);

  const startUtc = localDatePartsToUtc(
    { ...startMonthParts, hour: 0, minute: 0, second: 0 },
    tzContext
  );
  const endUtc = localDatePartsToUtc(addDatePartsDays(toParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

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

  const { error } = await forEachPage({
    createQuery: () => {
      let query = auth.edgeClient.database
        .from('vibescore_tracker_hourly')
        .select('hour_start,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
        .eq('user_id', auth.userId);
      if (source) query = query.eq('source', source);
      if (model) query = query.eq('model', model);
      return query.gte('hour_start', startIso).lt('hour_start', endIso).order('hour_start', { ascending: true });
    },
    onPage: (rows) => {
      for (const row of rows) {
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

  if (error) return json({ error: error.message }, 500);

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

  return json({ from, to, months, data: monthly }, 200);
};
