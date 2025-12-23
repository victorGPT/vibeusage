# Change: Optimize usage-monthly with DB aggregation

## 结论
基于第一性原理（减少数据搬运、在数据源处完成汇总），`usage-monthly` 的 UTC 路径优先使用数据库端聚合（按月分组 + SUM），显著降低 Edge 拉取与本地汇总成本；聚合不支持时安全回退到现有逻辑，确保正确性与契约不变。

## Why
- 现有实现会拉取 `vibescore_tracker_daily` 的全量日数据再在 Edge 汇总；这对 IO 与 CPU 都是冗余开销。
- 月度聚合适合在数据库侧完成，减少网络与函数内存压力。

## What Changes
- `GET /functions/vibescore-usage-monthly` 在 UTC 路径尝试 DB 端按月聚合。
- 聚合失败或不支持时回退到旧逻辑（拉日表 + Edge 汇总）。
- API contract 与响应结构保持不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-usage-monthly.js`
- 风险：PostgREST 聚合语法兼容性；通过回退保障正确性。
