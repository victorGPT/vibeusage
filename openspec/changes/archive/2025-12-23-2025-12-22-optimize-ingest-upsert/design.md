## Context
service-role ingest 目前先查重再插入，产生额外 DB 往返。匿名路径已通过 records API 的 `on_conflict + ignore-duplicates` 实现单次写入并保持幂等。

## Module Brief
### Scope
- IN: service-role ingest 写路径（去重与写入策略）。
- OUT: 事件解析、鉴权、device token 校验。

### Interfaces
- `POST /functions/vibescore-ingest` 保持不变。

### Data flow and constraints
- 需要保证：幂等性与插入计数准确。
- 快速通道失败时必须安全回退（不影响正确性）。

### Non-negotiables
- 不能重复计数。
- 不引入新的鉴权边界。

### Test strategy
- 新增 acceptance：service-role 路径使用 upsert 快速通道，且不触发预查询。

### Milestones
1. 引入 fast path（upsert）并保留回退。
2. 验证幂等与插入计数。

### Plan B triggers
- 若 records API 不支持 upsert，回退到原有 select+insert。

## Decisions
- Decision: service-role 优先走 upsert fast path。
- Alternatives: 保持现状（成本高）；纯 DB 触发器去重（复杂）。

## Risks / Trade-offs
- upsert 支持差异：必须通过 `isUpsertUnsupported` 检测并回退。
