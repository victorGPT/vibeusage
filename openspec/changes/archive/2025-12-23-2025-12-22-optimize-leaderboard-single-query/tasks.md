## 1. Implementation
- [x] 1.1 在非快照路径尝试单次查询 `rank <= limit OR is_me = true`。
- [x] 1.2 Edge 内拆分 `entries` 与 `me`，保持排序与响应结构一致。
- [x] 1.3 单次查询失败时回退双查询。

## 2. Verification
- [x] 2.1 新增 acceptance 脚本验证单次查询路径与回退路径。
- [x] 2.2 运行 acceptance 脚本并记录结果。

### Evidence
- 2025-12-22: `node scripts/acceptance/leaderboard-single-query.cjs`
- Result: `ok: true`, `single entries: 1`, `fallback entries: 1`
