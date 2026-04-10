# Hermes Plugin-Ledger Integration Implementation Plan

> Goal: 让 `vibeusage init` 正式安装并管理 Hermes 集成；Hermes 通过插件 + lifecycle hooks 写本地 usage ledger；`vibeusage sync` 只读取该 ledger 并聚合上传。

## 0. 设计原则

1. **不向后兼容**
   - 不支持解析 `~/.hermes/state.db`
   - 不支持解析 `~/.hermes/sessions/`
   - 不支持 trajectory fallback
   - Hermes support 只认 plugin-ledger path

2. **唯一事实源**
   - 本地 Hermes usage SSOT = `Hermes plugin -> ~/.vibeusage/tracker/hermes.usage.jsonl`
   - 云端 aggregate SSOT = PostgreSQL half-hour aggregates

3. **第一性原理**
   - 在 Hermes `post_api_request` 捕获 normalized usage
   - 不从 transcript 或内部状态逆向推导 usage

4. **原子化提交**
   - Commit 1: spec only
   - Commit 2: plugin install/uninstall only
   - Commit 3: ledger parser + sync/status/diagnostics only
   - Commit 4: docs/tests only

---

## 1. 单一数据流（唯一正确路径）

```text
vibeusage init
  -> install Hermes VibeUsage plugin
  -> Hermes hooks append local ledger
  -> vibeusage sync incrementally parses ledger
  -> aggregate UTC half-hour buckets
  -> upload via existing ingest pipeline
```

明确禁止：

```text
Hermes state.db -> vibeusage sync
Hermes session json -> vibeusage sync
Hermes trajectory files -> vibeusage sync
hook direct upload -> backend
```

---

## 2. Ledger 合同

### 路径

- `~/.vibeusage/tracker/hermes.usage.jsonl`

### 允许事件

#### 2.1 `session_start`

```json
{
  "version": 1,
  "type": "session_start",
  "source": "hermes",
  "session_id": "20260410_204500_ab12cd",
  "platform": "cli",
  "model": "openai/gpt-5.4",
  "provider": "openai-codex",
  "emitted_at": "2026-04-10T12:45:00.123Z"
}
```

#### 2.2 `usage`

```json
{
  "version": 1,
  "type": "usage",
  "source": "hermes",
  "session_id": "20260410_204500_ab12cd",
  "platform": "cli",
  "model": "openai/gpt-5.4",
  "provider": "openai-codex",
  "api_mode": "chat_completions",
  "api_call_count": 3,
  "input_tokens": 1200,
  "output_tokens": 340,
  "cache_read_tokens": 500,
  "cache_write_tokens": 0,
  "reasoning_tokens": 80,
  "total_tokens": 2040,
  "finish_reason": "stop",
  "emitted_at": "2026-04-10T12:45:12.456Z"
}
```

#### 2.3 `session_end`

```json
{
  "version": 1,
  "type": "session_end",
  "source": "hermes",
  "session_id": "20260410_204500_ab12cd",
  "platform": "cli",
  "model": "openai/gpt-5.4",
  "provider": "openai-codex",
  "emitted_at": "2026-04-10T12:47:50.999Z"
}
```

### 明确禁止写入的字段

- prompt text
- response text
- reasoning text
- tool args / tool results
- raw request / response bodies
- system prompt

---

## 3. 代码边界与文件规划

## 3.1 VibeUsage 侧新增/修改文件

### 新增
- `src/lib/integrations/hermes.js`
- `src/lib/hermes-config.js`
- `src/lib/hermes-usage-ledger.js`
- `src/templates/hermes-vibeusage-plugin/plugin.yaml`
- `src/templates/hermes-vibeusage-plugin/__init__.py`
- `test/hermes-integration.test.js`
- `test/hermes-usage-ledger.test.js`

### 修改
- `src/lib/integrations/index.js`
- `src/lib/integrations/context.js`
- `src/commands/init.js`
- `src/commands/status.js`
- `src/commands/sync.js`
- `src/commands/uninstall.js`
- `src/lib/diagnostics.js`
- `README.md`
- `docs/repo-sitemap.md`（如模块边界发生变化则更新）

## 3.2 Hermes 侧插件模板

