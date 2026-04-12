begin;

-- Drop dependent leaderboard source views that reference vibeusage_tracker_hourly.total_tokens.
drop view if exists public.vibeusage_leaderboard_source_week;
drop view if exists public.vibeusage_leaderboard_source_month;
drop view if exists public.vibeusage_leaderboard_source_total;

-- Ensure Hermes-scale per-bucket token counts can land without integer overflow.

alter table public.vibeusage_tracker_hourly
  alter column input_tokens type bigint using input_tokens::bigint,
  alter column cached_input_tokens type bigint using cached_input_tokens::bigint,
  alter column output_tokens type bigint using output_tokens::bigint,
  alter column reasoning_output_tokens type bigint using reasoning_output_tokens::bigint,
  alter column total_tokens type bigint using total_tokens::bigint,
  alter column billable_total_tokens type bigint using billable_total_tokens::bigint;

-- Recreate the dropped views exactly as defined in the leaderboard source scope rollout.
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

commit;
