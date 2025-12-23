## 1. Implementation
- [x] 1.1 在 token 写入失败时执行补偿删除 device。
- [x] 1.2 确保错误返回与日志记录一致（不泄露敏感信息）。

## 2. Verification
- [x] 2.1 新增 acceptance 脚本模拟 token insert 失败并验证补偿执行。
- [x] 2.2 运行 acceptance 脚本并记录结果。
