# Change: Optimize backend probe cadence and backoff

## 结论
基于第一性原理（探活要“足够快但不过度频繁”），将前端探活改为“更低基础频率 + 失败时短间隔重试 + 成功后退避”，减少无意义请求压力，同时保持可见性与可用性判断。

## Why
- 当前 `probeBackend` 以固定间隔轮询，即使长期稳定也会持续打到后端。
- 在活跃用户多时会形成不必要的固定负载。

## What Changes
- 增加“成功后退避、失败时短间隔重试”的调度策略。
- 可选：将默认轮询间隔从 60s 提升到 120s/300s（具体由实现阶段确认）。
- 不新增健康检查 endpoint（先用调频策略优化）。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `dashboard/src/hooks/use-backend-status.js`、`dashboard/src/lib/vibescore-api.js`
- 风险：状态刷新变慢；通过失败重试与手动刷新保证可用性。
