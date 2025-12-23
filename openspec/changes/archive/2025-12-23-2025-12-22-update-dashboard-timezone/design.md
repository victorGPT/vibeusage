# Design: Dashboard timezone-aware aggregates (browser auto)

## Context
- 当前 Dashboard 与 usage API 以 UTC 日切分。
- 用户对“今天/本周/本月”的理解是本地时区语义。
- 需求限定：仅 Dashboard 使用浏览器时区；Leaderboard 与 CLI 仍保持 UTC。

## Goals / Non-Goals
**Goals**
- Dashboard 默认以浏览器时区聚合（IANA 优先，offset 兜底）。
- UI 明确标识当前时区，避免误读。
- 保持无时区参数时的 UTC 兼容行为。

**Non-Goals**
- 不改动 Leaderboard（继续 UTC）。
- 不引入数据库新视图/SQL RPC。
- 不改变 ingest/事件写入逻辑。

## Decisions
- **时区来源**：前端读取 `Intl.DateTimeFormat().resolvedOptions().timeZone`；若不可用则发送 `tz_offset_minutes`。
- **后端聚合路径**：当存在时区参数且非 UTC 时，直接按事件表在 Edge 端聚合；UTC 情况保留既有 view 路径以避免性能回退。
- **日/月边界**：用本地日历日（含 DST），以本地 00:00 为日切点。

## Alternatives considered
1) **客户端二次换算 UTC 日聚合**：无法从 UTC 日聚合可靠还原本地日，且 DST 会造成偏差 → 放弃。
2) **数据库侧 SQL 聚合 + AT TIME ZONE**：需要新增 RPC/视图或更复杂的 SQL，当前改动范围过大 → 放弃。

## Risks / Trade-offs
- **性能风险**：本地时区下从事件表聚合可能更重。
  - **缓解**：仅在 `tz` 存在且非 UTC 时启用；前端缓存保持。
- **DST 边界复杂度**：本地日可能 23/25 小时。
  - **缓解**：按本地小时桶聚合，允许重复/缺失小时（行业通用做法）。

## Migration Plan
1. 添加共享时区工具函数与本地日范围计算。
2. 更新 usage endpoints 接受 `tz`/`tz_offset_minutes` 并聚合本地日/月/小时。
3. 前端获取浏览器时区并透传；修正文案与 Tooltip。
4. 更新文档并运行构建与验证。

## Open Questions
- 是否需要在 UI 上显示完整 IANA（可能较长）或仅显示 `UTC±HH:MM`？
