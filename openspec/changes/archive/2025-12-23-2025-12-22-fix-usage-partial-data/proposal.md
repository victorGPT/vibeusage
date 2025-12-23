# Change: Fix partial usage data in dashboard (Phase 1)

## 结论
先恢复**数据完整性**：在后端**忽略 `tz`/`tz_offset_minutes`**，统一走 UTC 聚合路径，避免 event 扫描带来的默认行数截断。二阶段再引入数据库端时区聚合。

## Why
- 非 UTC 分支当前走事件表扫描并在 Edge 侧聚合，未分页/未数据库聚合 → 结果被截断。
- 你明确“时区非硬目标”，因此优先保证完整性是最小风险且正确的选择。

## What Changes
- Phase 1（本次变更）：usage 相关 endpoints 在后端忽略时区参数，统一走 UTC 聚合路径，保证结果完整。
- 保持 API contract（请求参数仍可传入，但暂不生效）。
- 为 Phase 2 预留延续性：聚合入口集中化，后续可替换为 DB 时区聚合而不改接口。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `insforge-src/functions/vibescore-usage-*.js`
  - `BACKEND_API.md`

## Follow-up (Phase 2)
- 新增数据库端时区聚合（RPC/视图），恢复 `tz` 语义并保证完整性。
