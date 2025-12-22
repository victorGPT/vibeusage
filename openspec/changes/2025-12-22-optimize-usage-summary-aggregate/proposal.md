# Change: Optimize usage-summary with DB aggregation

## 结论
基于第一性原理（减少数据搬运与重复计算），在 `usage-summary` 的 UTC 路径中优先使用 **数据库端聚合**（SUM/COUNT），避免拉取整段日数据后在 Edge 汇总。若聚合不被支持，安全回退到旧逻辑。

## Why
- `usage-summary` 目前在 UTC 路径先拉 `vibescore_tracker_daily` 全量，再在 Edge 求和；这对后端和网络是纯负担。
- DB 端聚合能显著减少 IO 与 CPU，同时保持接口不变。

## What Changes
- `GET /functions/vibescore-usage-summary` 在 UTC 路径尝试 DB 聚合（SUM/COUNT）。
- 若聚合失败或不支持，回退到原有“拉日表+Edge 求和”。
- API contract 不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-usage-summary.js`
- 风险：聚合语法兼容性；需回退路径保证正确性。
