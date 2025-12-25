# Change: Refactor dashboard timeout wrapper into a testable module

## Why
- 当前超时逻辑内嵌于 `insforge-client`，缺乏单测与复用边界。

## What Changes
- 抽取超时封装为独立模块并在 `insforge-client` 中复用。
- 新增单测覆盖默认值、clamp、禁用与中断优先级。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`（无行为变更）
- Affected code: `dashboard/src/lib/insforge-client.js`、新增模块与测试。
- **BREAKING** (if any): 无。

## Architecture / Flow
- `insforge-client` 仅负责组装 client 与依赖注入，超时逻辑由模块提供。

## Risks & Mitigations
- 风险：`AbortController` 语义差异导致行为偏差。
- 缓解：单测覆盖超时与调用方中断路径。

## Rollout / Milestones
- M1/M2 文档确认 → M3 单测 → M4 回归 → M5 线上确认。
