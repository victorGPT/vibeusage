## 1. Discovery & Evidence
- [x] 1.1 审阅 auto sync 触发链路（notify → spawn → sync --auto）。
- [x] 1.2 给出“生效/退化/失效”的判定标准与阈值。
- [x] 1.3 输出 runbook（命令与预期信号）。

## 2. Gap Analysis
- [x] 2.1 对照现有 `status`/`diagnostics` 输出，标记缺失信号。
- [x] 2.2 若缺失，提出最小化改进建议（以观测与提示为主）。
- [x] 2.3 增加 `status` 的 auto sync 健康度摘要输出。

## 3. Verification
- [x] 3.1 用本地一次 notify 触发验证 runbook。
- [x] 3.2 记录证据与结论。

### Evidence
- 运行 `npx --yes /tracker status --diagnostics`（2025-12-22T21:52:42Z）结果摘要：\n  - `notify.codex_notify_configured = true`\n  - `notify.last_notify = 2025-12-22T21:51:49.206Z`\n  - `notify.last_notify_triggered_sync = 2025-12-22T21:51:49.207Z`\n  - `queue.pending_bytes = 0`\n  - `upload.last_success_at = 2025-12-22T21:42:37.997Z`\n  - `upload.next_allowed_after = 2025-12-22T21:52:42.118Z`\n  - `upload.backoff_until = null`
