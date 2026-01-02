# Requirement Analysis

## Goal
- 将 `vibescore-usage-summary` 的聚合下沉到 Postgres（Insforge2），在**无滞后**前提下显著降低数据库内存与网络负载，并保持响应结构不变。

## Scope
- In scope:
  - 新增数据库侧聚合函数/视图（PostgREST RPC）：`vibescore_usage_summary_agg`（命名可调整）。
  - Edge Function `insforge-src/functions/vibescore-usage-summary.js` 改为调用 RPC 并复用现有 pricing 计算。
  - 观察性增强：记录 `rows_out`/`group_count` 与 `row_count`/`range_days` 的慢查询日志字段。
  - 安全边界：RLS 生效、无 `SECURITY DEFINER`，不使用 service-role。
  - 测试与回归声明（聚合一致性 + 授权边界）。
- Out of scope:
  - 引入任何缓存或“延迟汇总”（不接受滞后）。
  - 新增外部存储或服务（仅 Insforge2）。
  - Dashboard UI 改动。

## Users / Actors
- Dashboard 用户（读取汇总数据）。
- Insforge2 Edge Function（`vibescore-usage-summary`）。
- Insforge2 Postgres（`vibescore_tracker_hourly`）。

## Inputs
- 表：`vibescore_tracker_hourly`（按半小时聚合）。
- 请求参数：`from`/`to`、`source`、`model`、`tz`/`tz_offset_minutes`。
- 现有 pricing pipeline（`resolvePricingProfile` / `computeUsageCost`）。

## Outputs
- API 响应结构保持不变：`{ from, to, days, totals, pricing }`。
- 数据库侧 RPC 函数（或视图）用于返回聚合行。

## Business Rules
- **无滞后**：结果必须包含最新半小时桶；不得因缓存或异步汇总而延迟。
- **成熟方案优先**：使用 Postgres 原生 `SUM` 聚合 + 既有索引，不造轮子。
- **最小权限**：仅用户 token，RLS 生效；禁止 service-role。
- **兼容性**：保持 pricing 逻辑与 debug payload 语义。
- **平台约束**：后端必须是 Insforge2。

## Assumptions
- 现有索引满足范围扫描：
  - `vibescore_tracker_hourly_user_hour_idx`（`user_id, hour_start`）
  - `vibescore_tracker_hourly_user_source_model_hour_idx`（`user_id, source, model, hour_start`）
- PostgREST `/rpc` 可用并允许在 RLS 下执行聚合函数。
- `VIBESCORE_USAGE_MAX_DAYS` 仍限制最大查询窗口。

## Dependencies
- Insforge2 Postgres + PostgREST RPC。
- `insforge-src/functions/vibescore-usage-summary.js`。
- `dashboard/src/lib/vibescore-api.js`（接口不改）。

## Baseline Metrics (Observed)
- 数据来源：Insforge2 线上库（截至 2026-01-02，最近 30 天窗口）。
- 统计结果：
  - users: 34
  - avg_rows（hourly 行）: 298.97
  - avg_groups（`source, model` 分组）: 9.21
  - avg_ratio（rows / groups）: 39.87x
  - p90_rows: 640.2, p90_groups: 16.1
- 结论：RPC 聚合后预计**行数与内存压力 ~40x 降低**（无滞后）。

## Risks
- RLS/权限绕过风险（误用 `SECURITY DEFINER`）。
  - Mitigation: 函数内强制 `user_id = auth.uid()`，不使用 definer。
- 聚合口径差异（NULL/类型转换）。
  - Mitigation: `COALESCE(SUM(...), 0)` + bigint；新增一致性测试。
- 查询计划退化（范围过大或条件缺失）。
  - Mitigation: 保留现有 max days；必要时增加执行超时。
- 调试复杂度上升（逻辑进入 SQL）。
  - Mitigation: 增加 `rows_out`/`group_count` 观测字段与诊断 SQL。
