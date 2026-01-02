# Usage Summary DB Aggregation Design

**Goal:** 在不引入任何滞后的前提下，显著降低 `vibescore-usage-summary` 对 Insforge2 数据库内存与网络的压力。

## Decision
- 采用 Postgres 原生聚合（RPC）替代 Edge 逐行扫描。
- 保持现有 API 响应结构与 pricing 逻辑。
- 不引入缓存与延迟汇总。

## Rationale (First Principles)
- 可用性优先：数据库内存爆掉会导致全服务不可用。
- 最小成本：利用成熟 Postgres 聚合能力，不造轮子。
- 无滞后：结果必须包含最新半小时桶。

## Baseline Metrics
- 30 天窗口（Insforge2 线上库，2026-01-02）：
  - avg_rows: 298.97
  - avg_groups: 9.21
  - avg_ratio: 39.87x
  - p90_rows: 640.2, p90_groups: 16.1
- 预期：行数与内存压力 ~40x 降低（无滞后）。

## Proposed Flow
1. Edge 校验参数与授权，计算 UTC 边界。
2. 调用 RPC `vibescore_usage_summary_agg`（RLS 生效）。
3. Edge 合并 totals + pricing，返回原有结构。

## Risks & Mitigation
- RLS 被绕过：函数内强制 `user_id = auth.uid()`，不使用 `SECURITY DEFINER`。
- 聚合口径差异：`COALESCE(SUM(...),0)` + bigint；一致性测试。
- 查询计划退化：保留 `VIBESCORE_USAGE_MAX_DAYS` 上限，必要时设置超时。

## Non-Goals
- 不做缓存或延迟汇总。
- 不改 Dashboard UI。
- 不引入其他后端平台。

## Next Steps
- OpenSpec 提案与任务分解。
- 通过审批后再进入实现。
