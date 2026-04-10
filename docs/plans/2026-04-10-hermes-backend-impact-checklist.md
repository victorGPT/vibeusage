# Hermes Backend Impact Checklist

## Goal

验证当前 Hermes plugin-ledger 集成在 **不修改 InsForge 后端代码** 的前提下是否已经可用，并识别后续若要把 Hermes 做成一等公民时需要补的后端项。

---

## 0. 当前判断

### 结论
当前阶段 **不需要先改 InsForge 后端代码** 才能继续推进 Hermes 集成。

### 依据

1. `source` 目前不是严格白名单枚举
   - `insforge-src/shared/runtime-primitives-core.mjs`
   - `normalizeSource()` 只做 trim / lowercase / length cap

2. ingest bucket 结构与 Hermes 当前上传字段兼容
   - `insforge-src/shared/core/ingest.mjs`
   - 已支持：
     - `source`
     - `model`
     - `hour_start`
     - `input_tokens`
     - `cached_input_tokens`
     - `output_tokens`
     - `reasoning_output_tokens`
     - `total_tokens`

3. `vibeusage-ingest` 走通用 buildRows/upsert 流程
   - `insforge-src/functions-esm/vibeusage-ingest.js`
   - 没看到针对 `source=hermes` 的显式拒绝逻辑

### 当前风险判断
- ingest：低风险
- usage summary/hourly/heatmap 查询：低到中风险
- pricing：中风险
- leaderboard 分类：中风险

---

## 1. 必做 smoke（不改代码先验证）

## 1.1 Ingest smoke

### 目的
确认 `source = "hermes"` 的 half-hour bucket 能成功入库。

### 输入样例
通过 CLI 跑真实链路，或构造最小 payload：

```json
{
  "hourly": [
    {
      "source": "hermes",
      "model": "openai/gpt-5.4",
      "hour_start": "2026-04-10T12:30:00.000Z",
      "input_tokens": 100,
      "cached_input_tokens": 20,
      "output_tokens": 30,
      "reasoning_output_tokens": 10,
      "total_tokens": 160
    }
  ]
}
```

### 验证点
- HTTP 200
- `inserted >= 0`
- 无 `Invalid source`
- 无 schema / column mismatch

### 通过标准
- ingest endpoint 成功接收并返回成功响应

---

## 1.2 Usage hourly / summary smoke

### 目的
确认查询层不会因为 `source=hermes` 被过滤掉。

### 需要检查的 endpoint
- `vibeusage-usage-hourly`
- `vibeusage-usage-summary`
- `vibeusage-usage-heatmap`
- `vibeusage-usage-monthly`
- `vibeusage-usage-model-breakdown`

### 验证点
- 不带 source filter 时能看到 Hermes 数据进入总量
- 带 `source=hermes` 时不会报错
- heatmap/hourly 能返回 Hermes bucket

### 通过标准
- Hermes 数据进入正常聚合结果

---

## 1.3 Dashboard smoke

### 目的
确认前端在已有后端响应下不会崩。

### 验证点
- 总 token 数正常增长
- model breakdown 能显示 Hermes 上传的 model
- source filter 若已暴露为 query param，不会因为 `hermes` 出错

### 通过标准
- 页面可加载
- 聚合值正确
- 无 source 枚举相关前端异常

---

## 2. 应重点检查的后端点

## 2.1 Pricing resolution

### 现状
- `insforge-src/shared/pricing-core.mjs`
- pricing profile 会按 `source` 解析与查询

### 风险
如果数据库里没有与 `hermes` 对应的 pricing source/profile：
- ingest 不一定失败
- 但 pricing 可能 fallback / unknown / 默认路由

### 检查项
- 现有 pricing 表是否已有 `source = hermes`
- 如果没有，当前是否会 fallback 到默认 source
- fallback 后价格是否符合产品预期

### 决策标准
#### 若只是 MVP 上报可见
- 可以暂不改后端代码
- 接受 pricing 暂时不精确或走默认策略

#### 若要产品上准确计费
- 需要补 pricing 数据，必要时少量后端逻辑调整

---

## 2.2 Leaderboard classification

### 现状
- `insforge-src/shared/leaderboard-core.mjs`
- `other_tokens = total - gpt - claude`

### 风险
Hermes 数据很可能自然落入：
- `other_tokens`

这未必错误，但可能不是你想要的产品语义。

### 检查项
- Hermes 是否应该被视为 “tool source” 而不是 “provider family”
- leaderboard 维度是否需要新增更细分的展示
- 现有 `other_tokens` 是否已经足够

### 决策标准
#### 若当前目标只是先接入 Hermes
- 不需要改后端代码
- 接受 Hermes 暂时归到 `other_tokens`

#### 若目标是 Hermes 单独展示
- 需要改 leaderboard 逻辑与快照/视图

---

## 2.3 Pricing / source semantics

### 核心问题
`source = hermes` 是产品 source，还是 billing source？

当前 VibeUsage 的很多后端逻辑默认把 `source` 同时用于：
- 使用来源
- 定价来源
- 查询过滤

但 Hermes 实际上是“agent shell / orchestration layer”，底层 provider 可能是：
- openai
n- anthropic
- openrouter
- xai
- google

### 这意味着
从第一性原理看：
- `source = hermes` 适合作为产品 ingest source
- 但未必适合作为最终 billing/pricing source

### 后续可能演进
如果要做准确成本：
- 后端未来可能需要区分：
  - `source = hermes`
  - `billing_source = openai|anthropic|...`

### 当前建议
MVP 阶段先不动 schema，不在本轮改后端。

---

## 3. 当前是否要改后端代码

## 结论
### 现在 **不要先改后端代码**。

原因：
1. 当前最大不确定性不是代码结构，而是实际线上行为
2. 先做真实 smoke，能最快验证 `source=hermes` 是否已天然兼容
3. 若先改后端，容易提前引入错误抽象
4. 这符合原子化提交：先完成前端/CLI 链路，再决定 backend follow-up

---

## 4. 什么时候必须改后端

只有在以下任一情况出现时，才进入 InsForge 代码改动：

1. ingest 明确拒绝 `source=hermes`
2. summary/hourly/heatmap 查询层过滤掉 Hermes 数据
3. pricing 无法接受当前 fallback 语义
4. leaderboard 必须把 Hermes 单列展示，而 `other_tokens` 不满足需求
5. 你决定把 Hermes 提升为 pricing / analytics / leaderboard 的一等 source

---

## 5. 推荐执行顺序

1. 先完成当前本地链路
   - init
   - plugin
   - ledger
   - sync
   - status/diagnostics

2. 做真实 backend smoke
   - ingest
   - summary
   - hourly
   - heatmap
   - dashboard

3. 根据 smoke 结果分叉
   - **若全通**：本轮不改 backend 代码
   - **若只有 pricing / leaderboard 不理想**：单开 backend follow-up change
   - **若 ingest/query 本身不通**：再改 InsForge 代码

---

## 6. 最终产品判断

当前阶段最正确的策略是：

> Hermes 先作为一个新的 VibeUsage ingest source 接入；
> 先验证它能否被现有 InsForge 通用管线自然接纳；
> 再决定是否要把 Hermes 提升成 pricing / leaderboard 语义上的一等公民。
