# Hermes E2E Smoke Runbook

## Goal

验证以下链路在当前实现下是否真实可用：

```text
vibeusage init
-> 安装 Hermes plugin
-> Hermes 产生 usage
-> plugin 写 hermes.usage.jsonl
-> vibeusage sync
-> 上传到 InsForge ingest
-> usage endpoint / dashboard 可见
```

---

## 0. 结论标准

本次 smoke 的通过标准不是“代码看起来对”，而是下面 4 条都成立：

1. `vibeusage init` 真实安装 Hermes plugin
2. Hermes 真实写出 `~/.vibeusage/tracker/hermes.usage.jsonl`
3. `vibeusage sync` 真实把 Hermes ledger 聚合进 queue / 上传成功
4. 至少一个后端 usage 查询能看到 `source=hermes` 的数据

---

## 1. 前置条件

### 本地
- 已在本机安装 Hermes
- 已在本机安装 vibeusage 当前工作副本
- 已可运行 Node 20.x
- 已具备有效的 VibeUsage device token / init 登录能力

### 建议环境变量
根据实际环境设置：

```bash
export VIBEUSAGE_INSFORGE_BASE_URL="<your-insforge-base-url>"
export VIBEUSAGE_DASHBOARD_URL="<your-dashboard-url>"
```

如需显式指定 Hermes home：

```bash
export HERMES_HOME="$HOME/.hermes"
```

---

## 2. Step A — 安装 Hermes plugin

在 repo 根目录执行：

```bash
node bin/tracker.js init --yes --no-open
```

如果要指定 base URL：

```bash
node bin/tracker.js init --yes --no-open --base-url "$VIBEUSAGE_INSFORGE_BASE_URL"
```

### 预期结果
输出 summary 中出现：

- `Hermes Plugin: installed`
或
- `Hermes Plugin: set`

### 本地验证
检查插件文件：

```bash
test -f "$HOME/.hermes/plugins/vibeusage/plugin.yaml" && echo "plugin.yaml ok"
test -f "$HOME/.hermes/plugins/vibeusage/__init__.py" && echo "__init__.py ok"
```

进一步确认 marker：

```bash
grep -n "VIBEUSAGE_HERMES_PLUGIN" "$HOME/.hermes/plugins/vibeusage/plugin.yaml"
grep -n "VIBEUSAGE_HERMES_PLUGIN" "$HOME/.hermes/plugins/vibeusage/__init__.py"
```

### 失败判断
若插件文件不存在，先不要继续测后端。
先修安装层。

---

## 3. Step B — 让 Hermes 真实产生 usage

目标：不是手写 ledger，而是让 Hermes 自己跑一轮真实请求。

### 最小操作
启动一次 Hermes，发一个简单 prompt，例如：

```text
hello
```

或者：

```text
请回复 1 句话：test hermes usage
```

### 关键点
必须确保这次 Hermes 真的走到了模型 API 请求，不只是本地空响应。

---

## 4. Step C — 检查 Hermes ledger 是否真实写出

ledger 路径：

```bash
$HOME/.vibeusage/tracker/hermes.usage.jsonl
```

检查是否存在：

```bash
test -f "$HOME/.vibeusage/tracker/hermes.usage.jsonl" && echo "ledger exists"
```

看最后几行：

```bash
tail -n 20 "$HOME/.vibeusage/tracker/hermes.usage.jsonl"
```

### 预期结果
至少看到这些 event type 之一：
- `session_start`
- `usage`
- `session_end`

且至少要有一条：
- `"type":"usage"`
- `"source":"hermes"`

### 检查隐私边界
确认 ledger 中 **没有**：
- prompt text
- response text
- reasoning text
- tool args/result

可快速 grep：

```bash
grep -n 'assistant_response\|user_message\|tool_calls\|reasoning' "$HOME/.vibeusage/tracker/hermes.usage.jsonl"
```

### 通过标准
- 文件存在
- 存在 usage 行
- usage 行只包含 allowlist 字段

---

## 5. Step D — 运行 sync

执行：

```bash
node bin/tracker.js sync
```

### 预期结果
输出类似：
- `Sync finished:`
- `Parsed files: ...`
- `New 30-min buckets queued: ...`
- `Uploaded: X inserted, Y skipped`

### 若没有 device token
会出现：
- `Uploaded: skipped (no device token)`

这种情况下说明本地解析 OK，但云端链路未验证完成。

