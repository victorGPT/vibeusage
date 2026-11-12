-- Create RPC to purge events older than a cutoff.

create or replace function public.vibescore_purge_events(
  cutoff_ts timestamptz,
  dry_run boolean default false
)
returns table (deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if dry_run then
    return query
      select count(*)::bigint
      from public.vibescore_tracker_events
      where token_timestamp < cutoff_ts;
  else
    return query
      with deleted as (
        delete from public.vibescore_tracker_events
        where token_timestamp < cutoff_ts
        returning 1
      )
      select count(*)::bigint from deleted;
  end if;
end;
$$;
