# Design: Model identity alias resolution

## Overview
- 引入独立的模型身份别名表，作为模型展示与聚合的唯一事实源。
- 统一在读路径做归一化，不改变 ingest 或历史数据。

## Data Model
- `vibescore_model_aliases`:
  - `usage_model` (lowercase, NOT NULL)
  - `canonical_model` (NOT NULL)
  - `display_name` (nullable)
  - `effective_from` (timestamptz, NOT NULL)
  - `active` (boolean, NOT NULL)
  - `created_at` (timestamptz, NOT NULL default now)
  - index: `(usage_model, effective_from DESC)`

## Resolver
- 输入：`usageModels[]`, `effectiveDate`.
- 行为：
  - `usage_model` 统一 lower-case。
  - 取 `active = true` 且 `effective_from <= effectiveDate` 的最新映射。
  - 缺失映射时 fallback 到 raw。
- 输出：`{ usage_model -> { model_id, model } }`。

## API Output
- 所有模型相关 endpoints 输出：
  - `model_id` = canonical_model
  - `model` = display_name || canonical_model
- 统计聚合以 `model_id` 为键。
- 过滤参数 `model` 解释为 canonical id，并扩展到所有 alias。

## Non-Goals
- 不修改 pricing 逻辑。
- 不做历史回填。