---

## 6. Step E — 检查本地 queue / cursor

### 检查 cursor

```bash
cat "$HOME/.vibeusage/tracker/cursors.json"
```

重点看：
- `hermesLedger.offset`
- `hermesLedger.updatedAt`
- `hermesLedger.lastEventAt`

### 检查 queue

```bash
tail -n 20 "$HOME/.vibeusage/tracker/queue.jsonl"
```

### 预期结果
应存在 `source = "hermes"` 的 bucket，字段类似：

```json
{
  "source": "hermes",
  "model": "...",
  "hour_start": "...",
  "input_tokens": ...,
  "cached_input_tokens": ...,
  "output_tokens": ...,
  "reasoning_output_tokens": ...,
  "total_tokens": ...
}
```

### 映射检查
确认：
- `cached_input_tokens = cache_read_tokens + cache_write_tokens`
- `reasoning_output_tokens = reasoning_tokens`

---

## 7. Step F — 验证 idempotency

再次运行：

```bash
node bin/tracker.js sync
```

### 预期结果
在没有新增 Hermes ledger event 的前提下：
- 不应重复追加新的 Hermes bucket
- 上传层应表现为：
  - `0 inserted`
  - 或等价的 no new data 结果

### 本地验证
对比 queue 文件前后大小 / 内容不应继续增长 Hermes duplicate。

---

## 8. Step G — 验证 status / diagnostics

### status

```bash
node bin/tracker.js status
```

预期应包含：
- `Hermes plugin: set` 或 `drifted`
- `Hermes ledger: present`
- `Hermes last ledger event: <timestamp>`

### diagnostics

```bash
node bin/tracker.js diagnostics
```

重点看：
- `paths.hermes_home`
- `paths.hermes_plugin_dir`
- `paths.hermes_ledger`
- `hermes.ledger_present`
- `hermes.ledger_offset`
- `hermes.last_event_at`
- `notify.hermes_plugin_status`

---

## 9. Step H — 验证后端 ingest

如果本地 sync 已显示 upload 成功，再验证后端结果。

### 最低标准
任选一个 usage endpoint 验证能查询到 Hermes 数据。

建议先查 summary / hourly：
- `vibeusage-usage-summary`
- `vibeusage-usage-hourly`
- `vibeusage-usage-heatmap`

### 验证点
- 不带 source filter：总量变化包含 Hermes
- 带 `source=hermes`：如果当前接口支持 source filter，不应报错

### 如果你有 Dashboard
直接打开 dashboard 看：
- 最近时间窗口 token 是否增长
- model 是否正常显示
- 页面是否无异常

---

## 10. 建议记录模板

每次 smoke 建议按这个格式记录：

```markdown
## Hermes smoke result
- init: pass/fail
- plugin files: pass/fail
- ledger write: pass/fail
- privacy allowlist: pass/fail
- sync parse: pass/fail
- upload ingest: pass/fail
- summary query: pass/fail
- dashboard visible: pass/fail
- notes:
```

---

## 11. 失败分流

## Case A — plugin 没装上
排查：
- `HERMES_HOME`
- `~/.hermes/plugins/` 权限
- `vibeusage init` 输出

## Case B — plugin 装上了但 ledger 不写
排查：
- Hermes 是否真的发起了模型请求
- Hermes plugin 是否被加载
- `post_api_request` 是否触发

## Case C — ledger 写了但 sync 没聚合
排查：
- ledger 字段是否符合 allowlist
- `emitted_at` 是否是合法 ISO 时间
- `type` 是否为 `usage`
- `source` 是否为 `hermes`

## Case D — sync 聚合了但 upload 不成功
排查：
- device token
- base URL
- ingest endpoint 返回
- queue.state / upload.throttle

## Case E — ingest 成功但 dashboard 不显示
排查：
- query endpoint 是否支持 `source=hermes`
- pricing / model identity 映射
- dashboard filter / time range

---

## 12. 是否现在就改后端

执行完本 runbook 以后再决定。

### 如果结果是：
- 本地链路 OK
- ingest OK
- usage query OK

那么：
> 当前不需要改 InsForge 代码。

### 如果结果是：
- ingest/query 被 `source=hermes` 卡住

那么：
> 再进入 backend follow-up。 

### 如果结果是：
- 只有 pricing / leaderboard 表现不理想

那么：
> 不一定要改代码，可能只需要补 pricing data / product 规则。 
