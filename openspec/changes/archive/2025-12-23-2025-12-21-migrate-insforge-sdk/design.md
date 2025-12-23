# Design: Migrate to @insforge/sdk (CLI + Dashboard)

## Module Brief

### Scope
- **IN**: CLI 与 Dashboard 全部 InsForge 访问链路迁移到 `@insforge/sdk`；统一 client 初始化与鉴权注入方式；清理旧 HTTP 封装。
- **OUT**: 任何后端逻辑改动、数据模型变更、权限边界变化。

### Interfaces
- CLI:
  - `src/lib/insforge-client.js`：创建并返回 SDK client（Node 运行时）。
  - `src/lib/vibescore-api.js`：调用 SDK 完成 `auth`、`functions`、`database` 相关请求。
- Dashboard:
  - `dashboard/src/lib/insforge-client.js`：创建并返回 SDK client（Browser/Vite）。
  - `dashboard/src/lib/vibescore-api.js`：替换原 `fetchJson` 流程，使用 SDK 调用。

### Data flow & constraints
- CLI：
  - `signInWithPassword` → 获得 `accessToken`（短期使用）→ `issueDeviceToken` → 持久化 **device token**（禁止持久化 `user_jwt`）。
  - `ingest` 使用 `device_token` 调用 edge function。
- Dashboard：
  - `/auth/callback` 解析 `access_token` → 仅本地存储使用（与现有逻辑一致）。
  - 所有查询通过 SDK 以 `Authorization: Bearer <user_jwt>` 访问现有 functions。
- 运行时：
  - CLI 为 CommonJS（Node 18+），需确认 SDK 是否支持 CJS 或需要动态 `import()` 适配。
  - Dashboard 为 Vite（ESM）。
- 配置：
  - `baseUrl` 来自现有环境变量与配置（保持一致）。
  - `anonKey` 是否必须：需根据 SDK 认证机制确认是否要新增 `VIBESCORE_INSFORGE_ANON_KEY` 与 `VITE_VIBESCORE_INSFORGE_ANON_KEY`（避免硬编码）。

### Non-negotiables
- 不硬编码任何密钥（`anonKey`、`service role key` 等）。
- CLI 不得持久化 `user_jwt`；只持久化 `device token`。
- 不改变现有 API 契约与行为（输出字段、错误码语义）。
- SDK 引入后依然保证可追踪与可回滚（保留变更前的提交作为 freeze 点）。

### Test strategy
- CLI：最小回归验证 `init` / `sync` / `status`；需要至少一条可重复脚本或测试覆盖 SDK 适配层。
- Dashboard：`npm --prefix dashboard run build` + 手动登录与加载数据验证。
- 若 SDK 具备 mock/测试模式，优先用于离线验证。

### Milestones (with acceptance)
- **M1 SDK lock-in**
  - Acceptance: 两个 `package.json` 均锁定到同一 `@insforge/sdk` 版本；`insforge-client` 初始化完成（但尚未替换调用）。
- **M2 CLI migration**
  - Acceptance: CLI 所有 InsForge 调用改为 SDK；`npm test` 通过；关键 CLI 路径可手动验证。
- **M3 Dashboard migration**
  - Acceptance: Dashboard fetch 路径全部改为 SDK；`npm --prefix dashboard run build` 通过；登录后数据可加载。
- **M4 Cleanup & freeze**
  - Acceptance: 旧 HTTP 封装不再被引用；文档更新；记录 freeze commit。

### Plan B triggers
- SDK 不支持 Node CJS 或 CLI 运行时：
  - 触发条件：无法在 Node 18 CJS 运行，或需要大规模改造 CLI 模块系统。
  - Plan B：CLI 仅保留原 fetch 逻辑，Dashboard 迁移 SDK；CLI 使用适配层或延后迁移。
- SDK 无法覆盖 `auth` 或 `functions` 功能：
  - 触发条件：SDK 不提供等价能力或行为不一致。
  - Plan B：保留特定路径的旧实现（最小范围）。

### Upgrade plan (disabled by default)
- 暂不启用持续升级策略；仅在 SDK 版本出现安全或兼容性问题时再启用。

## Decisions
- 采用 SDK client 封装层统一注入 `baseUrl` 与 `Authorization`，避免散落在各处。
- 迁移采用“先锁版本 → CLI → Dashboard → 清理”的顺序，降低回滚成本。

## Open Questions
- SDK 是否支持 Node CJS？若不支持，CLI 端是否采用动态 `import()` 适配？
- SDK 对 `auth`（email/password）与 `functions` 调用的 API 形态？
- 是否需要引入 `anonKey` 作为必须配置？若必须，需新增环境变量与文档。
