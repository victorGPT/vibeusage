# VibeScore Tracker（Codex CLI Token Usage）

## 0. 一句话简介

面向 **Codex CLI** 用户的 token 消耗统计：本地增量解析 `~/.codex/sessions/**/rollout-*.jsonl` 的 `token_count` 事件 → 本地按 UTC 半小时聚合 → 云端存储半小时桶 → Dashboard 汇总展示。

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
- **hour_start**：UTC 半小时桶起点（ISO timestamp，分钟为 `00` 或 `30`），作为幂等键之一。
- **half-hour bucket**：某设备某 UTC 半小时的 token 聚合（含各 token 字段总和）。
- **device token**：用于 ingest 的长效设备级 token（客户端持有；服务端仅存 hash）。
- **user_jwt / accessToken**：用户登录态 token（Dashboard/CLI 仅短暂使用获取 device token；CLI 不持久化）。
- **InsForge**：云端后端（Auth + Database + Edge Functions）。

## 4. 架构概览（第一性原则）

**触发器是稀缺资源**：不常驻又要自动，就必须依赖“外部触发器”。默认用 Codex CLI 的 `notify`；若未来支持 `--no-notify`，则需要操作系统定时任务运行 `sync --auto`（MVP 不做）。

数据链路（默认 notify 方案）：

1. Codex CLI 在 turn 完成时触发 `notify`（payload 类型 `agent-turn-complete`）
2. 本地 `notify-handler` 快速落盘并退出 0（写入信号 + 节流触发后台 `sync --auto`），不得阻塞 Codex
3. `sync` 增量扫描 `~/.codex/sessions/**/rollout-*.jsonl`，只提取 `token_count` 白名单字段并按 UTC 半小时聚合，写入本地 append-only 队列
4. 批量上传到 InsForge（鉴权 + 幂等去重 + 聚合；`sync --auto` 上传节流 ≤ 1 次 / 30 分钟，`init`/手动 `sync` 立即上传）
5. Dashboard 以 user_jwt 查询聚合结果并展示（UTC）

## 5. 数据与接口契约（高层）

### 5.1 客户端本地状态（Source of truth）

根目录：`~/.vibescore/`

- `~/.vibescore/tracker/config.json`：`baseUrl`、`deviceToken`、`deviceId`、`installedAt`
- `~/.vibescore/tracker/cursors.json`：解析游标（按文件）+ 上次 totals（用于 totals 差分）
- `~/.vibescore/tracker/queue.jsonl`：待上传半小时聚合桶（append-only）
- `~/.vibescore/tracker/queue.state.json`：已上传 offset（用于幂等、断点续传）
- `~/.vibescore/bin/notify.cjs`：notify handler（依赖 Node built-ins；快速返回）

### 5.2 半小时桶模型（白名单字段）

允许上传的半小时桶字段（客户端 → 云端 ingest）：

- `hour_start`（ISO timestamp string，UTC half-hour boundary）
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
  - In：`{ hourly: HalfHourBucket[] }` 或 `HalfHourBucket[]`
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
- `vibescore_tracker_hourly`：按 UTC 半小时聚合（幂等键：`user_id + device_id + hour_start`）
- `vibescore_tracker_events`：明细事件（legacy；新路径不再写入）
- `vibescore_tracker_daily`：按 UTC 日聚合（legacy 视图/表；使用时从 half-hour 汇总）

## 6. 配置与环境变量

### 6.1 CLI（Node）

- `VIBESCORE_INSFORGE_BASE_URL`：InsForge base URL（默认：`https://5tmappuk.us-east.insforge.app`）
- `VIBESCORE_INSFORGE_ANON_KEY`：可选；InsForge anon key（SDK 使用）。若未设置，则回退 `INSFORGE_ANON_KEY`
- `VIBESCORE_DASHBOARD_URL`：可选；用于 CLI 打开自托管 landing page（根路径），并携带 `redirect`
- `VIBESCORE_DEVICE_TOKEN`：可选；用于无交互配置 device token（覆盖本地 config）
- `VIBESCORE_HTTP_TIMEOUT_MS`：可选；HTTP 请求超时（毫秒）。`0` 表示关闭超时；默认 `20000`；取值会被限制在 `1000..120000`
- `VIBESCORE_DEBUG`：可选；`1` 时输出请求/响应与原始错误信息（仅 stderr）
- `CODEX_HOME`：可选；覆盖 Codex home（默认 `~/.codex`）

### 6.2 Dashboard（Vite）

- `VITE_VIBESCORE_INSFORGE_BASE_URL`
- `VITE_VIBESCORE_INSFORGE_ANON_KEY`：可选；Dashboard SDK 用的 anon key（回退 `VITE_INSFORGE_ANON_KEY`）
- UI 组件库统一使用：`dashboard/src/ui/matrix-a/components`
- `VITE_VIBESCORE_MOCK`：可选；`1|true` 时使用本地 mock 数据（可用 `?mock=1`）
- `VITE_VIBESCORE_MOCK_SEED`：可选；mock 数据种子（可用 `?mock_seed=xxx`）

### 6.3 InsForge Edge Functions（Deno）

- `INSFORGE_SERVICE_ROLE_KEY`（或 `SERVICE_ROLE_KEY`）：可选；仅用于 admin bootstrap（若需要）
- `INSFORGE_INTERNAL_URL`：内部 base URL（默认 `http://insforge:7130`）
- `INSFORGE_ANON_KEY`（或 `ANON_KEY`）：用于无 service role key 场景下的 records API 写入（ingest）
- `VIBESCORE_USAGE_MAX_DAYS`：usage summary/daily/model-breakdown 最大天数（默认 `370`）
- `VIBESCORE_SLOW_QUERY_MS`：usage 查询慢日志阈值（毫秒；默认 `2000`）

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
- 每次提交：必须执行回归用例（至少覆盖本次变更相关路径），并记录执行命令与结果

## 9. 文案治理（Copy Registry）

- **单一事实来源**：本项目页面上所有展示文字，必须由 `dashboard/src/content/copy.csv` 统一管理。
- **改动汇总**：任何页面文案变更都必须先更新文案表，禁止在组件内硬编码新文案。
- **双向同步**：文案表与项目官网内容必须保持一致；官网文案改动必须回写到表内，表内更新也必须同步到官网。
- **变更流程（必须遵守）**：
  1. 先从官方基线拉取并核对：`node scripts/copy-sync.cjs pull --dry-run`（必要时 `--apply`）
  2. 再修改 `dashboard/src/content/copy.csv` 与本地代码（如组件/页面）
  3. 校验注册表：`node scripts/validate-copy-registry.cjs`
  4. 推送到远端：
     - 仅 `copy.csv` 改动：`node scripts/copy-sync.cjs push --confirm --push-remote`
     - 含代码改动：`git add` → `git commit` → `git push`
