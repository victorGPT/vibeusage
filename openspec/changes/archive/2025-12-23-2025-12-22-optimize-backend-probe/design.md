## Context
后台探活是 UI 可用性信号，但固定频率轮询会造成不必要负载。目标是在不改变 UI 契约的前提下，减少无意义请求。

## Module Brief
### Scope
- IN: `use-backend-status` 的探活调度策略。
- OUT: 认证流程与数据接口契约。

### Interfaces
- 前端探活行为不改变调用方接口。

### Data flow and constraints
- 成功后退避（拉长间隔）。
- 失败时短间隔重试。
- 保持“仅前台可见时探活”的规则。

### Non-negotiables
- 不新增后端健康检查 endpoint（本阶段）。
- 状态变化仍能在可接受时间内反映。

### Test strategy
- Acceptance：验证调度策略随状态变化而调整间隔。

## Decisions
- Decision: 采用调频 + 退避，而非新增 health endpoint。

## Risks / Trade-offs
- 状态刷新延迟上升：用失败重试与手动刷新兜底。
