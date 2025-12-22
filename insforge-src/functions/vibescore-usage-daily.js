// Edge function: vibescore-usage-daily
// Returns daily token usage aggregates for the authenticated user (timezone-aware).

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const {
  addDatePartsDays,
  formatLocalDateKey,
  isUtcTimeZone,
  getUsageTimeZoneContext,
  listDateStrings,
  localDatePartsToUtc,
  normalizeDateRangeLocal,
  parseDateParts
} = require('../shared/date');
const { toBigInt } = require('../shared/numbers');

module.exports = async function(request) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const methodErr = requireMethod(request, 'GET');
  if (methodErr) return methodErr;

  const bearer = getBearerToken(request.headers.get('Authorization'));
  if (!bearer) return json({ error: 'Missing bearer token' }, 401);

  const baseUrl = getBaseUrl();
  const auth = await getEdgeClientAndUserId({ baseUrl, bearer });
  if (!auth.ok) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const tzContext = getUsageTimeZoneContext(url);
  const { from, to } = normalizeDateRangeLocal(
    url.searchParams.get('from'),
    url.searchParams.get('to'),
    tzContext
  );

  if (isUtcTimeZone(tzContext)) {
    const { data, error } = await auth.edgeClient.database
      .from('vibescore_tracker_daily')
      .select('day,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
      .eq('user_id', auth.userId)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true });

    if (error) return json({ error: error.message }, 500);

    return json({ from, to, data: data || [] }, 200);
  }

  const dayKeys = listDateStrings(from, to);

  const startParts = parseDateParts(from);
  const endParts = parseDateParts(to);
  if (!startParts || !endParts) return json({ error: 'Invalid date range' }, 400);

  const startUtc = localDatePartsToUtc(startParts, tzContext);
  const endUtc = localDatePartsToUtc(addDatePartsDays(endParts, 1), tzContext);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();

  const { data, error } = await auth.edgeClient.database
    .from('vibescore_tracker_events')
    .select('token_timestamp,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
    .eq('user_id', auth.userId)
    .gte('token_timestamp', startIso)
    .lt('token_timestamp', endIso);

  if (error) return json({ error: error.message }, 500);

  const buckets = new Map(
    dayKeys.map((day) => [
      day,
      {
        total: 0n,
        input: 0n,
        cached: 0n,
        output: 0n,
        reasoning: 0n
      }
    ])
  );

  for (const row of data || []) {
    const ts = row?.token_timestamp;
    if (!ts) continue;
    const dt = new Date(ts);
    if (!Number.isFinite(dt.getTime())) continue;
    const day = formatLocalDateKey(dt, tzContext);
    const bucket = buckets.get(day);
    if (!bucket) continue;
    bucket.total += toBigInt(row?.total_tokens);
    bucket.input += toBigInt(row?.input_tokens);
    bucket.cached += toBigInt(row?.cached_input_tokens);
    bucket.output += toBigInt(row?.output_tokens);
    bucket.reasoning += toBigInt(row?.reasoning_output_tokens);
  }

  const rows = dayKeys.map((day) => {
    const bucket = buckets.get(day);
    return {
      day,
      total_tokens: bucket.total.toString(),
      input_tokens: bucket.input.toString(),
      cached_input_tokens: bucket.cached.toString(),
      output_tokens: bucket.output.toString(),
      reasoning_output_tokens: bucket.reasoning.toString()
    };
  });

  return json({ from, to, data: rows }, 200);
};
