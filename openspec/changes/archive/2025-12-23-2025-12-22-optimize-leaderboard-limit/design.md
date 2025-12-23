## Context
`vibescore-leaderboard` 在无快照回退路径中读取完整榜单后再截断，随着用户量增长会导致不必要的数据搬运与内存压力。

## Module Brief
### Scope
- IN: 非快照路径的 `entriesView` 查询。
- OUT: 快照路径、`me` 查询、其它 endpoints。

### Interfaces
- `GET /functions/vibescore-leaderboard` 不变。

### Data flow and constraints
- 在 DB 查询中应用 `limit`，只取 Top N。
- 输出字段与排序保持一致。

### Non-negotiables
- 结果内容与排序与现有逻辑一致。
- `me` 查询保持完整（不受 limit 影响）。

### Test strategy
- Acceptance：验证 `entriesView` 查询链路包含 limit，且结果数量不超过 `limit`。

## Decisions
- Decision: 在查询链路中追加 `.limit(limit)`。
