## Context
Dashboard 在同一渲染周期内会并发调用 `usage-daily`、`usage-summary` 与 `trend`（week/month 仍使用 `usage-daily`）。这导致后端重复查询同一窗口的数据。我们已通过“忽略 tz”修复完整性问题，本次聚焦**减少重复调用**。

## Goals / Non-Goals
- Goals:
  - 同一周期内 `usage-daily` 只请求一次。
  - `summary` 从 `daily` 计算，避免额外 `usage-summary` 调用（`period!=total`）。
  - `trend` 复用 `daily` 数据（`period=week|month`）。
- Non-Goals:
  - 不改动后端 API contract。
  - 不实现时区聚合（Phase 2 另开变更）。

## Decisions
- Decision: 引入“usage 数据编排层/共享缓存”，集中拉取 daily 并派生 summary + trend。
- Alternatives:
  - 让后端提供“combined endpoint”：需要新增接口，变更更大。
  - 仅靠 localStorage cache：仍会触发重复请求，无法确保单周期内去重。

## Risks / Trade-offs
- BigInt 汇总的数值一致性需要验证（避免 string→number 精度损失）。
- Hook 之间共享状态可能引入耦合，需要清晰边界与缓存 key 设计。

## Verification
- `period=week|month` 下网络面板应只出现一次 `usage-daily`。
- `summary` 数值与 `daily` 汇总一致。
