# VibeScore Tracker（Codex CLI Token Usage）规格

## 1. 目标

1. 用户通过一条命令完成安装/初始化：`npx @vibescore/tracker init`
2. 只要用户在使用 Codex CLI，就能自动采集 token 消耗并同步到云端（默认 notify 方案）
3. 支持断网与失败重试：本地先落盘，随后 `sync` 自动/手动补账
4. 云端仪表盘展示全局 token 使用趋势（按天/周/月聚合即可）

## 2. 非目标

- 不追求“每个 turn 精确归因到 thread/turn id”（日志未稳定提供该关联字段）
- 不上传任何对话文本或工具输出内容
- 不在客户端做复杂 UI（只提供诊断与状态命令）

## 3. 数据源与可用性假设

### 3.1 Codex 本地日志

- 主要数据源：`~/.codex/sessions/**/rollout-*.jsonl`
- token 事件：`payload.type == "token_count"`，字段位于 `payload.info`：
  - `last_token_usage`（优先）
  - `total_token_usage`（兜底：做差分）
  - **去重规则（重要）**：Codex 可能会在相邻行重复写入同一笔 `token_count`；当相邻两条记录的 `total_token_usage` **完全相同** 时，客户端 **必须跳过** 该行（否则会把同一笔 `last_token_usage` 重复计入，造成总量膨胀）。
  - **重置兜底（重要）**：当 `last_token_usage` 缺失且相邻两条记录的 `total_token_usage` 出现 **回退/重置**（当前值小于上一条）时，客户端 **应将当前 `total_token_usage` 视为本次增量**，以避免漏计。

### 3.2 不可靠字段（设计时不要依赖）

当前 `token_count` 记录通常不包含稳定的 `thread_id/turn_id/session_id` 等关联字段，因此：

- 统计产品的主能力应是“**全局总量与趋势**”
- 客户端幂等与去重以“文件游标/偏移量”作为事实来源

## 4. 客户端（CLI）职责

客户端只做：发现 → 增量解析 → 本地缓冲 → 安全同步。

### 4.1 安装与初始化（init）

默认方案使用 Codex CLI 的 `notify`：

- 在 `~/.codex/config.toml` 写入顶层 `notify = [...]`
- 必须满足：
  - 幂等：重复 init 不破坏配置
  - 可回滚：写入前做备份；提供 `uninstall` 恢复
  - 可共存：若用户已有 notify，需要链式调用（不得静默覆盖）

建议 notify 入口为本地可执行脚本（避免 `npx` 在 notify 路径中引入不确定性）：

- `notify = ["/usr/bin/env", "node", "~/.vibescore/bin/notify.cjs"]`
- `init` 同时会把 tracker 运行时（`bin/` + `src/`）复制到 `~/.vibescore/tracker/app/`，notify-handler 直接调用该本地副本触发 `sync --auto`

账号绑定（推荐 UX）：

- `init` 默认不要求用户在终端输入邮箱/密码；而是引导用户在浏览器完成注册/登录
- 具体做法：优先打开我们自己的 Dashboard `/connect?redirect=<local_callback_url>`（若配置了 dashboard url）；当 CLI 使用的 `baseUrl` 非默认值时，额外传 `base_url=<backend_base_url>`；否则直接打开 InsForge 内置页面 `/auth/sign-up`（或 `/auth/sign-in`），并携带 `redirect=<local_callback_url>`
  - `local_callback_url` 由 CLI 临时启动的本地回调服务提供（仅监听 `127.0.0.1`），形式：`http://127.0.0.1:<port>/vibescore/callback/<nonce>`
  - 登录成功后浏览器会跳转回 `local_callback_url`，并附带 `access_token`（及 user 信息）给 CLI
- CLI 用 `access_token` 调用 `POST /functions/vibescore-device-token-issue` 获取 **device token**，随后只持有 device token（不持久化 user_jwt）

### 4.2 notify-handler（非阻塞）

约束：

- **必须快速返回**（不阻塞 Codex）
- 失败不影响 Codex：任何错误都吞掉并退出 0

职责（最小化）：

- 记录一个“需要同步”的信号（例如写入本地队列/更新时间戳）
- 可选：以互斥锁方式触发一次后台 `sync --auto`（有锁则跳过）

### 4.3 sync（补账与增量同步）

`sync --auto` 负责：

- 增量扫描 rollout 文件（按 mtime/路径排序）
- 逐行解析 JSONL，只处理 `token_count`
- 抽取最小字段（数字 + 时间戳 + 模型）
- 写入本地队列并上传云端

上传节流（防止 turn 级别触发导致服务端过载，同时保持“只要在用 Codex 就会自动上传”）：

