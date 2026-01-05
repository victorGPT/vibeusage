# Test Strategy

## Objectives
- 验证模型身份归一化在所有 usage 读接口一致生效。
- 验证 `model_id`/`model` 输出口径与别名表一致。
- 验证模型过滤参数按 canonical 维度聚合。

## Test Levels
- Unit:
  - 身份解析函数：lowercase、effective_from 选择、active 过滤、fallback。
  - canonical 聚合函数：多 usage_model 合并。
- Integration:
  - usage-model-breakdown 输出 `model_id` + `model`，且别名合并有效。
  - usage-daily/hourly/summary 输出 `model_id`，过滤按 canonical 生效。
- Regression:
  - 既有 usage API 响应结构未破坏（新增字段、保持旧字段可用）。
  - Top Models / 模型分布 UI 仍可渲染。

## Test Matrix
- Alias merge -> Unit + Integration -> `test/edge-functions.test.js`
- Fallback without alias -> Unit + Integration -> `test/edge-functions.test.js`
- Effective_from selection -> Unit -> alias resolver tests
- Model filter canonical -> Integration -> usage-daily/summary tests

## Environments
- Local node test harness (现有 `node --test`)。

## Automation Plan
- 在 `test/edge-functions.test.js` 增加 mock alias 读取与输出断言。
- 前端仅做结构回归断言（copy/渲染不崩）。

## Entry / Exit Criteria
- Entry: OpenSpec proposal approved.
- Exit: 新增测试通过并记录回归执行结果。

## Coverage Risks
- 如果 alias 数据缺失，fallback 路径需覆盖。
- 过滤语义改变需要额外验证历史调用不会误判。
