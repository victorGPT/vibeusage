# Requirement Analysis

## Goal
- 将 dashboard 的超时逻辑下沉为可测试模块，同时保持现有行为不变。

## Scope
- In scope:
  - 抽取 `createTimeoutFetch` / `getHttpTimeoutMs` 到独立模块。
  - 提供可注入环境变量的接口以支持单测。
  - 增加单测覆盖关键超时/中断行为。
- Out of scope:
  - 改动超时默认值或提示文案。
  - 改动 API 调用路径或重试策略。
  - 影响 CLI 或后端逻辑。

## Users / Actors
- Dashboard 前端运行时
- 维护者与测试代码

## Inputs
- `baseFetch`（原始 fetch）
- `RequestInit`（包含可选 `signal`）
- `VITE_VIBESCORE_HTTP_TIMEOUT_MS`（可选）

## Outputs
- 可复用的 `fetch` 包装器（超时可控、可测试）
- 一组单元测试结果

## Business Rules
- `VITE_VIBESCORE_HTTP_TIMEOUT_MS` 未设置时默认 `15000`。
- `0` 表示关闭超时。
- 有效范围 clamp 到 `1000..30000`。
- 触发超时时抛出 `Client timeout after ${ms}ms`。
- 若调用方 `signal` 已中断或中途中断，则优先遵循调用方中断。

## Assumptions
- Node 运行时可用 `AbortController`（或在测试里提供替代）。
- 行为保持与当前实现一致。

## Dependencies
- Node `test` 运行器
- `AbortController` / `setTimeout`

## Risks
- 不同运行时对 `AbortController`/`signal` 细节处理差异。
- 迁移路径可能引入轻微行为偏差（需要测试兜底）。
