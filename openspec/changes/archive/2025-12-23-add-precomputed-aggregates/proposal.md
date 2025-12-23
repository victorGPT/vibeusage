# Change: Add precomputed aggregates for scale

## Why
随着用户规模增长（目标 1 万用户），现有“实时聚合 + 即时排行”会放大数据库压力与运行时抖动风险。需要在 **不引入 BFF**、不改变现有 API contract 的前提下，建立可扩展的排行榜快照机制，并通过自动化触发刷新。

## What Changes
- 新增“按周期预计算”的排行榜快照（异步刷新），Leaderboard 读取快照而非实时全表聚合
- 新增受限的刷新端点，供自动化任务调用（服务角色鉴权）
- 使用 GitHub Actions 定时触发刷新（仍通过 InsForge Functions）
- 保持现有 endpoints 与响应结构不变（contract 不变）
- 继续使用 InsForge Functions，不引入新的 BFF 或自建服务

## Impact
- Affected specs: `vibescore-tracker`
- Affected code:
  - `insforge-src/functions/vibescore-leaderboard*`（读取快照 + 刷新）
  - 数据库对象（新增快照表、视图、索引、刷新机制）
  - `.github/workflows/*`（自动化刷新）
