# Requirement Analysis

## Goal
- 让模型身份保留完整前缀（如 `aws/gpt-4o`），避免跨供应商合并。
- `model` 过滤语义改为严格匹配（仅显式别名扩展，无隐式后缀匹配）。
- 价格只作为参考：优先模型身份，价格别名仅显式配置；无别名时回退默认价格。
- 不做历史回填，保证变更可逆且低风险。

## Scope
- In scope:
  - 调整 usage model 规范化规则：保留完整前缀，仅 trim + lower-case。
  - 调整 usage 端点的 `model` 过滤语义：严格匹配 + 显式别名扩展。
  - 明确 pricing alias 的显式策略与默认回退行为。
  - 更新相关测试与文档（API 行为说明）。
- Out of scope:
  - 数据库 schema 变更或历史回填。
  - 新增“跨供应商合并视图”。
  - 价格源的自动推断或供应商价格同步增强。

## Users / Actors
- Dashboard 用户与前端。
- API 使用者（内部/外部）。
- 维护 alias 配置的运营或工程人员。

## Inputs
- `vibescore_tracker_hourly.model`（usage model）。
- `vibescore_model_aliases`（模型身份别名）。
- `vibescore_pricing_model_aliases`（价格别名）。
- API 参数：`model`、`source`。

## Outputs
- usage APIs 继续输出 `model_id`（canonical）+ `model`（display），但不再隐式按后缀合并。
- 价格计算在缺失别名时使用默认 profile（不改变模型身份）。

## Business Rules
- usage model 保留完整前缀（例如 `aws/gpt-4o`），仅做 trim + lower-case。
- `model` 过滤默认严格匹配 usage model；仅显式别名可扩展匹配范围。
- pricing 别名仅显式配置有效；缺失时回退默认价格，不进行隐式后缀匹配。
- 不进行历史数据回填或补齐。

## Assumptions
- 价格只是参考值，不要求完全准确。
- 维护人员可按需配置 alias（身份/价格）。

## Dependencies
- `insforge-src/shared/model.js`（usage model 规范化与过滤）。
- usage 端点：summary/daily/hourly/monthly/heatmap/model-breakdown。
- pricing 解析逻辑与 alias 表。
- 现有测试：usage/model filters 与 pricing 行为。

## Risks
- `model` 过滤行为改变可能影响已有调用方。
- 未配置价格别名时，成本展示可能显著偏离。
- 前缀化后模型数量增加，UI 需要适配展示密度。
