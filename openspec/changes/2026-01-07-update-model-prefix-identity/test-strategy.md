# Test Strategy

## Scope
- 覆盖 usage model 前缀保留、严格过滤、显式价格别名与默认回退。

## Test Levels

### Unit
- `normalizeUsageModel`：保留完整前缀、仅 trim + lower-case。
- `applyUsageModelFilter`：仅严格匹配，不生成后缀匹配条件。

### Integration (edge function tests)
- usage daily/summary/hourly/model-breakdown 在 `model` 过滤下仅匹配精确 usage model。
- 显式 alias 扩展行为（`vibescore_model_aliases`）。
- pricing alias 缺失时返回默认 profile；存在时使用别名。

### Regression
- 现有 usage 端点基础行为不变（无 `model` 参数时聚合全量）。
- 价格输出字段仍存在且格式不变。

## Mapping to Acceptance Criteria
- Preserve full usage model identity → Unit + integration.
- Strict model filter → Integration.
- Explicit pricing aliases → Integration.

## Tooling / Commands
- `node --test test/edge-functions.test.js --test-name-pattern "usage model"`
- `node --test test/insforge-src-shared.test.js --test-name-pattern "normalizeUsageModel|applyUsageModelFilter"`
- `node --test test/edge-functions.test.js --test-name-pattern "pricing"`

## Risks & Mitigations
- 风险：旧客户端依赖后缀合并过滤。
  - Mitigation：明确 API 行为变更，并要求调用方使用显式 alias。
