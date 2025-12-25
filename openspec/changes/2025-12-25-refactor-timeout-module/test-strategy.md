# Test Strategy

## Objectives
- 覆盖超时模块的关键分支：默认值、clamp、禁用、超时中断、调用方中断。
- 确保迁移后行为与现状一致。

## Test Levels
- Unit: 新模块的纯逻辑与中断行为（`node --test`）。
- Integration: 通过 `dashboard/src/lib/insforge-client.js` 的现有调用路径验证无破坏性变化。
- Regression: 运行现有 `node --test test/*.test.js`。
- Performance: 不新增专门测试（无性能目标）。

## Test Matrix
- Timeout default/clamp -> Unit -> FE -> `test/http-timeout.test.js`
- Timeout disabled -> Unit -> FE -> `test/http-timeout.test.js`
- Caller abort precedence -> Unit -> FE -> `test/http-timeout.test.js`
- Wrapper integration -> Regression -> FE -> `node --test test/*.test.js`

## Environments
- 本地 Node (与现有测试相同版本)

## Automation Plan
- 新增 `test/http-timeout.test.js` 并纳入 `node --test test/*.test.js`。

## Entry / Exit Criteria
- Entry: 新模块 API 设计确定；不改变现有行为。
- Exit: 单测通过 + 现有回归通过。

## Coverage Risks
- 不同运行时对 `AbortController`/`fetch` 实现差异导致的边缘行为。
