## 1. Implementation
- [x] 1.1 在 `usage-monthly` 的 UTC 路径加入 DB 按月聚合尝试（`date_trunc` + `sum`）。
- [x] 1.2 聚合失败时回退到旧逻辑（拉日表 + Edge 汇总）。
- [x] 1.3 保持响应结构一致（`from/to/months/data`）。

## 2. Verification
- [x] 2.1 新增 acceptance 脚本覆盖聚合成功路径与回退路径。
- [x] 2.2 运行 acceptance 脚本并记录结果。
