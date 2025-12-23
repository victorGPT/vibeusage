## Context
`vibescore-leaderboard` 在无快照路径中对 `entries` 与 `me` 进行两次查询，带来额外的 DB 往返成本。目标是在不改变契约的前提下合并为单次查询。

## Module Brief
### Scope
- IN: 非快照路径的 leaderboard 查询策略。
- OUT: 快照路径、响应字段定义。

### Interfaces
- `GET /functions/vibescore-leaderboard` 不变。

### Data flow and constraints
- 优先使用单次查询：`rank <= limit OR is_me = true`。
- 查询失败时回退双查询。
- 输出结构保持一致。

### Non-negotiables
- Top N 排序与现有逻辑一致。
- 当前用户 `me` 必须返回（若存在）。

### Test strategy
- Acceptance：验证单次查询路径生效且 `entries`/`me` 正确拆分。
- 回退路径保持旧行为。

## Decisions
- Decision: 用 OR 过滤合并查询，失败回退。

## Risks / Trade-offs
- OR 语法兼容性与视图过滤能力；用回退机制降低风险。
