// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a timezone-aware date range.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const {
  addDatePartsDays,
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
    const aggregate = await tryAggregateDailyTotals({
      edgeClient: auth.edgeClient,
      userId: auth.userId,
      from,
      to
    });

    if (aggregate) {
      return json(
        {
          from,
          to,
          days: aggregate.days,
          totals: aggregate.totals
        },
        200
      );
    }

    const { data, error } = await auth.edgeClient.database
      .from('vibescore_tracker_daily')
      .select('day,total_tokens,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens')
      .eq('user_id', auth.userId)
      .gte('day', from)
      .lte('day', to);

    if (error) return json({ error: error.message }, 500);

    const totals = sumDailyRows(data || []);

    return json(
      {
        from,
        to,
        days: (data || []).length,
        totals
      },
      200
    );
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

  const totals = sumEventRows(data || []);

  return json(
    {
      from,
      to,
      days: dayKeys.length,
      totals
    },
    200
  );
};

function sumDailyRows(rows) {
  let totalTokens = 0n;
  let inputTokens = 0n;
  let cachedInputTokens = 0n;
  let outputTokens = 0n;
  let reasoningOutputTokens = 0n;

  for (const r of rows) {
    totalTokens += toBigInt(r?.total_tokens);
    inputTokens += toBigInt(r?.input_tokens);
    cachedInputTokens += toBigInt(r?.cached_input_tokens);
    outputTokens += toBigInt(r?.output_tokens);
    reasoningOutputTokens += toBigInt(r?.reasoning_output_tokens);
  }

  return {
    total_tokens: totalTokens.toString(),
    input_tokens: inputTokens.toString(),
    cached_input_tokens: cachedInputTokens.toString(),
    output_tokens: outputTokens.toString(),
    reasoning_output_tokens: reasoningOutputTokens.toString()
  };
}

function sumEventRows(rows) {
  let totalTokens = 0n;
  let inputTokens = 0n;
  let cachedInputTokens = 0n;
  let outputTokens = 0n;
  let reasoningOutputTokens = 0n;

  for (const r of rows) {
    totalTokens += toBigInt(r?.total_tokens);
    inputTokens += toBigInt(r?.input_tokens);
    cachedInputTokens += toBigInt(r?.cached_input_tokens);
    outputTokens += toBigInt(r?.output_tokens);
    reasoningOutputTokens += toBigInt(r?.reasoning_output_tokens);
  }

  return {
    total_tokens: totalTokens.toString(),
    input_tokens: inputTokens.toString(),
    cached_input_tokens: cachedInputTokens.toString(),
    output_tokens: outputTokens.toString(),
    reasoning_output_tokens: reasoningOutputTokens.toString()
  };
}

async function tryAggregateDailyTotals({ edgeClient, userId, from, to }) {
  try {
    const { data, error } = await edgeClient.database
      .from('vibescore_tracker_daily')
      .select(
        'days:count(),sum_total_tokens:sum(total_tokens),sum_input_tokens:sum(input_tokens),sum_cached_input_tokens:sum(cached_input_tokens),sum_output_tokens:sum(output_tokens),sum_reasoning_output_tokens:sum(reasoning_output_tokens)'
      )
      .eq('user_id', userId)
      .gte('day', from)
      .lte('day', to)
      .maybeSingle();

    if (error || !data) return null;

    return {
      days: normalizeCount(data.days),
      totals: {
        total_tokens: toBigInt(data.sum_total_tokens).toString(),
        input_tokens: toBigInt(data.sum_input_tokens).toString(),
        cached_input_tokens: toBigInt(data.sum_cached_input_tokens).toString(),
        output_tokens: toBigInt(data.sum_output_tokens).toString(),
        reasoning_output_tokens: toBigInt(data.sum_reasoning_output_tokens).toString()
      }
    };
  } catch (_e) {
    return null;
  }
}

function normalizeCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}
