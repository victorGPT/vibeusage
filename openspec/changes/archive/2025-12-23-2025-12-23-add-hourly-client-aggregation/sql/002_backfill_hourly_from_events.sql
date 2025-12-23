-- Backfill half-hour aggregates from legacy per-event table.

with hourly as (
  select
    user_id,
    device_id,
    max(device_token_id::text)::uuid as device_token_id,
    date_trunc('hour', token_timestamp)
      + case when extract(minute from token_timestamp) >= 30 then interval '30 minutes' else interval '0 minutes' end
      as hour_start,
    sum(input_tokens)::bigint as input_tokens,
    sum(cached_input_tokens)::bigint as cached_input_tokens,
    sum(output_tokens)::bigint as output_tokens,
    sum(reasoning_output_tokens)::bigint as reasoning_output_tokens,
    sum(total_tokens)::bigint as total_tokens
  from public.vibescore_tracker_events
  where token_timestamp is not null
    and user_id is not null
    and device_id is not null
  group by user_id, device_id, hour_start
)
insert into public.vibescore_tracker_hourly (
  user_id,
  device_id,
  device_token_id,
  hour_start,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  reasoning_output_tokens,
  total_tokens,
  created_at,
  updated_at
)
select
  user_id,
  device_id,
  device_token_id,
  hour_start,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  reasoning_output_tokens,
  total_tokens,
  now(),
  now()
from hourly
on conflict (user_id, device_id, hour_start) do update set
  device_token_id = coalesce(excluded.device_token_id, public.vibescore_tracker_hourly.device_token_id),
  input_tokens = excluded.input_tokens,
  cached_input_tokens = excluded.cached_input_tokens,
  output_tokens = excluded.output_tokens,
  reasoning_output_tokens = excluded.reasoning_output_tokens,
  total_tokens = excluded.total_tokens,
  updated_at = now();
