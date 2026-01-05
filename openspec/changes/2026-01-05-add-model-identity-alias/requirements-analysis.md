# Requirement Analysis

## Goal
- 建立独立的模型身份映射（model identity alias），让统计与展示使用统一的 canonical 模型，不再依赖 `pricing_source`。
- 所有模型相关 API 输出统一为 `model_id`（canonical） + `model`（display_name），并按 `model_id` 聚合。
- 归一化发生在读取时，不要求历史回填。

## Scope
- In scope:
  - 新增模型身份别名表（如 `vibescore_model_aliases`）。
  - 新增共享解析器（批量查询 + 映射）。
  - 更新所有模型相关读接口：usage summary/daily/hourly/monthly/heatmap/model-breakdown 等。
  - 输出字段调整：`model` 用于展示，新增 `model_id`。
  - 兼容无别名数据（fallback 到原始模型名）。
  - 前端展示/聚合使用 `model_id` 作为稳定 key。
- Out of scope:
  - 历史数据回填或批量迁移。
  - 定价表、计价逻辑改动（继续使用 `vibescore_pricing_model_aliases`）。
  - 采集/ingest 的原始模型写入逻辑（保持原样）。

## Users / Actors
- Dashboard 用户与前端。
- API 消费者（内部/外部）。
- 运营/后台维护别名表的人员。

## Inputs
- 数据库表：`vibescore_model_aliases`。
- API 查询参数：`from`/`to`/`source`/`model`（按需求调整语义）。
- 归一化入口：所有从 `vibescore_tracker_hourly` 读取的 `model` 字段。

## Outputs
- 所有模型相关输出：
  - `model_id`: canonical 模型标识。
  - `model`: display_name（或 fallback）。
- 模型聚合统计以 `model_id` 为唯一分组键。

## Business Rules
- `usage_model` 统一 lower-case 存储/查询。
- 在 `effective_from <= 查询日期` 的记录中选择最新映射。
- `active = false` 的记录不得参与映射。
- 若无映射：`model_id = usage_model`，`model = usage_model`。
- API 输出的 `model` 始终为 display 名；`model_id` 作为稳定 ID。

## Assumptions
- 模型别名表由后台维护，数据量可控。
- 不要求对历史记录改写或补齐。
- 现有 `model` 字段已可用于 fallback。

## Dependencies
- Edge functions（usage 系列）。
- 前端 model breakdown 逻辑与 Top Models 组件。
- InsForge 数据库 schema。

## Risks
- alias 数据缺失或错误将影响展示口径。
- 过滤参数 `model` 的语义改变可能影响调用方（需明确兼容策略）。
- 多来源模型命名冲突需要规范数据维护流程。
