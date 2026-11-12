-- Add model dimension to hourly usage and update dedupe key.
-- NOTE: Backfill legacy rows to model='unknown' and enforce NOT NULL.

alter table public.vibescore_tracker_hourly
  add column if not exists model text;

update public.vibescore_tracker_hourly
  set model = 'unknown'
  where model is null or model = '';

alter table public.vibescore_tracker_hourly
  alter column model set default 'unknown';

alter table public.vibescore_tracker_hourly
  alter column model set not null;

alter table public.vibescore_tracker_hourly
  drop constraint if exists vibescore_tracker_hourly_pkey;

alter table public.vibescore_tracker_hourly
  drop constraint if exists vibescore_tracker_hourly_dedupe_uniq;

alter table public.vibescore_tracker_hourly
  add constraint vibescore_tracker_hourly_pkey
  primary key (user_id, device_id, source, model, hour_start);

create index if not exists vibescore_tracker_hourly_user_source_model_hour_idx
  on public.vibescore_tracker_hourly (user_id, source, model, hour_start desc);
