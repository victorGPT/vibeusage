# Design

## Summary
将 `vibescore-usage-summary` 的聚合计算下沉至 Postgres RPC：Edge Function 仅做参数校验与 pricing 计算，数据库完成 `SUM` + `GROUP BY`，以减少行数与内存占用，同时保持无滞后。

## Data Flow
1. Dashboard 请求 `GET /functions/vibescore-usage-summary?from=...&to=...`。
2. Edge Function 解析参数，校验授权与范围，计算 UTC 边界。
3. Edge 调用 PostgREST RPC `vibescore_usage_summary_agg`（RLS 生效）。
4. RPC 返回按 `source, model` 分组的 totals。
5. Edge 合并 totals 与 pricing metadata，返回原有响应结构。

## RPC Signature (Draft)
- Input: `{ from_ts timestamptz, to_ts timestamptz, source text?, model text?, user_id uuid }`
- Output: rows of `{ source, model, total_tokens, input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens }`
- Guard: `user_id = auth.uid()`

## Observability
- 继续记录 `duration_ms`, `row_count`, `range_days`。
- 新增 `rows_out`/`group_count`（RPC 返回行数）。

## Alternatives Considered
- **Rollup + hourly fallback**：仍可能触发大范围回退扫描，且复杂度更高。
- **缓存/异步汇总**：引入滞后，不符合约束。

## Module Brief (Delivery Gate)
- **Scope (IN):** RPC 聚合函数、Edge 调用改造、日志字段、测试与回归。
- **Scope (OUT):** 缓存、延迟汇总、Dashboard UI 改动、外部服务引入。
- **Interfaces:**
  - In: `GET /functions/vibescore-usage-summary`
  - Out: `vibescore_usage_summary_agg` RPC
- **Data flow & constraints:** 无滞后；RLS 生效；无 service-role；Insforge2 only。
- **Non-negotiables:** 结果实时、响应结构不变、负载下降可量化。
- **Test strategy:** RPC vs scan totals 一致；授权边界；慢查询日志字段。
- **Milestones:** M1-M4 见 `milestones.md`。
- **Plan B triggers:** RPC 不稳定或查询计划退化导致 P90 > 2s 或错误率 > 1%。