- `notify` 仍可在 turn 完成时高频触发 `sync --auto`，但 **网络上传必须低频批量**：
  - **最小上传间隔**：同一设备 **≤ 1 次 / 30 分钟**（带随机抖动 `0~60s`，避免“整点齐刷刷”）
  - **首包体验**：当设备从“无待上传”变为“有待上传”时，应在 **60 秒内**完成至少一次上传（可立即上传）
  - **积压阈值**：当 `pendingBytes >= 1MB` 时，允许单次 `sync --auto` 增加排空预算（更多批次/更大 batch），用于首次安装/断网恢复/长时间积压的追赶
  - **退避**：遇到 `429` 或 `5xx` 时应指数退避，并尊重 `Retry-After`（若提供）

幂等/游标：

- 维护每个文件的游标：`path + inode + byte_offset`
- 为每条事件生成稳定 `event_id`（MVP：对 `token_count` 原始 JSONL 行做 `sha256`）
- 上传时携带 `event_id`，服务端做唯一约束去重

本地缓冲：

- MVP 采用文件型状态（避免原生依赖，安装更省心）：
  - `~/.vibescore/tracker/config.json`（baseUrl、device token 等）
  - `~/.vibescore/tracker/cursors.json`（文件游标 + 上次 totals）
  - `~/.vibescore/tracker/queue.jsonl` + `queue.state.json`（append-only 队列 + 已上传 offset）
  - `~/.vibescore/tracker/upload.throttle.json`（上传节流与退避状态：last success / next allowed / backoff）
- 后续可迁移到 SQLite（`cursors / queue / meta`）以降低文件数量与提升查询能力

### 4.4 status / diagnostics

至少提供：

- `status`：队列长度、最后同步时间、最近错误
- `diagnostics`：导出脱敏日志（不包含对话内容）

## 5. 云端（InsForge）职责

### 5.1 鉴权与设备绑定

- 使用 InsForge 登录体系
- 为设备签发 **device token**（客户端只持有 device token；绝不使用 admin key）
- 支持“先采集后绑定”：未绑定时只落本地队列；绑定后补传历史

### 5.2 数据入库与幂等

提供 `POST /functions/vibescore-ingest`（edge function）：

- Header：`Authorization: Bearer <device_token>`
- Body：批量事件数组（包含 `event_id` 与 token 字段）
- 服务端：
  - 校验 token → 解析 user_id/device_id
  - `UPSERT` 或唯一约束避免重复写入
  - 返回写入成功数量与跳过数量

设备 token 发行：

- `POST /functions/vibescore-device-token-issue`
  - Header：`Authorization: Bearer <user_jwt>`
  - Body：`{ device_name?: string, platform?: string }`
  - Response：`{ device_id: string, token: string }`（token 仅返回一次）

### 5.3 聚合与查询

最小查询：

- 日聚合：`GET /functions/vibescore-usage-daily?from=YYYY-MM-DD&to=YYYY-MM-DD`（Header：`Authorization: Bearer <user_jwt>`）
- 总览：`GET /functions/vibescore-usage-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`（Header：`Authorization: Bearer <user_jwt>`），返回区间内 totals（bigint 以字符串返回）

Dashboard（MVP）：

- 前端（React）只做最小展示：登录/注册 → 拉取 daily/summary → 表格/简易曲线
- UI 视觉风格：Dashboard UI SHALL 采用“复古 TUI 皮肤”（monospace、窗口化边框、终端配色等），但交互保持标准 Web 方式（鼠标点击、表单输入、链接跳转），不引入真实终端 raw-mode 输入模型
- 动效降级：必须尊重 `prefers-reduced-motion`，自动禁用闪烁/持续动效（如 CRT flicker、背景雨等）
- 统一性：`/connect` 页面与主 Dashboard 使用同一主题与可用性规则（错误提示、按钮、焦点态）
- 登录方式：跳转 InsForge 内置页面 `/auth/sign-in`/`/auth/sign-up`，携带 `redirect=<dashboard>/auth/callback`
  - 登录成功后，`/auth/callback` 从 URL 参数中读取 `access_token` 并在前端持久化（MVP：localStorage），再用于调用上述查询接口
  - 后续可升级为更安全的会话方案（例如 HttpOnly cookie/BFF），但不属于 MVP 目标

## 6. 隐私与安全（硬约束）

- 客户端解析时 **不得持久化** `message.content` / 工具输出等文本字段
- 上传到云端的 payload 仅允许包含：
  - 时间戳、模型名（可选）、token 数字字段、`event_id`、设备标识
- 本地与云端日志都必须避免记录原始对话文本
- 不在客户端硬编码任何云端密钥（包括 InsForge admin key）

## 7. 可验证的验收标准（MVP）

1. `init` 后不需要常驻进程；用户正常使用 Codex CLI 时能够触发采集与同步（允许有延迟）
2. 断网期间产生 token_count 事件不会丢失；网络恢复后 `sync --auto` 能补传
3. 云端仪表盘能展示按天聚合的 token 总量曲线
4. `uninstall` 能恢复 `~/.codex/config.toml` 到 init 前状态（或可选择性移除本产品配置）