由 VibeUsage 安装到：

- `~/.hermes/plugins/vibeusage/plugin.yaml`
- `~/.hermes/plugins/vibeusage/__init__.py`

说明：
- MVP 阶段插件由 VibeUsage 分发/安装
- 未来即便改为 Hermes 官方分发，也不改变 ledger 合同

---

## 4. 原子提交方案

## Commit 1 — Spec only

### 目标
固化边界，不写实现。

### 已包含内容
- OpenSpec proposal
- design
- tasks
- spec delta

### 验收
- 明确写死 plugin-ledger only
- 明确不支持 internal-store fallback

---

## Commit 2 — Hermes plugin install/uninstall

### 目标
只完成集成安装层，不接 sync。

### 任务
1. 新增 `src/lib/hermes-config.js`
   - 负责 Hermes home / plugin dir / plugin file path / ledger path 解析
2. 新增 `src/templates/hermes-vibeusage-plugin/plugin.yaml`
3. 新增 `src/templates/hermes-vibeusage-plugin/__init__.py`
4. 新增 `src/lib/integrations/hermes.js`
   - `probe(ctx)`
   - `install(ctx)`
   - `uninstall(ctx)`
5. 修改 `src/lib/integrations/context.js`
   - 注入 `ctx.hermes`
6. 修改 `src/lib/integrations/index.js`
   - 注册 Hermes integration
7. 修改 `src/commands/init.js`
   - `installIntegrations()` 输出 Hermes plugin 状态
8. 修改 `src/commands/uninstall.js`
   - 删除 Hermes plugin

### `probe` 语义
- `not_installed`: plugin dir / files 不存在
- `ready`: plugin 文件和期望模板一致
- `drifted`: plugin 存在但内容与模板不一致
- `unreadable`: 目录或文件不可读

### 验收
- `vibeusage init` 可 idempotent 安装 Hermes plugin
- `vibeusage uninstall` 可移除 Hermes plugin
- 不触碰 sync 逻辑

---

## Commit 3 — Hermes ledger parser + sync/status/diagnostics

### 目标
只打通数据采集消费层。

### 任务
1. 新增 `src/lib/hermes-usage-ledger.js`
   - `readHermesUsageLedger({ trackerDir, offset })`
   - `parseHermesLedgerIncremental({ ledgerPath, cursors, queuePath })`
2. 解析规则
   - 只认 `type in {session_start, usage, session_end}`
   - 只认 allowlist 字段
   - 任何多余字段忽略
3. 聚合规则
   - `source = "hermes"`
   - UTC half-hour bucket
   - `cached_input_tokens = cache_read_tokens + cache_write_tokens`
   - `reasoning_output_tokens = reasoning_tokens`
4. 修改 `src/commands/sync.js`
   - 将 Hermes ledger parser 接入 sync flow
   - 不得 fallback 到 Hermes internal stores
5. 修改 `src/commands/status.js`
   - 显示 `Hermes plugin`
   - 显示 `Hermes ledger`
   - 显示 last ledger event
6. 修改 `src/lib/diagnostics.js`
   - 输出 Hermes plugin path / ledger path / cursor / last event

### 验收
- `sync` 可增量读取 Hermes ledger
- 重复运行无重复 bucket
- 无内容字段落入 queue / upload

---

## Commit 4 — Docs/tests/cleanup

### 目标
写死合同，补齐回归。

### 任务
1. 更新 `README.md`
   - 增加 Hermes support 文档
   - 明确 plugin-ledger only
2. 视情况更新 `docs/repo-sitemap.md`
3. 补测试
   - plugin install/uninstall
   - privacy-safe ledger write
   - incremental parse
   - idempotent sync
   - no fallback to internal stores
4. 记录回归命令与结果

---

## 5. 关键实现细节

## 5.1 `src/lib/hermes-config.js`

建议导出：

- `resolveHermesHome({ home, env })`
- `resolveHermesPluginDir({ home, env })`
- `resolveHermesPluginPaths({ home, env, trackerDir })`
- `readInstalledHermesPluginSignature(...)`
- `installHermesPlugin(...)`
- `removeHermesPlugin(...)`

建议上下文字段：

