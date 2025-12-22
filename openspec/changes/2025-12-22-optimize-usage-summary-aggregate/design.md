## Context
`usage-summary` 在 UTC 路径中读取整段 `vibescore_tracker_daily` 并在 Edge 汇总，造成不必要的数据搬运。目标是在保持正确性与契约不变的前提下，将聚合推到数据库侧。

## Module Brief
### Scope
- IN: `usage-summary` 的 UTC 路径聚合策略。
- OUT: 非 UTC 路径、其他 endpoints。

### Interfaces
- `GET /functions/vibescore-usage-summary` 不变。

### Data flow and constraints
- 优先执行 DB 聚合（SUM/COUNT）。
- 若 DB 聚合语法不被支持，回退到旧逻辑。

### Non-negotiables
- 结果正确且可回退。
- `days` 字段保持语义一致。

### Test strategy
- Acceptance：当 DB 聚合成功时，不执行日表全量读取。
- 回退路径可继续覆盖（保留原行为）。

## Decisions
- Decision: 使用 PostgREST 聚合语法并设置字段别名，失败即回退。

## Risks / Trade-offs
- 聚合语法兼容性：通过回退保障功能。
