## 1. Implementation
- [x] 1.1 在 `usage-hourly` 的 UTC 路径加入 DB 按小时聚合尝试（`date_trunc('hour') + sum`）。
- [x] 1.2 聚合失败时回退到旧逻辑（拉事件 + Edge 分桶）。
- [x] 1.3 保持响应结构一致（`day/data`）。

## 2. Verification
- [x] 2.1 新增 acceptance 脚本覆盖聚合成功与回退路径。
- [x] 2.2 运行 acceptance 脚本并记录结果。

证据：
- 2025-12-22 运行 `node scripts/acceptance/usage-hourly-aggregate.cjs`，输出 `ok: true`。
