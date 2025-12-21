# Change: 提升 InsForge 低配稳定性（ingest + dashboard + CLI）

## Why
- 当前偶发 `vibescore-ingest` 超时，表现为间歇性不可用；这更像运行时抖动或单次请求成本过高。
- $5/月 规格预算有限，稳定性取决于“单位时间请求量 × 单次请求成本”。
- 现有 ingest 在 anon key 路径上可能触发逐条写入（重复事件场景），导致单次请求成本显著上升。
- Dashboard 常驻时有固定轮询（15s）探针，属于可优化的持续负载。

## What Changes
- **降低单次请求成本**：优化 `vibescore-ingest` 的重复事件处理，避免常态路径的逐条写入（优先批量写 + 去重）。
- **增强客户端退避**：CLI 自动同步在 retryable 失败时严格遵循 `Retry-After`，并减少 burst。
- **降低常驻负载**：Dashboard 后端探针降频，且在页面不可见时暂停轮询。
- **保留无 service role 运行能力**：不新增运行时密钥硬依赖。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `insforge-src/functions/vibescore-ingest.js`
  - `src/lib/upload-throttle.js`
  - `dashboard/src/hooks/use-backend-status.js`
  - 相关测试脚本与文档
