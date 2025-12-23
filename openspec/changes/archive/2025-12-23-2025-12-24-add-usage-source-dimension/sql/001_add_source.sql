-- Add source dimension to hourly usage and update dedupe key.

alter table public.vibescore_tracker_hourly
  add column if not exists source text;

update public.vibescore_tracker_hourly
  set source = 'codex'
  where source is null or source = '';

alter table public.vibescore_tracker_hourly
  alter column source set default 'codex';

alter table public.vibescore_tracker_hourly
  alter column source set not null;

alter table public.vibescore_tracker_hourly
  drop constraint if exists vibescore_tracker_hourly_pkey;

alter table public.vibescore_tracker_hourly
  add constraint vibescore_tracker_hourly_pkey primary key (user_id, device_id, source, hour_start);

create index if not exists vibescore_tracker_hourly_user_source_hour_idx
  on public.vibescore_tracker_hourly (user_id, source, hour_start desc);
