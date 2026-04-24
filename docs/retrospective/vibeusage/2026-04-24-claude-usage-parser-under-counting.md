---
repo: vibeusage
layer: backend
module: claude-usage-parser
severity: S1
design_mismatch: yes
detection_gap: yes
reusable_for:
  - usage-parser
  - claude-code-integration
  - opencode-integration
  - rollout-dedupe
  - token-accounting
  - backfill-upsert
owner: Victor
status: mitigated
report_date: 2026-04-24
incident_window: "2025-12..2026-04-24"
---

# Claude Code 用量统计严重漏报（约 90%）验尸报告

## 事件概要

**影响**：vibeusage dashboard 展示的 Claude Code token 用量长期只是真实消耗的约 **5–15%**（某些天低至 2.5%）。用户凭体感察觉"漏算很多工作"，经本地 ground-truth 对比确认。

**根因（两个独立 bug 叠加）**：
1. **漏加 cache_read**：`normalizeClaudeUsage` 在 `total_tokens` 缺失时用 `input + cache_creation + output` 组装，漏了 `cache_read_input_tokens`。Claude Opus 长对话 cache_read 占 token 消耗的 ~99%，这一漏几乎等于不记账。
2. **同 message.id 重复累加**：Claude Code 对同一条 assistant message 会把 `usage` 记录写多次（相同 `message.id` / `requestId`，不同外层 `uuid`）。旧 `parseClaudeFile` 对每行都 `addTotals`，实际测得 **2.337x 平均乘数**（35,163 行 usage 仅对应 15,046 个 unique message.id；极端情况下单条消息被记 14 次）。

**净效果**：
- 漏报 cache_read 让数字向下偏 ~200x
- 重复累加让数字向上偏 ~2.3x
- 净观察 = 真实 × 2.3 / 200 ≈ 真实 / 87 → 表现为约 1% 显示率，即"严重漏报"

