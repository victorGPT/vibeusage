# Model Identity Alias Design

## 背景
当前模型统计依赖 `pricing_source`，导致跨 CLI 的同名模型无法稳定合并，且展示口径会随定价配置变化。

## 决策
- 引入独立的模型身份别名表 `vibescore_model_aliases`。
- 统计与展示统一基于 canonical 模型身份，不再依赖定价来源。
- API 输出统一为 `model_id`（canonical）+ `model`（display_name）。

## 架构与数据流
1) 读取 usage 数据（`vibescore_tracker_hourly`）。
2) 批量查询 alias 表（active + effective_from <= to）。
3) 将 raw `model` 映射为 `model_id` + `model`（display_name / fallback）。
4) 聚合与排序基于 `model_id`。
5) 返回统一口径给前端。

## 关键规则
- `usage_model` 全部 lower-case。
- 选择最新生效映射（按 `effective_from`）。
- 无映射时 fallback 到 raw。
- 定价逻辑不变。

## API 影响
- 所有模型相关接口输出新增 `model_id`。
- 既有 `model` 字段语义变为 display 名。
- `model` 查询参数解释为 canonical，并扩展至所有 alias。

## 风险与缓解
- Alias 缺失：fallback 保证不报错。
- 语义变更：在 BACKEND_API.md 明确说明。

## 非目标
- 历史回填。
- 定价或 ingest 改动。
