# Change: Optimize leaderboard fallback to a single query

## 结论
基于第一性原理（减少 round-trip、在一次查询内满足必要数据），在 `vibescore-leaderboard` 的非快照路径中尝试用单次查询同时返回 Top N 与当前用户条目，失败则回退双查询，保证正确性与兼容性。

## Why
- 当前回退路径对 `entries` 与 `me` 分别查询，存在额外 DB 往返。
- 合并为单次查询可减少延迟与 DB 连接压力。

## What Changes
- 非快照路径优先执行单次查询：`rank <= limit OR is_me = true`。
- Edge 内拆分 `entries` 与 `me`，保持响应结构不变。
- 单次查询失败时回退到现有双查询流程。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-leaderboard.js`
- 风险：`or()` 语法兼容性；用回退路径保证稳定性。