```js
hermes: {
  home,
  pluginDir,
  pluginYamlPath,
  pluginInitPath,
  ledgerPath,
}
```

## 5.2 `src/lib/integrations/hermes.js`

接口风格对齐现有 integration：

- `name: "hermes"`
- `summaryLabel: "Hermes Plugin"`
- `statusLabel: "Hermes plugin"`

`install()` 只做：
- 创建 plugin dir
- 写 `plugin.yaml`
- 写 `__init__.py`

不做：
- 启动 Hermes
- 上传数据
- 修复历史数据

## 5.3 Hermes 插件模板

### `plugin.yaml`
仅需最小声明：
- plugin name
- description
- hook list

### `__init__.py`
核心结构：

```python
def register(ctx):
    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("post_api_request", post_api_request)
    ctx.register_hook("on_session_end", on_session_end)
```

内部函数：
- `_append_jsonl(record)`
- `_iso_now()`
- `_safe_int(value)`
- `_sanitize_usage(usage)`

要求：
- append-only
- ignore failures
- no network
- no content

## 5.4 `post_api_request` 使用方式

Hermes 已保证会传入 normalized usage summary。
插件只消费：
- `session_id`
- `platform`
- `model`
- `provider`
- `api_mode`
- `api_call_count`
- `finish_reason`
- `usage`

如果 `usage` 缺失：
- 不写 usage 记录
- 不报错中断主流程

---

## 6. 测试计划

## 6.1 单元测试

### A. Hermes integration install
- 安装后 plugin 文件存在
- 重复安装不重复写脏 diff
- drifted 状态可识别

### B. Hermes integration uninstall
- 可删除 plugin 文件
- `--purge` 时删除 ledger
- 默认 uninstall 不删除 ledger

### C. Hermes plugin ledger write
- `on_session_start` 只写 allowlist
- `post_api_request` 只写 numeric usage + metadata
- `on_session_end` 只写 boundary
- 不写 content

### D. Hermes ledger parser
- 正常 usage record 能聚合
- 非法 record 跳过
- 多余字段忽略
- offset cursor 正常推进

### E. Sync idempotency
- 重复 sync 无重复 bucket
- ledger 无新增时 inserted = 0 或等效结果

### F. No fallback guarantee
- ledger 缺失时不读取 `~/.hermes/state.db`
- ledger 缺失时不读取 `~/.hermes/sessions/`

## 6.2 回归命令

按仓库约定最终至少运行：

```bash
npm test
npm run validate:copy
npm run validate:ui-hardcode
npm run validate:guardrails
node --test test/*.test.js
```

以及本变更相关的定向测试命令。

---

## 7. 输出文案规范

对用户统一用：
- `Hermes plugin`

不要用：
- `Hermes hooks`

因为：
- plugin 是产品概念
- hooks 是实现细节

示例：
- `Hermes plugin: installed`
- `Hermes plugin: set`
- `Hermes plugin: drifted`
- `Hermes plugin: removed`

---

## 8. 需要坚持的红线

### 红线 1
任何代码都不得把 Hermes internal stores 当成正式 usage source。

### 红线 2
任何 hook 都不得直传网络。

### 红线 3
任何 ledger record 都不得包含文本内容。

### 红线 4
任何 status/diagnostics/sync 都不得偷偷修复插件安装状态。
只有 `init` 允许修改 Hermes 集成状态。

---

## 9. 实施顺序建议

1. 先做 Commit 2：安装层
2. 本地人工验证 Hermes plugin 能写 ledger
3. 再做 Commit 3：parser/sync
4. 最后补 docs/tests

这样闭环最短：

```text
提出假设 -> 安装插件 -> 实际写 ledger -> 读 ledger -> 聚合 -> 验证 -> 修正
```

---

## 10. 最终定义

这次“让 VibeUsage 支持 Hermes”的准确含义是：

> 让 `vibeusage init` 安装一个 VibeUsage 管理的 Hermes 插件；
> 该插件通过 Hermes lifecycle hooks 产出本地、隐私安全、幂等友好的 usage ledger；
> `vibeusage sync` 只读取这个 ledger 并接入现有半小时聚合与上传体系。
