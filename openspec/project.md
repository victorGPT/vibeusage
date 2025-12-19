# VibeScore Tracker（Codex CLI Token Usage）

## 0. 一句话简介

面向 **Codex CLI** 用户的 token 消耗统计：本地增量解析 `~/.codex/sessions/**/rollout-*.jsonl` 的 `token_count` 事件 → 本地队列 → 云端聚合 → Dashboard 展示（按 UTC 日聚合为主）。

## 1. 背景与目标

我们要做一款面向 **Codex CLI** 用户的 token 消耗统计产品：客户端自动采集本地 token 使用量并同步到云端，云端提供仪表盘展示。

本仓库的 MVP 聚焦：

- **平台**：macOS 优先
- **统计维度**：全局（不按项目/cwd 拆分）
- **触发机制**：优先使用 Codex CLI 的 `notify`（`agent-turn-complete`）事件驱动采集；离线/失败通过 `sync` 补账

## 2. 非目标（MVP 不做）

- 不做近实时保证（只保证“最终一致”）
- 不上传或存储对话内容（prompt/response 文本）
- 不做跨平台安装器（`.pkg/.msi`）与系统级服务（后续可选）
- 不做“每条 token 归因到 thread/turn”的精确关联（受日志字段稳定性限制）

## 3. 术语表（Glossary）

- **Codex CLI**：本地运行的 CLI；其 `notify` 能在 turn 完成时触发外部命令。
- **notify**：Codex CLI 配置项 `notify = [...]`，在事件触发时执行命令（本项目用于触发后台同步）。
- **rollout JSONL**：`~/.codex/sessions/**/rollout-*.jsonl`，按行 JSON 记录（包含 `token_count`、对话内容等）。
- **token_count event**：`payload.type == "token_count"` 的记录；本项目只允许读取 `payload.info.*` 的 token 数字字段。
- **cursor**：每个 rollout 文件的解析位置（`path + inode + byte_offset`）及上次 totals，用于增量解析与差分兜底。
- **event_id**：客户端生成的稳定事件标识（当前实现：对原始 JSONL 行 `sha256`）。
- **device token**：用于 ingest 的长效设备级 token（客户端持有；服务端仅存 hash）。
- **user_jwt / accessToken**：用户登录态 token（Dashboard/CLI 仅短暂使用获取 device token；CLI 不持久化）。
- **InsForge**：云端后端（Auth + Database + Edge Functions）。

## 4. 架构概览（第一性原则）

**触发器是稀缺资源**：不常驻又要自动，就必须依赖“外部触发器”。默认用 Codex CLI 的 `notify`；若未来支持 `--no-notify`，则需要操作系统定时任务运行 `sync --auto`（MVP 不做）。

数据链路（默认 notify 方案）：

1. Codex CLI 在 turn 完成时触发 `notify`（payload 类型 `agent-turn-complete`）
2. 本地 `notify-handler` 快速落盘并退出 0（写入信号 + 节流触发后台 `sync --auto`），不得阻塞 Codex
3. `sync` 增量扫描 `~/.codex/sessions/**/rollout-*.jsonl`，只提取 `token_count` 的白名单字段，写入本地 append-only 队列
4. 批量上传到 InsForge（鉴权 + 幂等去重 + 聚合）
5. Dashboard 以 user_jwt 查询聚合结果并展示（UTC）

## 5. 数据与接口契约（高层）

### 5.1 客户端本地状态（Source of truth）

根目录：`~/.vibescore/`

- `~/.vibescore/tracker/config.json`：`baseUrl`、`deviceToken`、`deviceId`、`installedAt`
- `~/.vibescore/tracker/cursors.json`：解析游标（按文件）+ 上次 totals（用于 totals 差分）
- `~/.vibescore/tracker/queue.jsonl`：待上传事件（append-only）
- `~/.vibescore/tracker/queue.state.json`：已上传 offset（用于幂等、断点续传）
- `~/.vibescore/bin/notify.cjs`：notify handler（依赖 Node built-ins；快速返回）

### 5.2 事件模型（白名单字段）

允许上传的事件字段（客户端 → 云端 ingest）：

- `event_id`（string）
- `token_timestamp`（ISO timestamp string，UTC）
- `model`（string|null）
- `input_tokens` / `cached_input_tokens` / `output_tokens` / `reasoning_output_tokens` / `total_tokens`（non-negative integer）

硬约束：客户端解析 rollout 时 **不得** 持久化或上传任何对话/工具输出文本。

### 5.3 云端接口（Edge Functions）

提示（开发者必读）：

- 更详细的接口契约、示例、以及 build/deploy 说明：见仓库根目录 `BACKEND_API.md`
- Edge Functions 源码在 `insforge-src/`；部署产物在 `insforge-functions/`（单文件、生成物）
  - 修改后端逻辑：改 `insforge-src/` → 运行 `npm run build:insforge` → 用 `insforge2 update-function` 部署

- `POST /functions/vibescore-device-token-issue`
  - Auth：`Authorization: Bearer <user_jwt>`（或 admin bootstrap：Bearer `<service_role_key>` + body `user_id`）
  - In：`{ device_name?: string, platform?: string }`
  - Out：`{ device_id: string, token: string, created_at: string }`