**修复**：
- [PR #152](https://github.com/victorGPT/vibeusage/pull/152) — `parseClaudeFile` 按 `message.id`（回落 `requestId`）去重，cursor 持久化最近 500 个 id
- [PR #153](https://github.com/victorGPT/vibeusage/pull/153) — `normalizeClaudeUsage` 与 `normalizeOpencodeTokens` 的 `total_tokens` 公式加入 cache_read
- **本机回填完成**：清 `~/.vibeusage/tracker/cursors.json` 中 Claude/OpenCode 的 file+bucket 游标 → `sync --drain` 重扫 → 683 个 bucket upsert 覆盖，DB 数字从真相的 5–15% 拉升到 100–120%

## 时间线

- **2025-12 到 2026-04-24**：两个 bug 在 main 分支持续存在。没有监控指标或金丝雀告警针对"用量同比异常"。
- **2026-04-24 下午**：用户体感 Claude Code 工作被大量漏算，发起排查。
- **第一次数据摸底**：扫 192 个本地 Claude session 文件，发现 35k usage 行只对应 15k unique message.id，识别重复累加 bug，开 PR #152。
- **用户追问"漏算而不是多算"**：继续数据实勘，按天对比本地真相 vs DB：真相 448M / DB 29M（04-22），漏报 93%。进一步读 bucket 明细，看到 `cached_input_tokens=97M` 而 `total_tokens=546K`，定位到 `normalizeClaudeUsage` 未加 cache_read，开 PR #153。
- **两个 PR 合并后**：本地回填 → DB 数字回到 ~1.02x 真相。

## 根因分析

### Bug A：cache_read 被排除出 total_tokens

```js
// src/lib/rollout.js (修前)
function normalizeClaudeUsage(u) {
  const inputTokens = toNonNegativeInt(u?.input_tokens)
    + toNonNegativeInt(u?.cache_creation_input_tokens);
  const outputTokens = toNonNegativeInt(u?.output_tokens);
  const hasTotal = u && Object.prototype.hasOwnProperty.call(u, "total_tokens");
  const totalTokens = hasTotal
    ? toNonNegativeInt(u?.total_tokens)
    : inputTokens + outputTokens;            // BUG: 缺 cache_read
  return {
    input_tokens: inputTokens,
    cached_input_tokens: toNonNegativeInt(u?.cache_read_input_tokens),
    output_tokens: outputTokens,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}
```

**设计错配（design_mismatch=yes）**：
- 代码把 `cached_input_tokens` 当成一个独立展示字段记了，但在聚合 `total_tokens` 时忘了把它计入。
- Anthropic Messages API **从不返回** `total_tokens` 字段，所以 `hasTotal` 分支在实际生产中永远走不到；fallback 路径才是唯一生效的路径。作者大概率测试时假定了"总会有 total_tokens 兜底"。
- 同样的错误出现在 `normalizeOpencodeTokens`：`total = inputTokens + output + reasoning`，`cached` 独立但不入 total。两处是平行错误，说明是共享心智模型的失误，不是单点失误。
- 反例：`normalizeKimiUsage`（Kimi 集成 PR #144）正确地把 cache_read 加进了 total —— 那是 2026-04 写的新代码，写的时候没有"复用"旧心智模型，反而避开了 bug。

### Bug B：同 message.id 多次累加

```js
// src/lib/rollout.js (修前) parseClaudeFile
for await (const line of rl) {
  if (!line || !line.includes('"usage"')) continue;
  const obj = JSON.parse(line);
  const usage = obj?.message?.usage || obj?.usage;
  if (!usage) continue;
  // 直接累加，无任何去重
  addTotals(bucket.totals, normalizeClaudeUsage(usage));
}
```

**设计错配（design_mismatch=yes）**：
- Claude Code 的 `~/.claude/projects/*/*.jsonl` 不是"纯事件流 append-once" —— 同一条 assistant message 在 session 生命周期中可能被写入多次（常见模式：in-progress 事件 + 最终 completed 事件；compact / resume 后重写；hook 触发 re-emit）。每次都带完整 `usage` payload。
- 作者按"jsonl 每行是一条独立事件"做了累加，没检查上游实际写入语义。
- Gemini / Codex / OpenCode 的 parser 都有各自的"状态差分"（例如 `parseGeminiFile` 用 `lastTotals` diff 避免同一条 session message 被重复计），但 Claude parser 是字节 offset 增量读，没有任何按 message identity 的去重机制。

**极端数据**：1 条 `message.id` 在最严重的文件里被重复写 **14 次**。即使平均 2.3x 已经是重大漂移，尾分布更糟。

## 为什么 Plugin 化没避免这些 bug

用户问得对：Claude Code 集成在某个时点从"`settings.json` 里写 SessionEnd hook"改成了"**安装 plugin**"（`installClaudePlugin`）。Plugin 更干净，但 **plugin 化只是换了"如何触发 sync"这一步的机制**，不改 parser：

| 层 | Plugin 化是否影响？ |
|---|---|
| Hook 写入（`settings.json` vs plugin manifest） | 是，从 JSON hook 改成 Claude marketplace plugin |
| 触发时机（SessionEnd 事件） | 不变 |
| 调用 `notify.cjs` → `sync --auto` | 不变 |
| **`parseClaudeFile` 扫 `~/.claude/projects/*/*.jsonl`** | **不变** |
| `normalizeClaudeUsage` 映射公式 | **不变** |
| 入 queue → ingest → `vibeusage_tracker_hourly` | 不变 |

Bug 全在 parser / normalize 层。Plugin 化解决的是"hook 被误删"这类问题，和 "usage 怎么计算" 完全正交。这恰好是**设计错配的一个层面**：我们重构了"接入面"，但没同时 audit "计算面"。如果 plugin 化那轮加了 ground-truth 抽样对比，两个 bug 早就该被抓出来。

## 检测缺口（detection_gap=yes）

- **没有"总量同比"告警**：DB 里 source=claude 的 daily tokens 每天稳定在 6M–30M 区间，但和本地 session 文件的直接推算对不上——没有自动化脚本在后端或 CI 比对这两者。
- **没有端到端"本地 ≈ DB"守护测试**：有 parser 单测覆盖了"两行输入该累加成什么"，但**没有一个测试是"给一个真实 session 文件，期望 total_tokens = 按 Anthropic 官方口径重新求和的值"**——这类 property-based 测试能一行命中 Bug A。
- **没有"同 message.id 重复检测"报警**：parser 不统计"本次 sync 观察到的 duplicate message.id 比例"，也不在 debug log 里记这个指标。
- **Dashboard 侧没有"token 量 vs Anthropic 实际计费"对比**：Anthropic Console 页面有用户的月度 token 总量，如果 dashboard 能导入一次做校准，两个 bug 都会立即暴露。
- **CI 没有"用 Claude Code 的 `/cost` 输出做基线"测试**：Claude Code CLI 自己的 `/cost` 输出本 session token 数，这是理想基线，但从未被接入到 vibeusage 的测试流程。

## 影响评估

- **财务/计费上的误导**：用户根据 dashboard 判断自己"这个月花了多少 Claude"，实际真实消耗是显示的 10–20 倍。对订阅/限额决策有直接误导。
- **Leaderboard 的相对排名**：多用户、多设备的 Claude 用量全都按同一 bug 少报，所以 **相对排名大致正确**（都漏算同等比例），但 OpenCode 用户也按同一 bug 少报 cache_read，二者之间的相对关系仍保留；Gemini / Codex / Kimi 不受影响。
- **账单对账**：如果团队用 vibeusage 做内部 charge-back，过去的数字基本都是错的。

## 修复 + 回填

### 代码修复
- PR #152 squash → `22d4b636`（Claude dedupe by message.id）
- PR #153 squash → `30fa459e`（Claude/OpenCode total_tokens 含 cache_read）
- 新增测试：`test/rollout-claude-dedupe.test.js` 5 cases；`rollout-parser.test.js` 里新增"Opus 长 session 回归测试"

### 本机回填步骤（已执行）
```bash
# 1. 备份
cp ~/.vibeusage/tracker/cursors.json{,.bak.$(date +%Y%m%d-%H%M%S)}

# 2. 精准清 Claude/OpenCode 游标
python3 <<'PY'
import json, os
p = os.path.expanduser("~/.vibeusage/tracker/cursors.json")
with open(p) as f: c = json.load(f)
for k in list(c.get('files', {})):
    if '.claude/projects/' in k or '/opencode/storage/' in k: del c['files'][k]
buckets = (c.get('hourly') or {}).get('buckets') or {}
for k in list(buckets):
    if k.split('|',1)[0] in ('claude','opencode'): del buckets[k]
c.pop('opencode', None); c.pop('opencodeSqlite', None)
with open(p, 'w') as f: json.dump(c, f)
PY

# 3. 重扫+上传 —— ingest 端 upsert resolution=merge-duplicates 会按主键替换旧值
node ~/Developer/vibeusage/bin/tracker.js sync --drain
```

回填产出 683 个 bucket upsert，数据对账：

| 日期 | 真相 | 修前 DB | 修后 DB | after/truth |
|---|---:|---:|---:|---:|
| 04-17 | 78.3M | 12.2M | 95.9M | 1.22x |
| 04-19 | 272.9M | 6.8M | 277.4M | 1.02x |
| 04-22 | 448.2M | 29.5M | 452.5M | 1.01x |
| 04-23 | 483.9M | 23.7M | 493.1M | 1.02x |

个别天略高（1.1–1.2x）应是**多设备同 user account 汇总**或采样时 Claude Code 正在写入导致的尾部偏差，属于语义正确范围。

### 其他设备

后端 ingest 按 `(user_id, device_id, source, model, hour_start)` upsert，其他设备的历史 bucket 只能通过**该设备升级到带修复的 CLI 版本 + 本地跑同样的清游标+重扫**来修正。这次只修复了作者本人那台机器。

### Pending
- `vibeusage@0.5.0` npm 发布，让所有线上用户拿到修复
- 其他线上用户是否需要引导回填（文案 / 自动化提示）

## 可复用教训

1. **Append-once 假设不可信**：任何 AI CLI 的 session log 都可能把同一条 upstream message 写多次。新增任何 source 的 parser 必须先用 `message.id` / `request_id` / 类似 uniqueness 做去重键。本报告产出了 Claude/OpenCode 的验证方式：`grep '"usage"' file | sort unique message.id` 和按 id 分组计数。
2. **Total = 所有 channel 之和**：Anthropic / OpenAI / Anthropic-compatible 的 usage 结构普遍是"分通道记录，不给 total"。parser 的 `total_tokens` 合成公式必须**覆盖所有 token 通道**（input + cache_creation + cache_read + output + reasoning）。any `total = partial sum` 都是 bug。Kimi PR 的写法（#144）是正例，应作为"新 source parser 模板"的一部分。
3. **重构接入面时也要 audit 计算面**：plugin 化这类"接入机制改进"容易让人以为"这块整体变干净了"，但计算逻辑如果没一起被重新验证，老 bug 会保留下来。下次类似重构的 checklist 要明确加一项："对同一 source 产出的 bucket，跑一次本地 ground-truth 比对，偏差 >5% 必须说明原因"。
4. **Property-based regression**：对每个 source 加一个"喂真实 session 文件，对账 total_tokens"的 fixture 测试。这类测试会直接抓到两类 bug，成本低，价值高。
5. **用户体感是最终 oracle**：用户说"漏算很多"，我第一反应是只找到多算 bug 后就收手报告，没继续深挖。正确做法是**把体感和数据之间的差值当成红线**，没对上就继续查，直到数字对齐为止。

## 防御机制（提议）

- **`scripts/ops/compare-claude-ground-truth.cjs`**：读本地 `~/.claude/projects/*/*.jsonl` 按去重+四通道求和算 ground truth，对照 `vibeusage_tracker_hourly` 里 source=claude user_id=self 的日总量，偏差 >10% 报警；放进 `npm run ci:local` 作为本地可选 smoke（非门禁，但 doctor 命令可调起）。
- **`vibeusage doctor --audit-tokens`**：扩展现有 doctor 命令，跑一次本地 vs 上游的对账并打印差值；每次 vibeusage init 引导用户跑一次，确保新安装立即可信。
- **parser duplicate-ratio 指标**：parseClaudeIncremental 返回值里加一个 `dedupSkipped` 字段；sync.js 如果某次 drain 的 dedupSkipped / eventsAggregated > 50%，写一条 debug.jsonl 事件提示 upstream log 出现大量重复（早期预警）。
- **新 source parser 模板**：在 `AGENTS.md` 或 `docs/` 里记录"新增任何 AI CLI source 必须：(1) 定义 dedupe key；(2) total_tokens = sum of all channels；(3) 带一条 real-session fixture 回归测试"。

## 附录：关键数据

- 192 Claude session files 扫描得：35,163 usage 行 / 15,046 unique message.id，乘数 2.337x
- 1 条 message 被重复写最多 14 次
- 单 bucket 极端例（04-23T11:00）：`input=321,906  cache_creation=923,000  cache_read=97,255,588  output=224,178`，旧 total=546,084，正确 total=98,724,672（差 180x）
- 回填前 DB 日总量 / 真相：7 天平均约 10.4%；回填后：100–120%
