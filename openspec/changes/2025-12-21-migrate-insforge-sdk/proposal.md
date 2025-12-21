# Change: Migrate clients to InsForge SDK (CLI + Dashboard)

## Why
当前代码库未使用官方 `@insforge/sdk`，而是分别维护自定义的 HTTP 调用逻辑（CLI 与 Dashboard 各一套）。这带来接口分散、维护成本高、与官方 SDK 行为不一致的问题。此次改动的目标是统一官方 SDK 使用方式，并降低长期维护风险。

## What Changes
- 在根目录与 `dashboard/` 同时引入 `@insforge/sdk@1.0.4`（锁定到当前最新版本）。
- 新增 SDK client 封装层（CLI 与 Dashboard 各自独立），统一注入 `baseUrl`/auth token。
- 全量迁移现有调用链路至 SDK（包含 auth、functions 与数据库访问），移除或收敛旧的 fetch 封装。
- 保持既有业务行为不变（数据含义、权限边界、UI 行为不变）。

## Non-goals
- 不变更 InsForge 后端函数实现。
- 不调整数据模型与 API 契约。
- 不引入新的鉴权机制（仍以 `user_jwt` / `device_token` 为边界）。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`（预期无行为变化，不新增 spec delta）。
- Affected code (预计):
  - CLI：`src/lib/vibescore-api.js`, `src/lib/insforge.js`, 相关调用方
  - Dashboard：`dashboard/src/lib/vibescore-api.js`, `dashboard/src/lib/http.js`, 相关 hooks
  - 新增：`src/lib/insforge-client.js`, `dashboard/src/lib/insforge-client.js`

## Milestones & Acceptance (high level)
- M1: SDK 版本锁定 + client 初始化方案落地（CLI 与 Dashboard）
- M2: CLI 全链路迁移完成且回归验证通过
- M3: Dashboard 全链路迁移完成且回归验证通过
- M4: 旧封装清理 + 文档/任务闭环（含冻结信息）
