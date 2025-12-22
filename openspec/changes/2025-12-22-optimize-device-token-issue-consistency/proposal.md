# Change: Improve device-token-issue consistency with compensation

## 结论
基于第一性原理（避免半成功写入造成数据不一致），在 `device-token-issue` 的双写流程中加入失败补偿：若写入 token 失败，回滚已写入的 device 记录。该方案在不引入新 DB 依赖的前提下显著降低孤儿数据概率。

## Why
- 当前流程是两次独立 insert：先写 device，再写 token。
- 第二次失败时会遗留孤儿 device，影响数据一致性与后续统计。

## What Changes
- 维持两次 insert，但在 token insert 失败时执行补偿删除 device。
- 接口契约与响应结构保持不变。
- 可选：补偿失败时记录错误日志（不影响响应）。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-device-token-issue.js`
- 风险：补偿删除失败（best-effort）；仍优于当前一致性。
