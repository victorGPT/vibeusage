-- VibeScore Tracker leaderboard schema
-- Change: 2025-12-19-add-leaderboard-endpoints

-- User settings for leaderboard privacy
create table if not exists public.vibescore_user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  leaderboard_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.vibescore_user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_user_settings'
      and policyname = 'project_admin_policy'
  ) then
    create policy project_admin_policy on public.vibescore_user_settings
      for all to project_admin
      using (true)
      with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_user_settings'
      and policyname = 'vibescore_user_settings_select'
  ) then
    create policy vibescore_user_settings_select on public.vibescore_user_settings
      for select to public
      using (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_user_settings'
      and policyname = 'vibescore_user_settings_insert'
  ) then
    create policy vibescore_user_settings_insert on public.vibescore_user_settings
      for insert to public
      with check (auth.uid() = user_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vibescore_user_settings'
      and policyname = 'vibescore_user_settings_update'
  ) then
    create policy vibescore_user_settings_update on public.vibescore_user_settings
      for update to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Helps range aggregation for cross-user queries (leaderboard).
create index if not exists vibescore_tracker_events_ts_user_id_idx
  on public.vibescore_tracker_events (token_timestamp desc, user_id);

-- System-wide earliest day (UTC) for all-time ranges.
create or replace function public.vibescore_leaderboard_system_earliest_day()
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date;
  v_min date;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_today := (now() at time zone 'utc')::date;
  select min(day) into v_min from public.vibescore_tracker_daily;

  return coalesce(v_min, v_today);
end;
$$;

create or replace view public.vibescore_leaderboard_meta_total_current as
select
  public.vibescore_leaderboard_system_earliest_day() as from_day,
  (now() at time zone 'utc')::date as to_day;

-- Leaderboard entries for the given period.
create or replace function public.vibescore_leaderboard_period(p_period text, p_limit int)
returns table (
  rank int,
  is_me boolean,
  display_name text,
  avatar_url text,
  total_tokens bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period text;
  v_limit int;
  v_today date;
  v_from date;
  v_to date;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_period := lower(trim(coalesce(p_period, '')));
  if v_period not in ('day', 'week', 'month', 'total') then
    raise exception 'invalid period';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 100));
  v_today := (now() at time zone 'utc')::date;

  if v_period = 'day' then
    v_from := v_today;
    v_to := v_today;
  elsif v_period = 'week' then
    v_from := v_today - extract(dow from v_today)::int;
    v_to := v_from + 6;
  elsif v_period = 'month' then
    v_from := date_trunc('month', v_today::timestamp)::date;
    v_to := (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date;
  else
    v_from := coalesce((select min(day) from public.vibescore_tracker_daily), v_today);
    v_to := v_today;
  end if;

  return query
  with totals as (
    select
      d.user_id,
      sum(d.total_tokens)::bigint as total_tokens
    from public.vibescore_tracker_daily d
    where d.day between v_from and v_to
    group by d.user_id
  ),
  ranked as (
    select
      dense_rank() over (order by t.total_tokens desc)::int as rank,
      t.user_id,
      t.total_tokens
    from totals t
  )
  select
    r.rank,
    (r.user_id = auth.uid()) as is_me,
    case
      when coalesce(s.leaderboard_public, false) then coalesce(nullif(u.nickname, ''), 'Anonymous')
      else 'Anonymous'
    end as display_name,
    case
      when coalesce(s.leaderboard_public, false) then u.avatar_url
      else null
    end as avatar_url,
    r.total_tokens
  from ranked r
  left join public.vibescore_user_settings s on s.user_id = r.user_id
  left join public.users u on u.id = r.user_id
  order by r.rank asc, r.user_id asc
  limit v_limit;
end;
$$;

-- Current user's rank and total for the given period (even when not in Top N).
create or replace function public.vibescore_leaderboard_me(p_period text)
returns table (
  rank int,
  total_tokens bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period text;
  v_today date;
  v_from date;
  v_to date;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_period := lower(trim(coalesce(p_period, '')));
  if v_period not in ('day', 'week', 'month', 'total') then
    raise exception 'invalid period';
  end if;

  v_today := (now() at time zone 'utc')::date;

  if v_period = 'day' then
    v_from := v_today;
    v_to := v_today;
  elsif v_period = 'week' then
    v_from := v_today - extract(dow from v_today)::int;
    v_to := v_from + 6;
  elsif v_period = 'month' then
    v_from := date_trunc('month', v_today::timestamp)::date;
    v_to := (date_trunc('month', v_today::timestamp) + interval '1 month' - interval '1 day')::date;
  else
    v_from := coalesce((select min(day) from public.vibescore_tracker_daily), v_today);
    v_to := v_today;
  end if;

  return query
  with totals as (
    select
      d.user_id,
      sum(d.total_tokens)::bigint as total_tokens
    from public.vibescore_tracker_daily d
    where d.day between v_from and v_to
    group by d.user_id
  ),
  ranked as (
    select
      dense_rank() over (order by t.total_tokens desc)::int as rank,
      t.user_id,
      t.total_tokens
    from totals t
  ),
  me as (
    select
      r.rank,
      r.total_tokens
    from ranked r
    where r.user_id = auth.uid()
  )
  select
    me.rank,
    me.total_tokens
  from me
  union all
  select
    null::int as rank,
    0::bigint as total_tokens
  where not exists (select 1 from me);
end;
$$;

-- Views for `.from(view)` queries (avoid RPC dependency).
create or replace view public.vibescore_leaderboard_day_current as
select * from public.vibescore_leaderboard_period('day', 100);

create or replace view public.vibescore_leaderboard_week_current as
select * from public.vibescore_leaderboard_period('week', 100);

create or replace view public.vibescore_leaderboard_month_current as
select * from public.vibescore_leaderboard_period('month', 100);

create or replace view public.vibescore_leaderboard_total_current as
select * from public.vibescore_leaderboard_period('total', 100);

create or replace view public.vibescore_leaderboard_me_day_current as
select * from public.vibescore_leaderboard_me('day');

create or replace view public.vibescore_leaderboard_me_week_current as
select * from public.vibescore_leaderboard_me('week');

create or replace view public.vibescore_leaderboard_me_month_current as
select * from public.vibescore_leaderboard_me('month');

create or replace view public.vibescore_leaderboard_me_total_current as
select * from public.vibescore_leaderboard_me('total');
