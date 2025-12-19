# Change: Add server-side activity heatmap endpoint (InsForge2)

## Why

当前 Dashboard 的活动热力图是通过前端拉取 `vibescore-usage-daily` 后在浏览器里做派生计算（range 对齐、缺失补零、阈值映射、连续活跃 streak）。

这在功能上可用，但有两个长期风险：

1) **算法口径漂移**：未来 UI 风格/组件库更换时，前端可能被迫重复实现或不小心改动阈值/对齐逻辑，导致同一份数据在不同版本里显示不一致。  
2) **前端耦合**：页面需要同时负责数据拉取与派生算法，换皮/重构时更容易把“视觉变更”扩散到“数据口径”。

因此我们希望把热力图的“口径与派生算法”提升到 InsForge2 Edge Function 层，前端仅做渲染，从而为后续 UI 大改提供稳定接口。

## What Changes

- 新增 Edge Function：`GET /functions/vibescore-usage-heatmap`
  - Auth：`Authorization: Bearer <user_jwt>`
  - 输入：`weeks`（默认 52，限制范围）、`to`（默认 today UTC）、`week_starts_on`（默认 `sun`）
  - 输出：按周列（7 行）的 heatmap 网格（level 0..4），并包含阈值与 streak 等派生字段
- 前端改造策略：`useActivityHeatmap` 优先调用新 endpoint；若后端暂未部署/返回 404，则回退到现有 `vibescore-usage-daily` + 本地派生（保证平滑迁移）
- 安全与鲁棒性：限制 `weeks` 最大值，避免滥用导致过大范围查询；所有日期按 UTC 处理
- 测试：为派生算法与参数归一化补充单元测试；为端到端增加可重复的 smoke/手工验证步骤

## Impact

- **接口新增**：不破坏现有 `vibescore-usage-daily` 与 Dashboard 行为；可以灰度切换
- **部署增加一项**：InsForge2 需要新增/更新一个 edge function
- **数据不变**：仍然以 `vibescore_tracker_daily` 为事实来源，不引入新表/新聚合视图（MVP）

