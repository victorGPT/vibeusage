# Change: Add model identity alias mapping

## Why
- 当前模型统计依赖 `pricing_source`，导致跨 CLI 同名模型无法稳定合并。
- 模型身份与定价规则是不同维度，需要彻底解耦。

## What Changes
- 新增 `vibescore_model_aliases` 表：`usage_model -> canonical_model` + `display_name` + `effective_from`。
- 新增共享 identity resolver（批量查询 + fallback）。
- 所有 usage 读接口输出 `model_id`（canonical）与 `model`（display_name）。
- 模型聚合与筛选统一使用 canonical 维度。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `insforge-src/shared/*`, usage edge functions, dashboard model breakdown
- **BREAKING**: API 输出新增 `model_id`，`model` 语义变为 display_name（需在文档中声明）

## Architecture / Flow
- Read path: hourly rows -> identity resolver -> canonical aggregation -> response with `model_id` + `model`.
- Pricing path remains unchanged.

## Risks & Mitigations
- Alias 缺失导致 fallback：保证无 alias 时不报错。
- 过滤语义变化：明确 `model` 参数以 canonical 为准，并保证 fallback。

## Rollout / Milestones
- M1: Requirements + acceptance.
- M2: OpenSpec deltas approved.
- M3: Module brief + implementation + tests.
- M4: Regression + verification.
