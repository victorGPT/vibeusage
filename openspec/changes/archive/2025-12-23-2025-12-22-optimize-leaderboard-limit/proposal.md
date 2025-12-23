# Change: Optimize leaderboard fallback fetch with DB limit

## 结论
基于第一性原理（只取必要数据，避免过度搬运），在 `vibescore-leaderboard` 的非快照路径中把 `limit` 下推到数据库查询，避免拉取全量榜单后再在 Edge 截断，减少 DB/网络负担且不改变接口契约。

## Why
- 当前非快照路径会读取完整的 leaderboard view，再在 Edge 做 `slice(0, limit)`。
- 当榜单规模增长时，这会导致无意义的数据传输与内存占用。

## What Changes
- 在 `entriesView` 查询中应用 `.limit(limit)`，仅拉取所需 Top N。
- 其余响应结构与语义保持不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-leaderboard.js`
- 风险：极低（仅减少读取行数）。
