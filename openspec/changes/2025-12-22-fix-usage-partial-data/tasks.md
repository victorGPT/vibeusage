## 1. Phase 1 - Backend (UTC fallback)
- [x] 1.1 在 `vibescore-usage-*.js` 中忽略 `tz`/`tz_offset_minutes`，统一走 UTC 聚合路径。
- [x] 1.2 复核所有 usage endpoints 返回完整性（summary/daily/heatmap/monthly/hourly）。
- [x] 1.3 更新 `BACKEND_API.md`，注明 Phase 1 时区参数暂不生效。

## 2. Phase 1 - Verification
- [x] 2.1 同一范围内，`usage-summary` totals == `usage-daily` 汇总（UTC）。
- [x] 2.2 同一范围内，非 UTC 请求结果应与 UTC 一致（Phase 1 预期）。

## 3. Phase 2 - Follow-up (separate change)
- [ ] 3.1 设计并部署 DB 时区聚合函数/视图。
- [ ] 3.2 切回 tz-aware 聚合并保持完整性。
