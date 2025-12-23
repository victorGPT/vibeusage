# Change: Optimize usage-hourly with DB aggregation

## 结论
基于第一性原理（减少数据搬运、在数据源侧完成聚合），`usage-hourly` 在 UTC 路径优先使用数据库按小时聚合（`date_trunc('hour') + SUM`），显著降低 Edge 拉取事件与本地汇总成本；聚合不支持时回退到现有逻辑，保证正确性与契约不变。

## Why
- 当前 UTC 路径拉取一天内所有 `vibescore_tracker_events` 再在 Edge 分桶求和，存在不必要的 IO 与计算。
- 按小时聚合属于标准 DB 汇总能力，适合就近完成。

## What Changes
- `GET /functions/vibescore-usage-hourly` 在 UTC 路径尝试 DB 端按小时聚合。
- 聚合失败或不支持时回退到旧逻辑（拉事件 + Edge 分桶）。
- API contract 与响应结构保持不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-usage-hourly.js`
- 风险：PostgREST 聚合表达式兼容性；通过回退路径保障正确性。
