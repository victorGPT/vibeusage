# 让你的 AI Agent 安装 VibeUsage

这份文档是给 **ChatGPT、Claude、Codex、OpenClaw 或其他 AI Agent** 用的安装说明。

目标不是让用户自己手动折腾，而是：**把下面这段说明直接发给你的 Agent，它就可以帮你完成安装。**

## 直接复制给 Agent

把下面整段原样发给你的 AI 助手：

```text
请帮我安装 VibeUsage，用来追踪 AI Coding CLI 的 Token 用量。

要求：
1. 先检查我的环境是否满足要求
2. 如果缺依赖，告诉我缺什么
3. 安装并初始化 VibeUsage
4. 安装完成后帮我验证状态
5. 如果是 OpenCode 用户，额外检查 sqlite3 是否可用
6. 不要修改与 VibeUsage 无关的配置

请按这个顺序执行：

1) 检查 Node.js 版本（需要 Node.js 20.x）
2) 如有需要，检查 sqlite3 是否可用
3) 运行：
   npx --yes vibeusage init
4) 安装完成后运行：
   vibeusage status
5) 如需手动补同步，再运行：
   vibeusage sync

补充说明：
- 从 vibeusage@0.3.0 开始，只有 init 会修改本地客户端配置
- status、diagnostics、doctor、sync 都是只读命令，不会自动修复旧安装
- OpenCode 当前以本地 SQLite 为主数据源：~/.local/share/opencode/opencode.db
- OpenClaw 使用 session plugin + 本地 sanitized usage ledger；如果安装了 OpenClaw，可能需要提醒我重启 gateway
- 不要上传我的代码、prompt 或 response 内容
```

## Agent 在做什么

运行 `npx --yes vibeusage init` 时，VibeUsage 会：

1. 检测本地支持的 AI 客户端
2. 安装轻量 hook / plugin
3. 创建本地数据目录 `~/.vibeusage/`
4. 引导浏览器认证，或接受 dashboard 的 link code
5. 执行一次初始同步

> 说明
> 从 `vibeusage@0.3.0` 开始，只有 `init` 会修改本地客户端配置。`status`、`diagnostics`、`doctor`、`sync` 都是只读命令；如果是旧安装，请重新执行一次 `vibeusage init`。

## 环境要求

- **Node.js 20.x**
- 当前主要支持 **macOS**
- 若使用 OpenCode，为了获得完整支持，系统需要可执行的 **`sqlite3`**

> 说明
> 当前 OpenCode 版本的本地用量真源是 `~/.local/share/opencode/opencode.db`（可由 `OPENCODE_HOME` 覆盖），不是旧版 `storage/message/**/*.json`。

## 支持自动配置的客户端

VibeUsage 会自动检测并配置以下客户端：

| 客户端 | 配置 / 数据来源 |
|--------|----------------|
| Codex CLI | `~/.codex/config.toml` + rollout logs |
| Every Code | `~/.code/config.toml` + rollout logs |
| Gemini CLI | `~/.gemini/settings.json` + session files |
| OpenCode | 全局插件 + 本地 SQLite |
| Claude Code | Claude plugin + `~/.claude/projects/**` logs |
| OpenClaw | Session plugin + 本地 sanitized usage ledger |

## 安装完成后怎么验证

```bash
# 查看当前状态
vibeusage status

# 如需手动同步
vibeusage sync

# 健康检查
vibeusage doctor
```

## 常用命令

```bash
# 安装 / 修复本地接入
npx --yes vibeusage init

# 查看状态
vibeusage status

# 手动同步
vibeusage sync

# 输出诊断 JSON
vibeusage diagnostics --out diagnostics.json

# 健康检查
vibeusage doctor

# 卸载
vibeusage uninstall

# 完全清除（包括本地数据）
vibeusage uninstall --purge
```

## 故障排除

### 问题：命令找不到
确保 Node.js 20.x 已安装，然后重新运行：

```bash
npx --yes vibeusage init
```

### 问题：同步失败
先检查网络连接，再运行：

```bash
vibeusage sync --debug
```

### 问题：OpenCode 用量不完整
先运行：

```bash
vibeusage status
vibeusage doctor
```

重点确认 `OpenCode SQLite reader` / `opencode.sqlite_status`：

- 如果是 `missing-sqlite3`：先安装 `sqlite3`
- 如果是 `query-failed`：保留 `vibeusage sync --debug` 输出继续排查

### 问题：OpenClaw 用量没进来
按顺序检查：

1. `npx --yes vibeusage init`
2. 重启 OpenClaw gateway
3. 先跑一个真实 OpenClaw turn
4. 运行 `vibeusage sync --from-openclaw`
5. 再看 `vibeusage status` / `vibeusage doctor`

### 问题：某些客户端没有被配置
重新运行：

```bash
npx --yes vibeusage init
```

只读命令不会自动修复旧 hook / plugin 布局。

## 隐私说明

- 只追踪 Token 用量和少量 usage 元数据
- 不上传代码、prompt、response、transcript 内容
- 数据首先在本地解析与聚合
- OpenClaw 仅走 sanitized usage 路径

## 相关链接

- 官网: https://www.vibeusage.cc
- GitHub: https://github.com/victorGPT/vibeusage
- README: https://github.com/victorGPT/vibeusage/blob/main/README.md
- 中文 README: https://github.com/victorGPT/vibeusage/blob/main/README.zh-CN.md
