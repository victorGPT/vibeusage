-- Leaderboard follow-up: source scope + Other bucket (A1 + B1)
--
-- A1: leaderboard source scope = all sources except canary
-- B1: unknown/unclassified models are included in Other bucket
--
-- Outcomes:
-- - snapshots include other_tokens + rank_other
-- - total_tokens = gpt_tokens + claude_tokens + other_tokens
-- - metric=other supported in SQL fallback functions/views

-- 0) Snapshot schema alignment for refresh/read paths.
alter table public.vibeusage_leaderboard_snapshots
  add column if not exists other_tokens bigint not null default 0;

alter table public.vibeusage_leaderboard_snapshots
  add column if not exists rank_other integer;

update public.vibeusage_leaderboard_snapshots
set
  other_tokens = greatest(
    coalesce(other_tokens, 0::bigint),
    greatest(coalesce(total_tokens, 0::bigint) - coalesce(gpt_tokens, 0::bigint) - coalesce(claude_tokens, 0::bigint), 0::bigint)
  ),
  rank_other = coalesce(rank_other, rank)
where true;

-- 1) Source views used by snapshot refresh (week/month/total).
-- Scope: include all non-canary sources (no source whitelist).
-- Bucketing:
--   gpt    -> model matches GPT/OpenAI patterns
--   claude -> model matches Claude/Anthropic patterns
--   other  -> all remaining models, including unknown

