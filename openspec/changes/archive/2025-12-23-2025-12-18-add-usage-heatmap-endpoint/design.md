# Design: Server-side activity heatmap (InsForge2)

## Module Brief

### Scope

IN:
- 新增 `GET /functions/vibescore-usage-heatmap`（server-side 派生 heatmap）
- 统一 heatmap 的“口径/算法/阈值映射/对齐规则”，并以 JSON contract 输出
- 前端通过 hook 使用该 contract（可回退旧方案）

OUT:
- 不改动 ingest、device token、聚合视图结构
- 不引入真实“网络状态/节点状态”等不可靠数据
- 不做可视化配置面板（对比度、阈值档位等先不做）

### Interfaces

Endpoint:
- `GET /functions/vibescore-usage-heatmap?weeks=52&to=YYYY-MM-DD&week_starts_on=sun|mon`
- Headers: `Authorization: Bearer <user_jwt>`

Response (draft):
```json
{
  "from": "2025-01-01",
  "to": "2025-12-18",
  "week_starts_on": "sun",
  "weeks": [
    [
      { "day": "2025-01-01", "value": 1234, "level": 2 },
      ...
      { "day": "2025-01-07", "value": 0, "level": 0 }
    ],
    ...
  ],
  "thresholds": { "t1": 100, "t2": 400, "t3": 900 },
  "streak_days": 12
}
```

### Data flow and constraints

- Source of truth: `vibescore_tracker_daily`（按 UTC day 聚合）
- 取数范围：`weeks * 7` 天（滚动窗口），`to` 默认为 today(UTC)
- 缺失天补零：缺失视为 `value = 0` / `level = 0`
- 对齐：起始日期向前对齐到周边界（`sun`/`mon`），保证网格按整周展示
- Limits（防滥用）：`weeks` 限制在 `[1, 104]`（上限两年）

### Non-negotiables

- UTC 口径一致（不受客户端时区影响）
- Auth 边界不变：必须通过 `auth.getCurrentUser()` 获取 userId，再按 userId 查询
- 不泄露敏感信息：仅返回聚合/派生数值，不返回任何对话文本
- 不引入破坏性变更：原有 daily/summary endpoint 继续可用

### Test strategy

- Unit（确定性）：
  - 参数归一化：weeks/to/week_starts_on 校验与默认值
  - 派生算法：quantile 阈值、level 映射、对齐、streak
- Integration（轻量）：
  - 在本地/预发 InsForge2 部署后：用 user_jwt 调用 endpoint，检查 shape 与 range
- Cold regression（手工脚本）：
  - Dashboard 首页 heatmap 渲染正常、无数据时友好提示
  - 切换为后端 endpoint 后，渲染结果与旧方案一致（允许在边界对齐上有可解释差异）

### Milestones

1) Contract freeze：确定 request/response 字段与限制（输出一份样例 JSON）
2) Edge function MVP：实现 endpoint + 基本算法 + 约束校验
3) Dashboard hook 切换：优先新 endpoint，保留 404 回退
4) Verification：单测 + smoke + 手工回归步骤齐备

### Plan B triggers

- 若 `vibescore_tracker_daily` 查询在 52 周范围出现明显延迟（例如 > 500ms）：
  - 触发 Plan B：改为 SQL 侧补零/预聚合，或增加缓存（短 TTL）

### Upgrade plan（disabled by default）

- 后续可扩展：
  - `contrast` 参数（soft/normal/hard）对应不同 percentiles
  - 后端计算 `rank` / `active_days` 等衍生指标（需要新 endpoint 或新 view）

## Heatmap Algorithm (GitHub-inspired, our own)

### Grid

- 7 行：按 `week_starts_on` 决定 day-of-week 排列（`sun`=0 或 `mon`=1 对齐）
- 列数：约 `weeks` 列（根据 to/from 对齐可能出现 52~53，最终裁剪到 `weeks`）

### Intensity mapping (level 0..4)

输入：daily totals（`total_tokens`）

1) 收集所有 `value > 0` 的集合 `nz`
2) 若 `nz` 为空：全为 level 0
3) 计算分位数阈值（默认）：
   - `t1 = p50(nz)`
   - `t2 = p75(nz)`
   - `t3 = p90(nz)`
4) 映射：
   - `0`：`value == 0`
   - `1`：`0 < value <= t1`
   - `2`：`t1 < value <= t2`
   - `3`：`t2 < value <= t3`
   - `4`：`value > t3`

### Streak (optional, no backend state)

定义：从 `to` 往回数，连续天 `value > 0` 的天数（UTC）。
