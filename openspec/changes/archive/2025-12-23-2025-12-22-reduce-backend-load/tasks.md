## 1. Investigation
- [x] 1.1 统计当前 `period=week|month` 时的 network 请求数量（baseline 证明重复调用）。

## 2. Implementation
- [x] 2.1 新增共享层：统一拉取 `usage-daily` 并派生 `summary` 与 `trend`。
- [x] 2.2 更新 `DashboardPage`/hooks 使 `trend` 复用同一份 daily 数据。
- [x] 2.3 在 `period=total` 时仍使用后端 `usage-summary`。
- [x] 2.4 保持缓存 key 与现有 `add-dashboard-cache` 变更一致（避免冲突）。

## 3. Verification
- [x] 3.1 添加 BigInt 汇总单元测试（daily → summary）。
- [x] 3.2 手动验证：`period=week|month` 仅一次 `usage-daily` 请求。
