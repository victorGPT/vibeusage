-- Weekly leaderboard MVP (week-only + GPT/Claude breakdown).
-- Notes:
-- - `from_day/to_day` are inclusive dates; hourly scan uses [from_day, to_day+1) in UTC.
-- - Keep existing view column order when using CREATE OR REPLACE VIEW; add new columns at the end.

-- 1) Extend snapshots to store GPT/Claude breakdown.
alter table public.vibeusage_leaderboard_snapshots
  add column if not exists gpt_tokens bigint not null default 0,
  add column if not exists claude_tokens bigint not null default 0;

-- Best-effort backfill for existing rows.
update public.vibeusage_leaderboard_snapshots
set gpt_tokens = total_tokens,
    claude_tokens = 0
where gpt_tokens = 0 and claude_tokens = 0;

-- 2) Add hour_start index to support weekly global scans.
create index if not exists vibeusage_tracker_hourly_hour_start_idx
  on public.vibeusage_tracker_hourly (hour_start);

-- 3) Weekly leaderboard source view (service-role refresh).
create or replace view public.vibeusage_leaderboard_source_week as
with base as (
  select (now() at time zone 'utc')::date as today
),
params as (
  select
    base.today - extract(dow from base.today)::int as from_day,
    base.today - extract(dow from base.today)::int + 6 as to_day
  from base
),
totals as (
  select
    h.user_id,
    sum(
      case
        when (
          h.model like 'gpt-%'
          or h.model like 'openai/%'
          or h.model like '%/gpt-%'
        ) then h.total_tokens::bigint
        else 0::bigint
      end
    )::bigint as gpt_tokens,
    sum(
      case
        when (
          h.model like 'claude-%'
          or h.model like 'anthropic/%'
          or h.model like '%/claude-%'
        ) then coalesce(h.billable_total_tokens, h.total_tokens::bigint)
        else 0::bigint
      end
    )::bigint as claude_tokens
  from public.vibeusage_tracker_hourly h
  join params p
    on h.hour_start >= (timezone('utc', p.from_day::date + time '00:00'))
   and h.hour_start < (timezone('utc', (p.to_day + 1)::date + time '00:00'))
  where h.source <> 'canary'
    and h.source in ('codex', 'every-code', 'claude', 'opencode')
    and h.model <> 'unknown'
    and (
      h.model like 'gpt-%'
      or h.model like 'openai/%'
      or h.model like '%/gpt-%'
      or h.model like 'claude-%'
      or h.model like 'anthropic/%'
      or h.model like '%/claude-%'
    )
  group by h.user_id
),
ranked as (
  select
    dense_rank() over (order by (t.gpt_tokens + t.claude_tokens) desc)::int as rank,
    t.user_id,
    (t.gpt_tokens + t.claude_tokens)::bigint as total_tokens,
    t.gpt_tokens,
    t.claude_tokens
  from totals t
)
select
  r.user_id,
  r.rank,
  r.total_tokens,
  case
    when coalesce(s.leaderboard_public, false) then coalesce(nullif(u.nickname, ''), 'Anonymous')
    else 'Anonymous'
  end as display_name,
  case
    when coalesce(s.leaderboard_public, false) then u.avatar_url
    else null
  end as avatar_url,
  p.from_day,
  p.to_day,
  r.gpt_tokens,
  r.claude_tokens
from ranked r
cross join params p
left join public.vibeusage_user_settings s on s.user_id = r.user_id
left join public.users u on u.id = r.user_id
order by r.rank, r.user_id;

-- 4) Recreate SECURITY DEFINER functions and week-only fallback views.
drop view if exists public.vibeusage_leaderboard_week_current;
drop view if exists public.vibeusage_leaderboard_me_week_current;
drop view if exists public.vibeusage_leaderboard_day_current;
drop view if exists public.vibeusage_leaderboard_month_current;
drop view if exists public.vibeusage_leaderboard_total_current;
drop view if exists public.vibeusage_leaderboard_me_day_current;
drop view if exists public.vibeusage_leaderboard_me_month_current;
drop view if exists public.vibeusage_leaderboard_me_total_current;

drop function if exists public.vibeusage_leaderboard_period(text, integer);
drop function if exists public.vibeusage_leaderboard_me(text);

