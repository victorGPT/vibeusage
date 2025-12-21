// Edge function: vibescore-usage-summary
// Returns token usage totals for the authenticated user over a UTC date range.

'use strict';

const { handleOptions, json, requireMethod } = require('../shared/http');
const { getBearerToken, getEdgeClientAndUserId } = require('../shared/auth');
const { getBaseUrl } = require('../shared/env');
const { normalizeDateRange } = require('../shared/date');
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
  const { from, to } = normalizeDateRange(url.searchParams.get('from'), url.searchParams.get('to'));

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

