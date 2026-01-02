# Acceptance Criteria

## Feature: Usage Summary DB Aggregation (No Lag)

### Requirement: DB-side aggregation without lag
- Rationale: 避免读取大量 hourly 行导致内存爆掉，同时保持实时性。

#### Scenario: 聚合结果覆盖最新半小时桶
- **GIVEN** `vibescore_tracker_hourly` 在当前窗口内包含最新半小时数据
- **WHEN** 请求 `GET /functions/vibescore-usage-summary?from=...&to=...`
- **THEN** 返回的 `totals` MUST 包含该半小时桶
- **AND** 不允许通过缓存或延迟汇总过滤最新数据

### Requirement: Response schema compatibility
- Rationale: Dashboard/CLI 依赖既有结构与 pricing 逻辑。

#### Scenario: 响应结构不变
- **WHEN** 调用 usage summary
- **THEN** 返回结构 MUST 仍为 `{ from, to, days, totals, pricing }`
- **AND** `totals` 字段保持 string 化 bigint
- **AND** debug payload 语义不变（`debug=1`）

### Requirement: RLS safety (no service-role)
- Rationale: 最小权限与多租户隔离。

#### Scenario: 未授权请求拒绝
- **WHEN** 请求缺失或无效 `Authorization: Bearer <user_jwt>`
- **THEN** API MUST 返回 401

### Requirement: Observability for load reduction
- Rationale: 需要可量化验证负载下降。

#### Scenario: 慢查询日志包含聚合行数
- **WHEN** 触发慢查询日志
- **THEN** 记录 `row_count`（扫描行）与 `rows_out`/`group_count`（聚合行数）

### Requirement: Fail fast on RPC failure
- Rationale: 避免回退到高负载路径再次触发内存问题。

#### Scenario: RPC 执行失败
- **GIVEN** RPC 返回错误
- **WHEN** usage summary 调用 RPC
- **THEN** API MUST 返回 500
- **AND** MUST NOT 回退到逐行扫描
