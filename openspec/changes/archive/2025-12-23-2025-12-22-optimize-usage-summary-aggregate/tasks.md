## 1. Implementation
- [x] 1.1 在 `usage-summary` 的 UTC 路径加入 DB 聚合尝试（SUM/COUNT）。
- [x] 1.2 聚合失败时回退到旧逻辑。

## 2. Verification
- [x] 2.1 新增 acceptance 脚本：聚合成功时不触发日表全量读取。
- [x] 2.2 运行 acceptance 脚本。