create function public.vibeusage_leaderboard_period(p_period text, p_limit integer)
returns table(
  rank integer,
  is_me boolean,
  display_name text,
  avatar_url text,
  total_tokens bigint,
  gpt_tokens bigint,
  claude_tokens bigint
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_period text;
  v_limit int;
  v_today date;
  v_from date;
  v_to date;
  v_from_ts timestamptz;
  v_to_ts timestamptz;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_period := lower(trim(coalesce(p_period, '')));
  if v_period <> 'week' then
    raise exception 'invalid period';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 1000));
  v_today := (now() at time zone 'utc')::date;
  v_from := v_today - extract(dow from v_today)::int;
  v_to := v_from + 6;
  v_from_ts := (timezone('utc', v_from::date + time '00:00'));
  v_to_ts := (timezone('utc', (v_to + 1)::date + time '00:00'));

  return query
  with totals as (
    select
      h.user_id,
      sum(
        case
          when (
            h.model like 'gpt-%'
            or h.model like 'openai/%'
            or h.model like '%/gpt-%'
          ) then h.total_tokens::bigint
          else 0::bigint
        end
      )::bigint as gpt_tokens,
      sum(
        case
          when (
            h.model like 'claude-%'
            or h.model like 'anthropic/%'
            or h.model like '%/claude-%'
          ) then coalesce(h.billable_total_tokens, h.total_tokens::bigint)
          else 0::bigint
        end
      )::bigint as claude_tokens
    from public.vibeusage_tracker_hourly h
    where h.hour_start >= v_from_ts
      and h.hour_start < v_to_ts
      and h.source <> 'canary'
      and h.source in ('codex', 'every-code', 'claude', 'opencode')
      and h.model <> 'unknown'
      and (
        h.model like 'gpt-%'
        or h.model like 'openai/%'
        or h.model like '%/gpt-%'
        or h.model like 'claude-%'
        or h.model like 'anthropic/%'
        or h.model like '%/claude-%'
      )
    group by h.user_id
  ),
  ranked as (
    select
      dense_rank() over (order by (t.gpt_tokens + t.claude_tokens) desc)::int as rank,
      t.user_id,
      (t.gpt_tokens + t.claude_tokens)::bigint as total_tokens,
      t.gpt_tokens,
      t.claude_tokens
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
    r.total_tokens,
    r.gpt_tokens,
    r.claude_tokens
  from ranked r
  left join public.vibeusage_user_settings s on s.user_id = r.user_id
  left join public.users u on u.id = r.user_id
  order by r.rank asc, r.user_id asc
  limit v_limit;
end;
$function$;

create function public.vibeusage_leaderboard_me(p_period text)
returns table(
  rank integer,
  total_tokens bigint,
  gpt_tokens bigint,
  claude_tokens bigint
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_period text;
  v_today date;
  v_from date;
  v_to date;
  v_from_ts timestamptz;
  v_to_ts timestamptz;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_period := lower(trim(coalesce(p_period, '')));
  if v_period <> 'week' then
    raise exception 'invalid period';
  end if;

  v_today := (now() at time zone 'utc')::date;
  v_from := v_today - extract(dow from v_today)::int;
  v_to := v_from + 6;
  v_from_ts := (timezone('utc', v_from::date + time '00:00'));
  v_to_ts := (timezone('utc', (v_to + 1)::date + time '00:00'));

  return query
  with totals as (
    select
      h.user_id,
      sum(
        case
          when (
            h.model like 'gpt-%'
            or h.model like 'openai/%'
            or h.model like '%/gpt-%'
          ) then h.total_tokens::bigint
          else 0::bigint
        end
      )::bigint as gpt_tokens,
      sum(
        case
          when (
            h.model like 'claude-%'
            or h.model like 'anthropic/%'
            or h.model like '%/claude-%'
          ) then coalesce(h.billable_total_tokens, h.total_tokens::bigint)
          else 0::bigint
        end
      )::bigint as claude_tokens
    from public.vibeusage_tracker_hourly h
    where h.hour_start >= v_from_ts
      and h.hour_start < v_to_ts
      and h.source <> 'canary'
      and h.source in ('codex', 'every-code', 'claude', 'opencode')
      and h.model <> 'unknown'
      and (
        h.model like 'gpt-%'
        or h.model like 'openai/%'
        or h.model like '%/gpt-%'
        or h.model like 'claude-%'
        or h.model like 'anthropic/%'
        or h.model like '%/claude-%'
      )
    group by h.user_id
  ),
  ranked as (
    select
      dense_rank() over (order by (t.gpt_tokens + t.claude_tokens) desc)::int as rank,
      t.user_id,
      (t.gpt_tokens + t.claude_tokens)::bigint as total_tokens,
      t.gpt_tokens,
      t.claude_tokens
    from totals t
  ),
  me as (
    select
      r.rank,
      r.total_tokens,
      r.gpt_tokens,
      r.claude_tokens
    from ranked r
    where r.user_id = auth.uid()
  )
  select
    me.rank,
    me.total_tokens,
    me.gpt_tokens,
    me.claude_tokens
  from me
  union all
  select
    null::int as rank,
    0::bigint as total_tokens,
    0::bigint as gpt_tokens,
    0::bigint as claude_tokens
  where not exists (select 1 from me);
end;
$function$;

create view public.vibeusage_leaderboard_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens
  from public.vibeusage_leaderboard_period('week'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

create view public.vibeusage_leaderboard_me_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens
  from public.vibeusage_leaderboard_me('week'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

grant select, insert, update, delete on public.vibeusage_leaderboard_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_me_week_current to anon, authenticated, project_admin;
