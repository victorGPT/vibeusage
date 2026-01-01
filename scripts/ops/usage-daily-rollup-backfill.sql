create or replace function public.vibescore_rebuild_daily_rollup(p_from date, p_to date)
returns void as $$
begin
  delete from public.vibescore_tracker_daily_rollup
  where day >= p_from and day <= p_to;

  insert into public.vibescore_tracker_daily_rollup (
    user_id, day, source, model,
    total_tokens, input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, updated_at
  )
  select
    user_id,
    (hour_start at time zone 'UTC')::date as day,
    source,
    model,
    sum(coalesce(total_tokens, 0))::bigint,
    sum(coalesce(input_tokens, 0))::bigint,
    sum(coalesce(cached_input_tokens, 0))::bigint,
    sum(coalesce(output_tokens, 0))::bigint,
    sum(coalesce(reasoning_output_tokens, 0))::bigint,
    now()
  from public.vibescore_tracker_hourly
  where hour_start >= (p_from::timestamptz at time zone 'UTC')
    and hour_start < ((p_to + 1)::timestamptz at time zone 'UTC')
  group by 1,2,3,4;
end;
$$ language plpgsql;
