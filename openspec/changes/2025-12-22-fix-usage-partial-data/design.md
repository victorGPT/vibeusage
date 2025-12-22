## Context
非 UTC 时区请求当前走事件表扫描 + Edge 聚合，未分页或 DB 聚合，导致默认行数限制/超时引发“静默截断”。

## Goals / Non-Goals
- Goals:
  - Phase 1：恢复完整性（忽略时区参数，统一 UTC 聚合）。
  - 预留 Phase 2 延续性（接口不变、聚合入口集中化）。
- Non-Goals:
  - 本次不实现时区聚合。

## Module Brief
### Scope
- IN: usage 相关 Edge Functions（summary/daily/heatmap/monthly/hourly）对时区参数的处理方式。
- OUT: ingest/leaderboard/auth。

### Interfaces
- 现有 endpoints 不变：`/functions/vibescore-usage-*`。
- `tz`/`tz_offset_minutes` 仍可传入，但 Phase 1 不生效。

### Data flow and constraints
- Phase 1：忽略时区参数 → 走 UTC 预聚合视图/UTC 事件范围 → 返回完整结果。
- 延续性：聚合入口集中在单一 helper（或统一分支），Phase 2 替换为 DB 时区聚合。

### Non-negotiables
- 结果完整性优先，禁止静默截断。
- API contract 不变。

### Test strategy
- Phase 1 验证：
  - `usage-summary` totals == `usage-daily` 汇总（同一 from/to）。
  - 非 UTC 时区请求返回与 UTC 一致（仅 Phase 1）。

### Milestones
1. Phase 1：后端忽略 tz 参数并验证完整性。
2. Phase 2（后续变更）：DB 时区聚合 + 恢复 tz 语义。

### Plan B triggers
- 若 UTC 视图仍不完整或性能异常，临时限制查询窗口并明确返回错误。

### Upgrade plan (disabled by default)
- Phase 2：新增 DB 聚合函数/视图，切换聚合入口即可恢复 tz 语义。

## Decisions
- Decision: Phase 1 统一走 UTC 聚合路径；Phase 2 再恢复 tz。
- Rationale: 完整性优先，且接口保持不变确保可延续。
