# Change: Add ingest guardrails (M1 logs, canary, concurrency cap)

## Why
- 事故发生在数据库认证阶段且缺少可归因证据，必须补齐 M1 结构化日志以做到责任可追溯。
- 需要低成本的 canary 探针与并发抑制，避免同类单次宕机放大。

## What Changes
- 为 `vibescore-ingest` / `vibescore-device-token-issue` / `vibescore-sync-ping` 增加 M1 结构化日志。
- 为 `vibescore-ingest` 增加并发上限与 `Retry-After` 响应。
- 新增 canary 脚本用于外部定时探测（不影响真实用户数据）。
- usage 端默认排除 `source=model=canary` 桶（除非显式请求）。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code: `insforge-src/functions/*`, `insforge-src/shared/*`, `scripts/ops/*`, `scripts/acceptance/*`
- **BREAKING**: None

## Architecture / Flow
- 请求进入函数时记录 M1 日志，必要时使用 `logger.fetch` 记录上游状态。
- `vibescore-ingest` 在进入 DB 访问前执行并发守卫，超过上限返回 `429` + `Retry-After`。
- canary 使用专用 device token + `source=model=canary` 生成独立桶。

## Risks & Mitigations
- 风险：新增并发限制可能导致高峰期 429。
  - 缓解：默认上限适中，可通过环境变量调优；客户端已有退避逻辑。
- 风险：日志量增加。
  - 缓解：仅记录结构化字段，不记录 payload。

## Rollout / Milestones
- M1: 完成需求/验收/测试策略/里程碑。
- M2: 落地 M1 日志与并发限制。
- M3: 增加 canary 与合成验收脚本。
