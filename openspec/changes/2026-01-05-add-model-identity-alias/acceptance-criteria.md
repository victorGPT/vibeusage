# Acceptance Criteria

## Feature: Model identity normalization (decoupled from pricing)

### Requirement: API outputs canonical model identity fields
- Rationale: 输出口径必须统一，前端与下游可以稳定聚合。

#### Scenario: Usage breakdown includes model_id + display model
- WHEN a signed-in user calls `GET /functions/vibeusage-usage-model-breakdown?from=2026-01-01&to=2026-01-01`
- THEN each `models[]` entry SHALL include `model_id`
- AND `model` SHALL be the display name (or fallback)

#### Scenario: Usage summary includes model_id + display model when model scoped
- WHEN a signed-in user calls `GET /functions/vibeusage-usage-summary?from=2026-01-01&to=2026-01-07`
- THEN the response SHALL include `model_id` and `model` when a model context is inferred

### Requirement: Canonical mapping merges equivalent usage models
- Rationale: 同一模型在不同 CLI/来源必须合并。

#### Scenario: Alias merges gpt-4o-mini into gpt-4o
- GIVEN `vibescore_model_aliases` maps `gpt-4o-mini` -> `gpt-4o`
- AND hourly rows include `model = "gpt-4o-mini"` and `model = "gpt-4o"`
- WHEN the user calls usage breakdown for the range
- THEN the response SHALL contain a single `model_id = "gpt-4o"` entry with combined totals

### Requirement: Effective-from selection uses latest mapping
- Rationale: 支持映射随时间演进。

#### Scenario: Latest effective mapping is selected
- GIVEN two alias rows for `usage_model = "gpt-4o-mini"` with `effective_from = 2025-12-01` and `2026-01-01`
- WHEN the user calls usage breakdown with `to = 2026-01-15`
- THEN the mapping with `effective_from = 2026-01-01` SHALL be applied

### Requirement: Missing alias falls back safely
- Rationale: 不能因为缺失配置导致统计中断。

#### Scenario: No alias mapping
- GIVEN no alias row exists for `usage_model = "custom-model"`
- WHEN the user calls any usage endpoint
- THEN the response SHALL set `model_id = "custom-model"`
- AND `model = "custom-model"`

### Requirement: Model filter uses canonical identity
- Rationale: 过滤应与展示口径一致。

#### Scenario: Filter by canonical model id
- GIVEN alias rows map `gpt-4o-mini` -> `gpt-4o`
- WHEN a user calls `GET /functions/vibeusage-usage-daily?...&model=gpt-4o`
- THEN hourly rows for `gpt-4o-mini` and `gpt-4o` SHALL both be included