- `POST /functions/vibescore-ingest`
  - Auth：`Authorization: Bearer <device_token>`
  - In：`{ events: Event[] }` 或 `Event[]`
  - Out：`{ success: true, inserted: number, skipped: number }`
- `GET /functions/vibescore-usage-daily?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Auth：`Authorization: Bearer <user_jwt>`
  - Out：`{ from, to, data: [{ day, total_tokens, ... }] }`
- `GET /functions/vibescore-usage-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Auth：`Authorization: Bearer <user_jwt>`
  - Out：`{ from, to, days, totals: { ... } }`（bigint 以 string 返回）
- `GET /functions/vibescore-usage-heatmap?weeks=52&to=YYYY-MM-DD&week_starts_on=sun|mon`
  - Auth：`Authorization: Bearer <user_jwt>`
  - Out：heatmap grid（详见 `BACKEND_API.md`）
- `GET /functions/vibescore-leaderboard?period=day|week|month|total&limit=20`
  - Auth：`Authorization: Bearer <user_jwt>`
  - Out：`{ period, from, to, entries, me }`（详见 `BACKEND_API.md`）
- `POST /functions/vibescore-leaderboard-settings`
  - Auth：`Authorization: Bearer <user_jwt>`
  - In：`{ leaderboard_public: boolean }`
  - Out：`{ leaderboard_public: boolean, updated_at: string }`

### 5.4 数据表（InsForge Database）

以云端代码为准（当前函数使用的表名）：

- `vibescore_tracker_devices`：设备元信息（含 `last_seen_at`）
- `vibescore_tracker_device_tokens`：设备 token hash（含 `revoked_at`、`last_used_at`）
- `vibescore_tracker_events`：明细事件（幂等去重以 `event_id` 为核心；包含 `device_token_id` 便于无 service role key 写入鉴权）
- `vibescore_tracker_daily`：按 UTC 日聚合（SQL view，普通视图；定义与演进不在本仓库）

## 6. 配置与环境变量

### 6.1 CLI（Node）

- `VIBESCORE_INSFORGE_BASE_URL`：InsForge base URL（默认：`https://5tmappuk.us-east.insforge.app`）
- `VIBESCORE_DASHBOARD_URL`：可选；用于 CLI 打开自托管 `/connect` 页面
- `VIBESCORE_DEVICE_TOKEN`：可选；用于无交互配置 device token（覆盖本地 config）
- `CODEX_HOME`：可选；覆盖 Codex home（默认 `~/.codex`）

### 6.2 Dashboard（Vite）

- `VITE_VIBESCORE_INSFORGE_BASE_URL`
- UI 组件库统一使用：`dashboard/src/ui/matrix-a/components`

### 6.3 InsForge Edge Functions（Deno）

- `INSFORGE_SERVICE_ROLE_KEY`（或 `SERVICE_ROLE_KEY`）：可选；仅用于 admin bootstrap（若需要）
- `INSFORGE_INTERNAL_URL`：内部 base URL（默认 `http://insforge:7130`）
- `INSFORGE_ANON_KEY`（或 `ANON_KEY`）：用于无 service role key 场景下的 records API 写入（ingest）

## 7. OpenSpec 组织方式与写作约定

### 7.1 目录与命名

- `openspec/specs/`：稳定规格（“我们要做什么、边界与约束是什么”）
  - 本仓库当前采用 **一文件一能力**：`openspec/specs/<capability>.md`（例如 `vibescore-tracker.md`）
- `openspec/changes/<id>/`：具体变更执行（任务拆分、进度与证据）

变更 ID 命名规则：`YYYY-MM-DD-<slug>`（例如 `2025-12-17-vibescore-tracker`）。

补充约定：

- `<slug>` 使用 `kebab-case`
- `<slug>` 推荐以动词开头（例如 `YYYY-MM-DD-add-diagnostics`），以兼容 OpenSpec 的 verb-led 习惯

### 7.2 需求与场景写法（建议）

- 需求用规范措辞表达（必要时可用英文关键词）：`SHALL` / `MUST` / `MUST NOT` / `SHOULD`
- 每个关键需求至少给出一个可执行的场景（`WHEN/THEN`），并能落到验证命令或脚本
- 文档中出现的命令、路径、环境变量、标识符一律用反引号包裹（例如 `tracker sync --auto`、`~/.vibescore/tracker/queue.jsonl`）

### 7.3 变更流程（提案 → 实现 → 归档）

- 新能力 / 架构改变 / 影响安全与隐私的改动：必须先创建变更提案（`openspec/changes/<id>/proposal.md` + `tasks.md`）
- 实现过程中以 `tasks.md` 为单一进度事实来源（完成即打勾）
- 变更上线后：归档 change，并更新对应稳定 spec（保持 `openspec/specs/` 与现实一致）

## 8. 质量门槛（最小验证）

- 每次修改 notify 相关逻辑：必须验证 `init` 幂等、notify 链式保留、`uninstall` 可恢复
- 每次修改解析器/事件模型：必须验证“只提取白名单字段”、且重复 `sync` 不重复计数（幂等）
- 每次修改 ingest/鉴权：必须验证错误码、鉴权边界与幂等去重
