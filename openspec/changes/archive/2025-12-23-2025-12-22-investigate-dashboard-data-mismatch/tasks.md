# 2025-12-22-investigate-dashboard-data-mismatch 任务清单

## 0. 代码核查
- [x] 0.1 核对时区参数链路（前端 `tz`/`tz_offset_minutes` → 后端 `getUsageTimeZoneContext` 实际忽略）。

## 1. 复现与取证
- [x] 1.1 复现“前端拿不到数据”的页面与时间（记录浏览器与账号）。
- [x] 1.2 记录 Network 请求：`vibescore-usage-summary`/`daily`/`hourly`/`heatmap`/`leaderboard` 的 URL、参数、状态码、响应体。
- [x] 1.3 记录前端控制台错误与重试行为（含时间戳）。

## 2. 后端对照验证
- [x] 2.1 用同一用户 JWT 直连调用 usage endpoints（包含/不包含 `tz` 参数），对比响应字段（`days`、`data`、`totals`）。
- [x] 2.2 对照数据库视图/表的可用性（`vibescore_tracker_daily`、`events`）与是否返回空集。
- [x] 2.3 若返回 401/403/500，记录 `status` 与 `error`/`code`。

## 3. 时区一致性排查
- [x] 3.1 确认 Dashboard 是否发送 `tz` 或 `tz_offset_minutes`（IANA/offset）。
- [x] 3.2 确认后端是否按时区聚合（UTC vs 本地日/月/小时路径）。
- [x] 3.3 核对 UI 文案与标签是否标示时区基准（UTC 或 local）。

## 4. 结论与修复建议
- [x] 4.1 明确根因（前端参数、后端响应、权限、时区错位）。
- [x] 4.2 输出修复方案与验收标准（含需要的 spec 更新/测试）。

## 证据记录
- 复现时间：2025-12-22T18:07:00Z（Chrome DevTools MCP；账号=REDACTED）
- 认证方式：`/auth/callback?access_token=REDACTED`
- 请求与响应概览（本次未触发 `hourly`/`leaderboard`）：
  - `GET /functions/vibescore-usage-daily?from=2025-12-22&to=2025-12-28&tz=Asia/Shanghai&tz_offset_minutes=480` → 200，`data` 仅含 `2025-12-22`
  - `GET /functions/vibescore-usage-heatmap?weeks=52&to=2025-12-23&week_starts_on=sun&tz=Asia/Shanghai&tz_offset_minutes=480` → 200，`active_days=33`，`streak_days=0`
  - `GET /functions/vibescore-usage-summary?from=2025-12-23&to=2025-12-23` → 200，`days=0`，`totals=0`
- UI 现象：`IDENTITY_CORE` 显示 `STREAK 0_DAYS`；每日表格 `2025-12-23` 显示 `未同步`；时区标签为 `LOCAL TIME (UTC+08:00)`
- 代码现状：`insforge-src/shared/date.js` 内 `getUsageTimeZoneContext` 处于 Phase 1，直接返回 `normalizeTimeZone()`，忽略 `tz`/`tz_offset_minutes`，usage endpoints 实际走 UTC 聚合。
- 复核时间：2025-12-22T21:06:40Z（本地 2025-12-23 05:06 +08）
- 直连调用（线上，同一 `user_jwt`，基准区间 `from=2025-12-17` → `to=2025-12-23`）：
  - `GET /functions/vibescore-usage-summary`（无 `tz`）→ 200，`days=6`
  - `GET /functions/vibescore-usage-summary`（`tz=Asia/Shanghai&tz_offset_minutes=480`）→ 200，`days=7`
  - `GET /functions/vibescore-usage-daily`（无 `tz`）→ 200，`count=6`，`last=2025-12-22`
  - `GET /functions/vibescore-usage-daily`（带 `tz`）→ 200，`count=7`，`last=2025-12-23`
  - `GET /functions/vibescore-usage-hourly`（无 `tz`）→ 200，`first=2025-12-22T00:00:00`
  - `GET /functions/vibescore-usage-hourly`（带 `tz`）→ 200，`first=2025-12-23T00:00:00`
  - `GET /functions/vibescore-usage-heatmap`（无 `tz`）→ 200，`active_days=33`，`streak_days=0`
  - `GET /functions/vibescore-usage-heatmap`（带 `tz`）→ 200，`active_days=35`，`streak_days=18`
  - `GET /functions/vibescore-leaderboard?period=day` → 200（`entries=2`）
- 控制台错误：2025-12-23 04:48（用户截图）`ReferenceError: Cannot access 'A' before initialization`；用户反馈已修复，当前未复现。
- 数据库对照（线上，`user_id=7c3bb5f6-1fed-46d7-80d5-3d1d6da49651`）：
  - `vibescore_tracker_daily`：`day_rows=6`，`min_day=2025-12-17`，`max_day=2025-12-22`
  - `vibescore_tracker_events`：`event_rows=7838`，`distinct_days=6`，`min_ts=2025-12-17T03:16:35Z`，`max_ts=2025-12-22T17:15:57Z`

## 结论
- 根因：历史上前端以本地日历范围请求，但后端在 Phase 1 忽略 `tz`/`tz_offset_minutes`，实际按 UTC 聚合；在跨日边界出现“少一天/错一天/连续天数归零”等错位。
- 现状：后端已能按 `tz` 聚合（证据显示同一区间有/无 `tz` 返回显著差异），前端当前仍显示 `Local time (UTC±HH:MM)` 的范围标签；趋势图已去掉时区后缀。
- 数据对照：数据库 `daily/events` 最近一日停留在 `2025-12-22`（UTC），与“带 `tz` 时可展示 `2025-12-23`”形成边界错位证据。
- 附带问题：前端黑屏报错已由用户侧修复，未在本次复核中重现。

## 修复建议与验收标准
- 建议：保持“前端按本地日历算 `from/to` + 后端按 `tz` 聚合”这一一致口径；UI 明确“Local time (UTC±HH:MM)”为基准（趋势图可继续不显示时区标签以避免重复）。
- 验收（同一账号）：
  - `summary/daily/hourly/heatmap` 在带 `tz` 时，`days`/`count` 与区间长度一致，`hourly` 首日与本地“今天”一致。
  - `heatmap` 的 `streak_days` 与本地日历连续天数一致（>0 时不应被 UTC 偏移清零）。
  - 前端页面不再出现“当日未同步/天数为 0”的错位（在已有数据前提下）。

## 5. 实施记录
- [x] 5.1 采用方案 B（时区聚合 + 本地日历口径），已由变更 `2025-12-22-update-dashboard-timezone` 实施并部署。
- [x] 5.2 UI 时区标识与请求参数一致：UsagePanel/Heatmap/页脚显示 `Local time (UTC±HH:MM)`；Trend 组件保持去标注以避免重复。
