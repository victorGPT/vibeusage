# Module Brief: Model Identity Alias

## Scope
- IN: 新增模型身份别名表；统一的 identity 解析与聚合；usage 读接口输出 `model_id` + `model`。
- OUT: 历史回填、定价规则变更、采集/ingest 模型写入逻辑变更。

## Interfaces
- Input: `vibescore_tracker_hourly.model`（raw usage model）；`vibescore_model_aliases`。
- Output: `model_id`（canonical）+ `model`（display_name）。
- Caller: usage summary/daily/hourly/monthly/heatmap/model-breakdown。

## Data Flow and Constraints
- `usage_model` 统一 lower-case 存储与查询。
- 取 `effective_from <= to` 的最新 alias 作为生效映射。
- `active = false` 的映射不得生效。
- 无映射时 fallback 到 raw model。

## Non-Negotiables
- 统计与展示不依赖 `pricing_source`。
- 输出必须包含 `model_id`，以支持稳定聚合。
- 不要求历史回填。
- 定价逻辑保持不变。

## Test Strategy
- Unit: alias 解析、effective_from 选择、fallback。
- Integration: usage-model-breakdown 与 usage-daily/summary 输出断言。
- Regression: Dashboard 关键视图可渲染。

## Milestones
- M1: OpenSpec artifacts complete.
- M2: Shared resolver + API updates implemented.
- M3: Regression verified.

## Plan B Triggers
- 若 alias 表数据维护成本过高，考虑引入只读 view 或配置缓存层。

## Upgrade Plan (disabled)
- 未来可扩展 provider 维度或多语言 display_name。
