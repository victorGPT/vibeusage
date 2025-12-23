## Context
`usage-hourly` 在 UTC 路径读取一天内全部事件后在 Edge 汇总，导致数据搬运与聚合成本高。目标是在不改 API 的前提下，优先用数据库侧按小时聚合，失败则回退。

## Module Brief
### Scope
- IN: `usage-hourly` 的 UTC 路径聚合策略。
- OUT: 非 UTC 路径、其他 endpoints。

### Interfaces
- `GET /functions/vibescore-usage-hourly` 不变。

### Data flow and constraints
- 先尝试 DB 端按小时分组聚合（`date_trunc('hour') + SUM`）。
- 聚合不被支持或失败时回退到旧逻辑。
- Phase 1 忽略 tz 参数，仅覆盖 UTC 路径。

### Non-negotiables
- 结果正确且可回退。
- `day` 与 `data` 结构保持一致，缺失小时补零。

### Test strategy
- Acceptance：聚合成功时返回小时桶；聚合失败时走回退路径且结果一致。

## Decisions
- Decision: 使用 PostgREST 聚合字段别名并捕获错误回退。
- Alternative: 新建 SQL 视图/RPC（未选，避免引入新依赖）。

## Risks / Trade-offs
- 聚合语法兼容性不确定：通过回退路径与验收脚本降低风险。
