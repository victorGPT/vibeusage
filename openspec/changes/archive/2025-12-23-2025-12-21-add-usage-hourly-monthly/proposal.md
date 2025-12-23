# Change: Add hourly + monthly usage aggregates for TREND

## 结论

为 Dashboard 的 TREND 模块补齐正确粒度的后端聚合：
- **day** 使用小时级聚合（24 点，UTC）。
- **total** 使用最近 **24 个月**的月聚合（UTC 月）。
- **week/month** 继续使用日聚合（UTC 日）。

前端将按粒度对齐展示，避免“伪数据/插值”。

## Why

TREND 模块当前仅依赖日聚合：
- day 只有 1 个点（不可用）；
- total 因不拉 daily 导致空；
- 若用前端插值会违背数据真实性。

因此需要后端提供 **hourly/monthly** 聚合，让趋势展示既真实又可用。

## What Changes

- 新增 Edge Function：
  - `GET /functions/vibescore-usage-hourly`（UTC 小时聚合）
  - `GET /functions/vibescore-usage-monthly`（UTC 月聚合，最近 24 个月）
- Dashboard TREND 数据源切换：
  - `period=day` → hourly
  - `period=week|month` → daily
  - `period=total` → monthly(24)
- 更新 `BACKEND_API.md` 与前端 API client/hook，缓存键区分粒度。

## Impact

- Affected specs：`vibescore-tracker`
- Affected code：
  - `insforge-src/`（新增聚合 endpoints + SQL）
  - `insforge-functions/`（build 产物）
  - `dashboard/src/lib/vibescore-api.js`
  - `dashboard/src/hooks/*` + `TrendMonitor`
  - `BACKEND_API.md`
- 风险：
  - 聚合查询性能（需明确窗口、索引与上限）
  - UTC 对齐（避免本地时区误差）

## 已确认

- day 必须为 **小时级真实数据**。
- total 为 **最近 24 个月**。

## 假设（如需调整请告知）

- week 为 UTC 自然周（周日开始），month 为 UTC 自然月。
- hourly/monthly 的响应均返回 `total_tokens` 等字段，bigint 以 string 表示（与 summary/daily 一致）。
