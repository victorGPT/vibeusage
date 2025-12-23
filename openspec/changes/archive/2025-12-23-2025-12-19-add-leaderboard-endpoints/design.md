# Design: token-usage leaderboard backend

## Scope

IN:
- Backend-only：Database + Edge Function contract & implementation plan
- Leaderboard ranking by `total_tokens` for UTC `day / week / month / total`
- Privacy boundary (no PII, no raw logs)

OUT (MVP):
- UI layout/interaction details（Dashboard 只在后续任务接入）
- 复杂反作弊（多账号、刷 token）
- 多租户 / 组织隔离

## Module Brief

### Scope

IN:
- 提供 `GET /functions/vibescore-leaderboard`（day/week/month/total）
- 匿名默认：除非用户显式公开，否则只展示 `Anonymous`
- 响应包含 `me`（即使不在 Top N）

OUT:
- 任意历史日期筛选（不支持 `from/to`）
- 公开资料的 UI 编辑入口（后续再做）

### Interfaces

- Edge Function:
  - `GET /functions/vibescore-leaderboard?period=day|week|month|total&limit=1..100`
  - `POST /functions/vibescore-leaderboard-settings` body `{ "leaderboard_public": boolean }`
- DB:
  - `public.vibescore_leaderboard_period(period, limit)`（SECURITY DEFINER）
  - `public.vibescore_leaderboard_me(period)`（SECURITY DEFINER）
  - `public.vibescore_leaderboard_*_current` views（`.from(view)` 读取）
  - `public.vibescore_user_settings.leaderboard_public`（隐私开关，默认 false）

### Data flow & constraints

1. Browser → Dashboard → Edge Function（携带 `user_jwt`）
2. Edge Function 校验 `period/limit` 与登录态
3. Edge Function 查询只读 views（views 内调用 SECURITY DEFINER 函数做跨用户聚合）
4. Edge Function 生成 privacy-safe JSON（不返回 `user_id`，bigint 以 string 返回）

信任边界：
- 跨用户聚合只允许在 DB 的 SECURITY DEFINER 层完成，并且只输出安全字段
- Edge Function 层不持有 service role key（避免 secret 缺失导致不可用）

### Non-negotiables

- 不返回 email / device / token_timestamp / 任意日志内容
- 不返回 `user_id`
- 必须登录（`auth.getCurrentUser()` 成功）
- `limit` 强制上限（建议 100）

### Test strategy

- 单测：edge function 参数校验与输出 contract（含 `me`、bigint string）
- 单测：UTC window 计算（Sunday start；含 total）
- DB：给出可重复的 SQL 验证步骤（手工或脚本）

### Milestones

1. DB objects 创建完成（functions/views/settings + RLS）
2. Edge Function 返回 contract JSON（含 `me`）
3. 测试通过（`npm test`）
4. 最小 smoke（可选）：用真实 JWT 验证返回结构（手测）

### Plan B triggers

- 查询延迟明显上升（例如 P95 > 500ms）或 DB CPU 占用显著增长
- `vibescore_tracker_events` 行数增长导致 leaderboard 计算不可接受

### Upgrade plan (disabled by default)

- 引入物化聚合表（daily/weekly/monthly）并在 ingest 后异步刷新
- 或生成 leaderboard snapshot（cron），降低实时聚合成本

## Data sources

- `public.vibescore_tracker_events`（事实来源，含 RLS）
- `public.vibescore_tracker_daily`（UTC 日聚合 view）
- `public.users`（公开 profile：`nickname`, `avatar_url`；目前对 `public` 可读）

## API contract (Edge Function)

### Endpoint

`GET /functions/vibescore-leaderboard`

### Endpoint (settings)

`POST /functions/vibescore-leaderboard-settings`

### Auth

- `Authorization: Bearer <user_jwt>`
- 函数内用 `auth.getCurrentUser()` 验证登录态（同时用于未来输出 `me`）

### Body (settings)

```json
{ "leaderboard_public": true }
```

### Response (settings)

```json
{ "leaderboard_public": true, "updated_at": "2025-12-19T12:00:00.000Z" }
```

### Query params

- `period`: `day | week | month | total`（required）
- `limit`: `1..100`（optional, default `20`）

约束：
- 仅支持“当前”窗口（Calendar），不支持历史 `to=YYYY-MM-DD`
- 仅支持 UTC，周起始固定为 Sunday（`week_starts_on=sun`）
  - `period=total` 的 `from/to` 推荐为：`from=system_earliest_day`，`to=today_utc`（仍可调整）

### Response (draft)

```json
{
  "period": "week",
  "from": "2025-12-14",
  "to": "2025-12-20",
  "generated_at": "2025-12-19T12:00:00.000Z",
  "entries": [
    {
      "rank": 1,
      "is_me": false,
      "display_name": "Anonymous",
      "avatar_url": null,
      "total_tokens": "123456"
    }
  ],
  "me": { "rank": 123, "total_tokens": "456" }
}
```

