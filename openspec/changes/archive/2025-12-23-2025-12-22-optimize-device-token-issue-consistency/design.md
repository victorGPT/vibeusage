## Context
`device-token-issue` 需要写入 `devices` 与 `device_tokens` 两张表。当前为两次独立 insert，第二次失败时会遗留孤儿 device。目标是在不引入新 DB 依赖的前提下提高一致性。

## Module Brief
### Scope
- IN: `device-token-issue` 写入路径的一致性处理。
- OUT: 鉴权、返回结构、其他 endpoints。

### Interfaces
- `POST /functions/vibescore-device-token-issue` 不变。

### Data flow and constraints
- 成功插入 device 后再插入 token。
- token 插入失败时，执行补偿删除 device（best-effort）。

### Non-negotiables
- 不泄露 token/敏感字段。
- 写入失败必须返回明确错误。

### Test strategy
- Acceptance：模拟 token 写入失败时，验证补偿删除被调用。
- 回退路径保持旧行为（只在补偿失败时告警）。

## Decisions
- Decision: 采用补偿删除方案，避免新增 RPC 或 DB 事务依赖。

## Risks / Trade-offs
- 补偿删除失败仍可能遗留孤儿数据，但概率更低。
