-- Weekly leaderboard categories (ALL/GPT/Claude).
-- Adds per-metric ranks to snapshots and exposes metric-aware fallback views.

-- 1) Extend snapshots with per-metric ranks.
alter table public.vibeusage_leaderboard_snapshots
  add column if not exists rank_gpt integer not null default 0,
  add column if not exists rank_claude integer not null default 0;

-- Best-effort backfill for existing snapshot rows (per generated snapshot window).
with ranked as (
  select
    s.user_id,
    s.period,
    s.from_day,
    s.to_day,
    s.generated_at,
    dense_rank() over (
      partition by s.period, s.from_day, s.to_day, s.generated_at
      order by s.gpt_tokens desc
    )::int as rank_gpt,
    dense_rank() over (
      partition by s.period, s.from_day, s.to_day, s.generated_at
      order by s.claude_tokens desc
    )::int as rank_claude
  from public.vibeusage_leaderboard_snapshots s
)
update public.vibeusage_leaderboard_snapshots s
set
  rank_gpt = r.rank_gpt,
  rank_claude = r.rank_claude
from ranked r
where s.user_id = r.user_id
  and s.period = r.period
  and s.from_day = r.from_day
  and s.to_day = r.to_day
  and s.generated_at = r.generated_at;

-- 2) Update weekly leaderboard source view to include per-metric ranks.
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
    dense_rank() over (order by t.gpt_tokens desc)::int as rank_gpt,
    dense_rank() over (order by t.claude_tokens desc)::int as rank_claude,
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
  r.claude_tokens,
  r.rank_gpt,
  r.rank_claude
from ranked r
cross join params p
left join public.vibeusage_user_settings s on s.user_id = r.user_id
left join public.users u on u.id = r.user_id
order by r.rank, r.user_id;

-- 3) Metric-aware fallback functions and views.
drop view if exists public.vibeusage_leaderboard_week_current;
drop view if exists public.vibeusage_leaderboard_me_week_current;
drop view if exists public.vibeusage_leaderboard_gpt_week_current;
drop view if exists public.vibeusage_leaderboard_me_gpt_week_current;
drop view if exists public.vibeusage_leaderboard_claude_week_current;
drop view if exists public.vibeusage_leaderboard_me_claude_week_current;

drop function if exists public.vibeusage_leaderboard_period(text, integer);
drop function if exists public.vibeusage_leaderboard_me(text);
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
  claude_tokens bigint
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
  if v_period <> 'week' then
    raise exception 'invalid period';
  end if;

  v_metric := lower(trim(coalesce(p_metric, '')));
  if v_metric not in ('all', 'gpt', 'claude') then
    raise exception 'invalid metric';
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
  filtered as (
    select
      t.user_id,
      t.gpt_tokens,
      t.claude_tokens
    from totals t
    where
      case
        when v_metric = 'gpt' then t.gpt_tokens > 0
        when v_metric = 'claude' then t.claude_tokens > 0
        else (t.gpt_tokens + t.claude_tokens) > 0
      end
  ),
  ranked as (
    select
      dense_rank() over (
        order by
          case
            when v_metric = 'gpt' then f.gpt_tokens
            when v_metric = 'claude' then f.claude_tokens
            else (f.gpt_tokens + f.claude_tokens)
          end desc
      )::int as rank,
      f.user_id,
      (f.gpt_tokens + f.claude_tokens)::bigint as total_tokens,
      f.gpt_tokens,
      f.claude_tokens
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
    r.claude_tokens
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
  claude_tokens bigint
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
  if v_period <> 'week' then
    raise exception 'invalid period';
  end if;

  v_metric := lower(trim(coalesce(p_metric, '')));
  if v_metric not in ('all', 'gpt', 'claude') then
    raise exception 'invalid metric';
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
  me_totals as (
    select
      t.user_id,
      (t.gpt_tokens + t.claude_tokens)::bigint as total_tokens,
      t.gpt_tokens,
      t.claude_tokens
    from totals t
    where t.user_id = auth.uid()
  ),
  filtered as (
    select
      t.user_id,
      t.gpt_tokens,
      t.claude_tokens
    from totals t
    where
      case
        when v_metric = 'gpt' then t.gpt_tokens > 0
        when v_metric = 'claude' then t.claude_tokens > 0
        else (t.gpt_tokens + t.claude_tokens) > 0
      end
  ),
  ranked as (
    select
      dense_rank() over (
        order by
          case
            when v_metric = 'gpt' then f.gpt_tokens
            when v_metric = 'claude' then f.claude_tokens
            else (f.gpt_tokens + f.claude_tokens)
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
    mt.claude_tokens
  from me_totals mt
  union all
  select
    null::int as rank,
    0::bigint as total_tokens,
    0::bigint as gpt_tokens,
    0::bigint as claude_tokens
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
    p.claude_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'all'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

create view public.vibeusage_leaderboard_gpt_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'gpt'::text, 1000) p(
    rank,
    is_me,
    display_name,
    avatar_url,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

create view public.vibeusage_leaderboard_claude_week_current as
  select
    p.rank,
    p.is_me,
    p.display_name,
    p.avatar_url,
    p.total_tokens,
    p.gpt_tokens,
    p.claude_tokens
  from public.vibeusage_leaderboard_period('week'::text, 'claude'::text, 1000) p(
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
  from public.vibeusage_leaderboard_me('week'::text, 'all'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

create view public.vibeusage_leaderboard_me_gpt_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'gpt'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

create view public.vibeusage_leaderboard_me_claude_week_current as
  select
    m.rank,
    m.total_tokens,
    m.gpt_tokens,
    m.claude_tokens
  from public.vibeusage_leaderboard_me('week'::text, 'claude'::text) m(
    rank,
    total_tokens,
    gpt_tokens,
    claude_tokens
  );

grant select, insert, update, delete on public.vibeusage_leaderboard_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_gpt_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_claude_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_me_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_me_gpt_week_current to anon, authenticated, project_admin;
grant select, insert, update, delete on public.vibeusage_leaderboard_me_claude_week_current to anon, authenticated, project_admin;
