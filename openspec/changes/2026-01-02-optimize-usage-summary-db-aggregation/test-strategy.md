# Test Strategy

## Objectives
- 验证 DB 聚合结果与现有逐行累加一致。
- 保证无滞后（最新半小时桶可被统计）。
- 验证 RLS/授权边界与错误处理。
- 量化负载下降（`rows_out`/`group_count`）。

## Test Levels
- Unit:
  - SQL 函数聚合逻辑（SUM + COALESCE + bigint）。
  - 参数校验（from/to/source/model）。
- Integration:
  - Edge Function 调用 RPC 并返回 totals + pricing。
  - Debug payload 输出保持不变。
- Regression:
  - `node --test test/edge-functions.test.js`（覆盖 usage summary 行为）。
  - `node --test test/dashboard-function-path.test.js`（路径回退不变）。

## Test Matrix
- 正常范围（7 天） -> Integration -> totals 与逐行累加一致。
- 当天范围（含最新半小时） -> Integration -> totals 覆盖最新数据。
- 无授权 -> Integration -> 401。
- RPC 失败 -> Integration -> 500 且无回退。

## Environments
- 本地 Node.js（模拟 Edge Function）。
- Insforge2 DB（受控环境执行 RPC）。

## Automation Plan
- 新增 `scripts/acceptance/usage-summary-agg.cjs`：
  - 同窗口对比 RPC 聚合 vs 逐行汇总。
  - 输出 `rows_in/rows_out` 与比值。
- 更新 `test/edge-functions.test.js`：
  - Mock RPC 返回并验证 totals/pricing/ debug payload。

## Entry / Exit Criteria
- Entry: OpenSpec 变更已审批。
- Exit: 单元/集成测试通过，回归路径记录完成。

## Coverage Risks
- 真实数据分布可能与测试样本不同；需在预发或小流量观察 `rows_out` 与慢查询指标。
