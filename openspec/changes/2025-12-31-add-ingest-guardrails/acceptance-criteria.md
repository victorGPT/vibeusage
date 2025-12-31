# Acceptance Criteria

## Feature: Ingest guardrails & observability

### Requirement: M1 structured logs for critical functions
- Rationale: 支持责任归因与快速定位。

#### Scenario: Ingest request emits M1 log
- WHEN a client calls `POST /functions/vibescore-ingest`
- THEN the function SHALL emit a structured log containing `request_id`, `function`, `stage`, `status`, `latency_ms`, `error_code`, `upstream_status`, `upstream_latency_ms`
- AND the log SHALL NOT include payload contents

### Requirement: Concurrency guard for ingest
- Rationale: 降低认证/连接风暴对 DB 的冲击。

#### Scenario: Too many concurrent ingest requests
- WHEN concurrent requests exceed the configured limit
- THEN the endpoint SHALL respond `429` with `Retry-After` header
- AND the request SHALL NOT reach DB writes

#### Scenario: Guard is opt-in by default
- WHEN `VIBESCORE_INGEST_MAX_INFLIGHT` is unset or `0`
- THEN ingest requests SHALL not be throttled by the guard

### Requirement: Canary probe is safe and idempotent
- Rationale: 低成本早期发现

#### Scenario: Canary run
- WHEN the canary script runs with a dedicated device token
- THEN it SHALL perform a single ingest with `source=model=canary`
- AND repeated runs SHALL not mutate real user usage totals

### Requirement: Usage endpoints exclude canary by default
- Rationale: 避免合成探针污染真实统计。

#### Scenario: Default usage query ignores canary
- WHEN a user calls a usage endpoint without `source=canary` or `model=canary`
- THEN canary buckets SHALL be excluded from aggregates
