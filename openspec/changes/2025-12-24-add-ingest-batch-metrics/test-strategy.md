# Test Strategy

## Objectives
- 证明 ingest 批量指标被记录且可聚合查询。
- 确保 metrics 写入失败不影响 ingest 成功路径。
- 验证 metrics retention 生效。

## Test Levels
- Unit: metrics payload shape/field normalization (if helper added).
- Integration: ingest → metrics table insert; retention purge.
- Regression: ingest behavior unchanged when metrics insert fails.
- Performance: measure added handler duration (wall time) to ensure no significant regression.

## Test Matrix
- Metrics recorded per request -> Integration -> Backend -> acceptance script
- Metrics best-effort -> Regression -> Backend -> failure injection / mocked insert
- Retention -> Integration -> Backend -> retention SQL / function run

## Environments
- Staging or local InsForge environment with DB access.

## Automation Plan
- New acceptance script `scripts/acceptance/ingest-batch-metrics.cjs`.
- Add a retention verification step (SQL before/after).

## Entry / Exit Criteria
- Entry: SQL migration and edge function changes merged into a test env.
- Exit: acceptance script passes; retention verified; ingest behavior unchanged.

## Coverage Risks
- Failure-path test may require injection or mock; if not possible, document manual steps.