create or replace view public.vibeusage_leaderboard_source_week as
with base as (
  select (now() at time zone 'utc')::date as today
),
params as (
  select
    (base.today - extract(dow from base.today)::int) as from_day,
    (base.today - extract(dow from base.today)::int + 6) as to_day
  from base
),
classified as (
  select
    h.user_id,
    coalesce(h.billable_total_tokens, h.total_tokens::bigint)::bigint as row_tokens,
    (
      h.model like 'gpt-%'
      or h.model like 'openai/%'
      or h.model like '%/gpt-%'
    ) as is_gpt,
    (
      h.model like 'claude-%'
      or h.model like 'anthropic/%'
      or h.model like '%/claude-%'
    ) as is_claude
  from public.vibeusage_tracker_hourly h
  join params p
    on h.hour_start >= (p.from_day::timestamp at time zone 'utc')
   and h.hour_start < ((p.to_day + 1)::timestamp at time zone 'utc')
  where h.source <> 'canary'
),
totals as (
  select
    c.user_id,
    sum(case when c.is_gpt then c.row_tokens else 0::bigint end)::bigint as gpt_tokens,
    sum(case when c.is_claude then c.row_tokens else 0::bigint end)::bigint as claude_tokens,
    sum(case when (not c.is_gpt and not c.is_claude) then c.row_tokens else 0::bigint end)::bigint as other_tokens
  from classified c
  group by c.user_id
),
ranked as (
  select
    dense_rank() over (order by (t.gpt_tokens + t.claude_tokens + t.other_tokens) desc)::int as rank,
    dense_rank() over (order by t.gpt_tokens desc)::int as rank_gpt,
    dense_rank() over (order by t.claude_tokens desc)::int as rank_claude,
    dense_rank() over (order by t.other_tokens desc)::int as rank_other,
    t.user_id,
    (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens,
    t.gpt_tokens,
    t.claude_tokens,
    t.other_tokens
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
  r.claude_tokens,
  r.other_tokens,
  r.rank_gpt,
  r.rank_claude,
  r.rank_other
from ranked r
cross join params p
left join public.vibeusage_user_settings s on s.user_id = r.user_id
left join public.users u on u.id = r.user_id
order by r.rank, r.user_id;

create or replace view public.vibeusage_leaderboard_source_month as
with base as (
  select (now() at time zone 'utc')::date as today
),
params as (
  select
    date_trunc('month', base.today)::date as from_day,
    (date_trunc('month', base.today)::date + interval '1 month' - interval '1 day')::date as to_day
  from base
),
classified as (
  select
    h.user_id,
    coalesce(h.billable_total_tokens, h.total_tokens::bigint)::bigint as row_tokens,
    (
      h.model like 'gpt-%'
      or h.model like 'openai/%'
      or h.model like '%/gpt-%'
    ) as is_gpt,
    (
      h.model like 'claude-%'
      or h.model like 'anthropic/%'
      or h.model like '%/claude-%'
    ) as is_claude
  from public.vibeusage_tracker_hourly h
  join params p
    on h.hour_start >= (p.from_day::timestamp at time zone 'utc')
   and h.hour_start < ((p.to_day + 1)::timestamp at time zone 'utc')
  where h.source <> 'canary'
),
totals as (
  select
    c.user_id,
    sum(case when c.is_gpt then c.row_tokens else 0::bigint end)::bigint as gpt_tokens,
    sum(case when c.is_claude then c.row_tokens else 0::bigint end)::bigint as claude_tokens,
    sum(case when (not c.is_gpt and not c.is_claude) then c.row_tokens else 0::bigint end)::bigint as other_tokens
  from classified c
  group by c.user_id
),
ranked as (
  select
    dense_rank() over (order by (t.gpt_tokens + t.claude_tokens + t.other_tokens) desc)::int as rank,
    dense_rank() over (order by t.gpt_tokens desc)::int as rank_gpt,
    dense_rank() over (order by t.claude_tokens desc)::int as rank_claude,
    dense_rank() over (order by t.other_tokens desc)::int as rank_other,
    t.user_id,
    (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens,
    t.gpt_tokens,
    t.claude_tokens,
    t.other_tokens
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
  r.claude_tokens,
  r.other_tokens,
  r.rank_gpt,
  r.rank_claude,
  r.rank_other
from ranked r
cross join params p
left join public.vibeusage_user_settings s on s.user_id = r.user_id
left join public.users u on u.id = r.user_id
order by r.rank, r.user_id;

create or replace view public.vibeusage_leaderboard_source_total as
with params as (
  select
    '1970-01-01'::date as from_day,
    '9999-12-31'::date as to_day
),
classified as (
  select
    h.user_id,
    coalesce(h.billable_total_tokens, h.total_tokens::bigint)::bigint as row_tokens,
    (
      h.model like 'gpt-%'
      or h.model like 'openai/%'
      or h.model like '%/gpt-%'
    ) as is_gpt,
    (
      h.model like 'claude-%'
      or h.model like 'anthropic/%'
      or h.model like '%/claude-%'
    ) as is_claude
  from public.vibeusage_tracker_hourly h
  where h.source <> 'canary'
),
totals as (
  select
    c.user_id,
    sum(case when c.is_gpt then c.row_tokens else 0::bigint end)::bigint as gpt_tokens,
    sum(case when c.is_claude then c.row_tokens else 0::bigint end)::bigint as claude_tokens,
    sum(case when (not c.is_gpt and not c.is_claude) then c.row_tokens else 0::bigint end)::bigint as other_tokens
  from classified c
  group by c.user_id
),
ranked as (
  select
    dense_rank() over (order by (t.gpt_tokens + t.claude_tokens + t.other_tokens) desc)::int as rank,
    dense_rank() over (order by t.gpt_tokens desc)::int as rank_gpt,
    dense_rank() over (order by t.claude_tokens desc)::int as rank_claude,
    dense_rank() over (order by t.other_tokens desc)::int as rank_other,
    t.user_id,
    (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens,
    t.gpt_tokens,
    t.claude_tokens,
    t.other_tokens
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
  r.claude_tokens,
  r.other_tokens,
  r.rank_gpt,
  r.rank_claude,
  r.rank_other
from ranked r
cross join params p
left join public.vibeusage_user_settings s on s.user_id = r.user_id
left join public.users u on u.id = r.user_id
order by r.rank, r.user_id;

-- 2) Recreate fallback views + functions to support metric=other.

drop view if exists public.vibeusage_leaderboard_week_current;
drop view if exists public.vibeusage_leaderboard_gpt_week_current;
drop view if exists public.vibeusage_leaderboard_claude_week_current;
drop view if exists public.vibeusage_leaderboard_other_week_current;
drop view if exists public.vibeusage_leaderboard_me_week_current;
drop view if exists public.vibeusage_leaderboard_me_gpt_week_current;
drop view if exists public.vibeusage_leaderboard_me_claude_week_current;
drop view if exists public.vibeusage_leaderboard_me_other_week_current;

drop view if exists public.vibeusage_leaderboard_month_current;
drop view if exists public.vibeusage_leaderboard_gpt_month_current;
drop view if exists public.vibeusage_leaderboard_claude_month_current;
drop view if exists public.vibeusage_leaderboard_other_month_current;
drop view if exists public.vibeusage_leaderboard_me_month_current;
drop view if exists public.vibeusage_leaderboard_me_gpt_month_current;
drop view if exists public.vibeusage_leaderboard_me_claude_month_current;
drop view if exists public.vibeusage_leaderboard_me_other_month_current;

drop view if exists public.vibeusage_leaderboard_total_current;
drop view if exists public.vibeusage_leaderboard_gpt_total_current;
drop view if exists public.vibeusage_leaderboard_claude_total_current;
drop view if exists public.vibeusage_leaderboard_other_total_current;
drop view if exists public.vibeusage_leaderboard_me_total_current;
drop view if exists public.vibeusage_leaderboard_me_gpt_total_current;
drop view if exists public.vibeusage_leaderboard_me_claude_total_current;
drop view if exists public.vibeusage_leaderboard_me_other_total_current;

drop function if exists public.vibeusage_leaderboard_period(text, text, integer);
drop function if exists public.vibeusage_leaderboard_me(text, text);

create function public.vibeusage_leaderboard_period(p_period text, p_metric text, p_limit integer)
returns table(
  rank integer,
  is_me boolean,
  display_name text,
  avatar_url text,
  total_tokens bigint,
  gpt_tokens bigint,
  claude_tokens bigint,
  other_tokens bigint
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_period text;
  v_metric text;
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
  if v_period not in ('week', 'month', 'total') then
    raise exception 'invalid period';
  end if;

  v_metric := lower(trim(coalesce(p_metric, '')));
  if v_metric not in ('all', 'gpt', 'claude', 'other') then
    raise exception 'invalid metric';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 1000));
  v_today := (now() at time zone 'utc')::date;

  if v_period = 'week' then
    v_from := v_today - extract(dow from v_today)::int;
    v_to := v_from + 6;
  elsif v_period = 'month' then
    v_from := date_trunc('month', v_today)::date;
    v_to := (date_trunc('month', v_today)::date + interval '1 month' - interval '1 day')::date;
  else
    v_from := '1970-01-01'::date;
    v_to := '9999-12-31'::date;
  end if;

  v_from_ts := (v_from::timestamp at time zone 'utc');
  v_to_ts := ((v_to + 1)::timestamp at time zone 'utc');

  return query
  with classified as (
    select
      h.user_id,
      coalesce(h.billable_total_tokens, h.total_tokens::bigint)::bigint as row_tokens,
      (
        h.model like 'gpt-%'
        or h.model like 'openai/%'
        or h.model like '%/gpt-%'
      ) as is_gpt,
      (
        h.model like 'claude-%'
        or h.model like 'anthropic/%'
        or h.model like '%/claude-%'
      ) as is_claude
    from public.vibeusage_tracker_hourly h
    where h.hour_start >= v_from_ts
      and h.hour_start < v_to_ts
      and h.source <> 'canary'
  ),
  totals as (
    select
      c.user_id,
      sum(case when c.is_gpt then c.row_tokens else 0::bigint end)::bigint as gpt_tokens,
      sum(case when c.is_claude then c.row_tokens else 0::bigint end)::bigint as claude_tokens,
      sum(case when (not c.is_gpt and not c.is_claude) then c.row_tokens else 0::bigint end)::bigint as other_tokens
    from classified c
    group by c.user_id
  ),
  filtered as (
    select
      t.user_id,
      t.gpt_tokens,
      t.claude_tokens,
      t.other_tokens,
      (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens
    from totals t
    where
      case
        when v_metric = 'gpt' then t.gpt_tokens > 0
        when v_metric = 'claude' then t.claude_tokens > 0
        when v_metric = 'other' then t.other_tokens > 0
        else (t.gpt_tokens + t.claude_tokens + t.other_tokens) > 0
      end
  ),
  ranked as (
    select
      dense_rank() over (
        order by
          case
            when v_metric = 'gpt' then f.gpt_tokens
            when v_metric = 'claude' then f.claude_tokens
            when v_metric = 'other' then f.other_tokens
            else f.total_tokens
          end desc
      )::int as rank,
      f.user_id,
      f.total_tokens,
      f.gpt_tokens,
      f.claude_tokens,
      f.other_tokens
    from filtered f
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
    r.claude_tokens,
    r.other_tokens
  from ranked r
  left join public.vibeusage_user_settings s on s.user_id = r.user_id
  left join public.users u on u.id = r.user_id
  order by r.rank asc, r.user_id asc
  limit v_limit;
end;
$function$;

create function public.vibeusage_leaderboard_me(p_period text, p_metric text)
returns table(
  rank integer,
  total_tokens bigint,
  gpt_tokens bigint,
  claude_tokens bigint,
  other_tokens bigint
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_period text;
  v_metric text;
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
  if v_period not in ('week', 'month', 'total') then
    raise exception 'invalid period';
  end if;

  v_metric := lower(trim(coalesce(p_metric, '')));
  if v_metric not in ('all', 'gpt', 'claude', 'other') then
    raise exception 'invalid metric';
  end if;

  v_today := (now() at time zone 'utc')::date;

  if v_period = 'week' then
    v_from := v_today - extract(dow from v_today)::int;
    v_to := v_from + 6;
  elsif v_period = 'month' then
    v_from := date_trunc('month', v_today)::date;
    v_to := (date_trunc('month', v_today)::date + interval '1 month' - interval '1 day')::date;
  else
    v_from := '1970-01-01'::date;
    v_to := '9999-12-31'::date;
  end if;

  v_from_ts := (v_from::timestamp at time zone 'utc');
  v_to_ts := ((v_to + 1)::timestamp at time zone 'utc');

  return query
  with classified as (
    select
      h.user_id,
      coalesce(h.billable_total_tokens, h.total_tokens::bigint)::bigint as row_tokens,
      (
        h.model like 'gpt-%'
        or h.model like 'openai/%'
        or h.model like '%/gpt-%'
      ) as is_gpt,
      (
        h.model like 'claude-%'
        or h.model like 'anthropic/%'
        or h.model like '%/claude-%'
      ) as is_claude
    from public.vibeusage_tracker_hourly h
    where h.hour_start >= v_from_ts
      and h.hour_start < v_to_ts
      and h.source <> 'canary'
  ),
  totals as (
    select
      c.user_id,
      sum(case when c.is_gpt then c.row_tokens else 0::bigint end)::bigint as gpt_tokens,
      sum(case when c.is_claude then c.row_tokens else 0::bigint end)::bigint as claude_tokens,
      sum(case when (not c.is_gpt and not c.is_claude) then c.row_tokens else 0::bigint end)::bigint as other_tokens
    from classified c
    group by c.user_id
  ),
  me_totals as (
    select
      t.user_id,
      (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens,
      t.gpt_tokens,
      t.claude_tokens,
      t.other_tokens
    from totals t
    where t.user_id = auth.uid()
  ),
  filtered as (
    select
      t.user_id,
      t.gpt_tokens,
      t.claude_tokens,
      t.other_tokens,
      (t.gpt_tokens + t.claude_tokens + t.other_tokens)::bigint as total_tokens
    from totals t
    where
      case
        when v_metric = 'gpt' then t.gpt_tokens > 0
        when v_metric = 'claude' then t.claude_tokens > 0
        when v_metric = 'other' then t.other_tokens > 0
        else (t.gpt_tokens + t.claude_tokens + t.other_tokens) > 0
      end
  ),
  ranked as (
    select
      dense_rank() over (
        order by
          case
            when v_metric = 'gpt' then f.gpt_tokens
            when v_metric = 'claude' then f.claude_tokens
            when v_metric = 'other' then f.other_tokens
            else f.total_tokens
          end desc
      )::int as rank,
      f.user_id
    from filtered f
  ),
  me_rank as (
    select r.rank
    from ranked r
    where r.user_id = auth.uid()
  )
  select
    (select rank from me_rank) as rank,
    mt.total_tokens,
    mt.gpt_tokens,
    mt.claude_tokens,
    mt.other_tokens
  from me_totals mt
  union all
  select
    null::int as rank,
    0::bigint as total_tokens,
    0::bigint as gpt_tokens,
    0::bigint as claude_tokens,
    0::bigint as other_tokens
  where not exists (select 1 from me_totals);
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
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'all'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_gpt_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'gpt'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_claude_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'claude'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_other_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'other'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'all'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_gpt_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'gpt'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_claude_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'claude'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_other_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'other'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_month_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('month'::text, 'all'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_gpt_month_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('month'::text, 'gpt'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_claude_month_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('month'::text, 'claude'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_other_month_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('month'::text, 'other'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_month_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('month'::text, 'all'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_gpt_month_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('month'::text, 'gpt'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_claude_month_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('month'::text, 'claude'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_other_month_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('month'::text, 'other'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_total_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('total'::text, 'all'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_gpt_total_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('total'::text, 'gpt'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_claude_total_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('total'::text, 'claude'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_other_total_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens,
    p.other_tokens
  from public.vibeusage_leaderboard_period('total'::text, 'other'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_total_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('total'::text, 'all'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_gpt_total_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('total'::text, 'gpt'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_claude_total_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('total'::text, 'claude'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

create view public.vibeusage_leaderboard_me_other_total_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens,
    m.other_tokens
  from public.vibeusage_leaderboard_me('total'::text, 'other'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens,
    other_tokens
  );

grant select on public.vibeusage_leaderboard_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_gpt_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_claude_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_other_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_gpt_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_claude_week_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_other_week_current to anon, authenticated, project_admin;

grant select on public.vibeusage_leaderboard_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_gpt_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_claude_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_other_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_gpt_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_claude_month_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_other_month_current to anon, authenticated, project_admin;

grant select on public.vibeusage_leaderboard_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_gpt_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_claude_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_other_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_gpt_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_claude_total_current to anon, authenticated, project_admin;
grant select on public.vibeusage_leaderboard_me_other_total_current to anon, authenticated, project_admin;
