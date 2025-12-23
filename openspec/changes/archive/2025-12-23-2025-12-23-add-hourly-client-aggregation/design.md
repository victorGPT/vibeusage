## Context
当前 ingest 以逐事件写入 `vibescore_tracker_events`，写入频率高，带来存储与查询负载。产品主要需求是趋势与汇总，事件级审计价值低。

## Goals / Non-Goals
- Goals:
  - 显著降低写入频率与存储增长
  - 保持幂等与重放安全
  - 保持不上传对话内容的安全边界
- Non-Goals:
  - 逐事件审计与长期追溯
  - 秒级/实时指标

## Decisions
- Bucket key: `user_id + device_id + hour_start (UTC half-hour)`
- Payload: `hour_start` + token totals (input/output/cached/reasoning/total)
- Storage: 新增半小时聚合表（建议 `vibescore_tracker_hourly`）
- Idempotency: upsert 覆盖同桶（可选：字段取 max 以抵御乱序）
- Compatibility: 不保留旧事件 ingest，人工通知升级后仅接受聚合格式
- Current half-hour: 允许上传当前半小时，多次上报以覆盖最新累计值
- Auto sync cadence: `sync --auto` 每设备 ≤ 1 次 / 30 分钟（UTC 半小时节奏，允许轻微抖动）；`init`/手动 `sync` 立即上传不受节流限制

## Alternatives Considered
- 保持事件写入 + 服务端聚合：负载下降有限
- 分钟级聚合：写入仍偏高
- 仅在后端做定时 rollup：不解决写入压力

## Risks / Trade-offs
- 兼容旧客户端：可能需要双写或迁移窗口
- 当前小时数据延迟：若仅上传已完成小时，展示会有 0~1 小时延迟
- 上报乱序：需明确 upsert 语义（replace vs max）

## Migration Plan
1) 新增 half-hour 表与 ingest payload（不影响旧客户端）
2) CLI 切换为半小时聚合上传
3) usage endpoints 切换到 half-hour 数据源
4) 事件表写入降级或停用（若无兼容需求）

## Open Questions
- 无
