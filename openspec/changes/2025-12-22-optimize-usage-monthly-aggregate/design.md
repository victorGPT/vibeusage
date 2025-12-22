## Context
`usage-monthly` 在 UTC 路径读取整段 `vibescore_tracker_daily` 并在 Edge 汇总，造成不必要的数据搬运。目标是在不改变 API 契约的前提下，把月度聚合推到数据库侧。

## Module Brief
### Scope
- IN: `usage-monthly` 的 UTC 路径聚合策略。
- OUT: 非 UTC 路径、其他 endpoints。

### Interfaces
- `GET /functions/vibescore-usage-monthly` 不变。

### Data flow and constraints
- 先尝试 DB 端按月分组聚合（SUM）。
- 聚合不被支持或失败时回退到旧逻辑。
- Phase 1 仍忽略 tz 参数，因此聚合仅覆盖 UTC 路径。

### Non-negotiables
- 结果正确且可回退。
- `from/to/months` 与 `data` 结构保持一致。

### Test strategy
- Acceptance：聚合成功时返回月度桶且无额外日表遍历开销。
- 回退路径保持原行为（功能不中断）。

## Decisions
- Decision: 使用 PostgREST 聚合字段别名（`date_trunc` + `sum`）并捕获错误回退。
- Alternative: 新增 SQL 视图或 RPC（未选，避免引入新依赖）。

## Risks / Trade-offs
- 聚合语法兼容性：通过回退机制与 acceptance 脚本降低风险。
