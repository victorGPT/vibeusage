# Change: Reduce backend load by deduplicating usage fetches

## 结论
基于第一性原则（减少重复计算与重复 IO），先从 **Dashboard 请求合并/去重** 入手：同一周期内 `usage-daily` 只请求一次，`summary` 从 `daily` 推导；趋势数据复用同一份 `daily`，从源头减少后端调用次数与查询压力。

## Why
- 当前 Dashboard 在 `period=week|month` 时会 **重复调用** `usage-daily`（用于日表与趋势），且同时调用 `usage-summary`。
- 这类“重复拉取同一数据”对后端是纯粹负担，可在前端通过共享结果消除。

## What Changes
- 新增一个“使用量数据编排层”，统一负责拉取 `usage-daily` 并派生：
  - `summary`（BigInt 汇总）
  - `trend`（直接复用 daily rows）
- 当 `period=total` 时继续走后端 `usage-summary`（因为不拉 daily）。
- 保持 API contract 不变，仅减少调用次数。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `dashboard/src/pages/DashboardPage.jsx`
  - `dashboard/src/hooks/use-usage-data.js`
  - `dashboard/src/hooks/use-trend-data.js`
  - 新增共享聚合/缓存工具（待定）
- 风险：本地 BigInt 汇总与后端一致性；需要严格验证。

## Assumptions
- “第一期免利”指“第一性原理”；如有误请指出。