Notes:
- `total_tokens` 用 string 返回（bigint 安全）
- 不返回 `user_id`（避免跨表关联）；仅在榜单条目里提供 `is_me`（当前用户可见）
- 匿名策略：默认 `display_name="Anonymous"`（不加序号）；仅当用户明确公开时，才返回昵称/头像
- `me`：即使用户不在 Top N，仍返回当前用户的 `rank/total_tokens`（若无数据：`rank=null,total_tokens="0"`）

## Recommended backend approach (no service role key)

### Principle

把“跨用户聚合读取”固定在 DB 的 `SECURITY DEFINER` 函数里：
- 函数运行在 definer 权限下，绕过 RLS，完成聚合与排序
- 对外只暴露安全字段（rank/nickname/avatar/totals）
- Edge Function 只做：参数校验 → 调用只读 view → 输出 JSON

### Database objects (proposal)

1. SQL function（核心）
   - `public.vibescore_leaderboard_period(p_period text, p_limit int)`
   - `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
   - Guard：
     - `auth.uid() is not null`（避免匿名访问；若将来要公开再调整）
     - `p_limit` clamp 到 `1..100`
   - 只输出（privacy-safe）：`rank, is_me, display_name, avatar_url, total_tokens`

   - 配套 SQL function（me）
     - `public.vibescore_leaderboard_me(p_period text)`
     - 输出：`rank, total_tokens`

   - 配套 SQL function（meta）
     - `public.vibescore_leaderboard_system_earliest_day()`
     - 输出：`date`（用于 `period=total` 的 `from`）

2. Views（便于 PostgREST/SDK `.from()` 查询）
   - `public.vibescore_leaderboard_day_current`
   - `public.vibescore_leaderboard_week_current`
   - `public.vibescore_leaderboard_month_current`
   - `public.vibescore_leaderboard_total_current`
   - `public.vibescore_leaderboard_meta_total_current`（提供 `period=total` 的 `from/to`：system earliest day + today）
   - `public.vibescore_leaderboard_me_day_current`
   - `public.vibescore_leaderboard_me_week_current`
   - `public.vibescore_leaderboard_me_month_current`
   - `public.vibescore_leaderboard_me_total_current`

这些 views 只是函数调用的薄封装（避免依赖 RPC）：
- entries views：调用 `vibescore_leaderboard_period('<period>', 100)`（view 内固定上限 100）
- me views：调用 `vibescore_leaderboard_me('<period>')`

Edge Function 侧通过 `.order('rank')` + `.limit(limit)` 做最终裁剪（`limit <= 100`）。

> 这样 Edge Function 不需要 RPC 能力，也不依赖 service role key。

3. User settings（用于匿名/公开）
   - 新表：`public.vibescore_user_settings`
     - `user_id uuid primary key references public.users(id)`
     - `leaderboard_public boolean not null default false`
   - RLS：用户仅能读写自己的 row
   - 在 leaderboard 查询里用 `left join` + `coalesce(leaderboard_public,false)`，无需预先为每个用户插入 row

### Indexing / performance

Leaderboard 查询是“跨用户 + 时间范围”聚合，现有索引 `(user_id, token_timestamp)` 对该类查询不理想。

建议新增索引（候选）：
- `create index ... on public.vibescore_tracker_events (token_timestamp desc, user_id);`

后续规模变大时的升级路径（Plan B）：
- 引入物化聚合表（daily/weekly/monthly），在 ingest 后异步刷新
- 或增加定时任务/cron 生成 leaderboard snapshot（减少实时计算）

## Alternative approach (requires service role key)

Edge Function 使用 `INSFORGE_SERVICE_ROLE_KEY` 创建 service client：
- 直接从 `vibescore_tracker_daily`（或 events）读取跨用户数据
- 在 JS 里做 group-by / rank

优点：实现简单、可支持 `to=YYYY-MM-DD`
缺点：依赖运行时 secret 注入（我们曾经踩过缺失问题），且 JS 聚合在规模大时会吃资源

## Security & privacy

Non-negotiables:
- 不返回 email / device_id / 细粒度 token_timestamp / 任何日志内容
- 不返回 `user_id`
- `limit` 有硬上限，避免被滥用做全量枚举

可选项（后续再议）：
- 是否需要额外返回 `me.percentile` / `me.total_users`（用于 UI 文案）

## Test strategy

- 单测：period window 计算（day/week/month/total 的 from/to）
- Edge function 单测：参数校验、limit clamp、输出 contract（bigint string）
- 数据库层（若做 SQL function）：至少提供可重复的手工 SQL 验证步骤（或脚本）
