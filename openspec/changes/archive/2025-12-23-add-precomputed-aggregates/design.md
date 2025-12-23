## Context
目前读路径依赖实时聚合（尤其 leaderboard），在用户规模增长时容易成为热点。我们需要在 InsForge 体系内做“预计算 + 缓存化”，而不是引入 BFF。

## Goals / Non-Goals
- Goals:
  - 保持现有 API contract 不变
  - 降低 leaderboard 查询对数据库的实时聚合压力
  - 用外部自动化触发刷新，避免依赖 InsForge 内建调度
  - 在 InsForge 内完成（函数 + 数据库）
- Non-Goals:
  - 新建 BFF / 独立服务
  - 改变端点路径、请求/响应格式

## Decisions
- 使用 **预计算快照** 作为 leaderboard 数据源（异步刷新）
- 新增刷新端点（service role 鉴权），由 GitHub Actions 定时触发
- 继续使用 InsForge Functions 作为查询入口

## Risks / Trade-offs
- 预计算刷新间隔引入“轻微滞后”
- 需要额外的自动化任务来维护快照

## Migration Plan
1. 增加快照表与视图（不改线上读取）
2. 增加刷新端点与自动化触发
3. 切换 Leaderboard 读取来源
4. 观察指标与回滚

## Open Questions
- InsForge 是否支持定时任务 / 触发器？
- 若无内建调度，使用 GitHub Actions 是否满足稳定性与成本要求？
