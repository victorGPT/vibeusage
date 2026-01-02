# Change: Usage Summary DB Aggregation (No Lag)

## Why
Insforge2 曾出现数据库内存爆掉导致服务不可用。当前 `vibescore-usage-summary` 逐行扫描 `vibescore_tracker_hourly`，会在大范围请求时放大内存与网络负载。我们需要在**无滞后**前提下，用成熟的 Postgres 原生聚合降低负载，避免再次触发资源崩溃。

## What Changes
- 新增 Postgres RPC/SQL 聚合函数（`vibescore_usage_summary_agg`，命名可调）。
- `vibescore-usage-summary` 改为调用 RPC，Edge 侧仅做参数校验 + pricing 计算。
- 增加观测字段：`rows_out`/`group_count` 与 `row_count`（慢查询日志）。
- 新增接受测试脚本与回归声明。

## Impact
- Affected specs: `vibescore-tracker`（新增聚合约束）。
- Affected code: `insforge-src/functions/vibescore-usage-summary.js`、SQL 变更、测试与文档。
- 风险：RLS/聚合口径差异与查询计划退化（已在风险与对策中定义）。
