-- Purge legacy event rows older than 30 days (UTC).

select count(*)::int as rows_to_delete
from public.vibescore_tracker_events
where token_timestamp < now() - interval '30 days';

delete from public.vibescore_tracker_events
where token_timestamp < now() - interval '30 days';
