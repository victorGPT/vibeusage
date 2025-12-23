## 1. Implementation
- [x] 1.1 调整 `use-backend-status` 的探活调度：成功后退避、失败时短间隔重试。
- [x] 1.2 明确默认间隔与退避上限（实现阶段确定）。

## 2. Verification
- [x] 2.1 新增 acceptance/脚本验证调度策略随状态变化。
- [x] 2.2 运行验证脚本并记录结果。
