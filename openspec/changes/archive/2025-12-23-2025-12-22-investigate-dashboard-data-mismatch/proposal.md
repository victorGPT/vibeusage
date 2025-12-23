# Change: Investigate dashboard data fetch failures and timezone mismatch

## 结论
前端出现“拿不到后端数据”和“使用天数缺失”的问题，同时存在时区显示与后端聚合可能不一致的风险。需要一次可重复的端到端排查与证据采集，并明确时区基准的 UI 呈现与后端响应语义，避免用户误解和数据错位。

## 现状发现（代码审阅）
- 后端：`getUsageTimeZoneContext` 当前固定返回 `normalizeTimeZone()`，忽略 `tz`/`tz_offset_minutes`（Phase 1: avoid partial aggregates），因此 usage endpoints 实际按 UTC 聚合。
- 前端：`getRangeForPeriod` 基于本地日期生成 `from/to`，UI 标注 `Local time (UTC±HH:MM)`；请求仍会携带 `tz`/`tz_offset_minutes`。
- 结果：本地日历范围 + UTC 聚合 → 本地“今天/本周/本月”可能落在 UTC 前一天，出现 `days=0` / `totals=0` / daily 仅返回前一日的视觉错位。

## 决策点
- 方案 A（止血，低风险）：前端暂时对齐 UTC（范围、标签、提示），明确“以 UTC 聚合”为准。
- 方案 B（根治，中风险）：推进 `2025-12-22-update-dashboard-timezone`，在后端安全启用时区聚合，并同步 UI 文案与 API 契约。

## Why
- 前端无法稳定获取后端数据（用户可见问题）。
- “用户使用天数”字段缺失或异常，影响核心指标可信度。
- 时区显示可能与后端聚合基准不一致，导致边界错位与误判。

## What Changes
- 建立一套可重复的排查步骤（前端网络请求、后端响应、字段对齐、时区参数）。
- 明确 dashboard 与 usage endpoints 的时区基准与呈现方式。
- 如确认错位，定义修复方案与验收标准。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/**`, `insforge-src/functions/**`
- 风险：若时区与聚合路径不一致，可能导致跨日/跨周统计错误与用户误解
