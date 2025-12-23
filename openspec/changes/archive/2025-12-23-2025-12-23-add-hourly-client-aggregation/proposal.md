# Change: Client-side half-hour aggregation ingest (reduce write load)

## 结论
将客户端上传从“逐事件”改为“按 UTC 半小时聚合”，以显著降低写入负载与表膨胀。服务端按 `user_id + device_id + hour_start(UTC)` 幂等 upsert，长期查询走聚合表，事件级明细不再作为主链路。

## Why
- 事件级明细写入频率高，带来数据库写放大与表增长压力。
- 产品仅需要趋势与汇总，无需长期保留逐事件审计。
- 用户明确优先“降低写入负载”，接受小时级上传节奏。

## What Changes
- CLI 将 `token_count` 事件聚合为 **UTC 半小时桶**，仅上传聚合结果（不上传逐事件明细）。
- Ingest 接口支持小时聚合 payload，并以 **幂等 upsert** 覆盖同桶数据。
- 服务端新增/调整半小时聚合存储（如 `vibescore_tracker_hourly`），长期保留。
- usage endpoints 改由半小时聚合派生（daily/monthly/summary）。
- 明细事件表不再作为主链路；若仍存在历史数据，保留上限 **30 天**。
- 不提供旧客户端事件上传兼容窗口，人工通知升级后仅接受聚合格式。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `src/lib/rollout.js`, `src/commands/sync.js`, `src/lib/uploader.js`, `insforge-src/functions/vibescore-ingest*.js`, `insforge-src/functions/vibescore-usage-*.js`, database schema/views
- Risks: 旧客户端兼容、桶写入幂等语义、时区口径一致性、数据回填策略

## Decisions (user-confirmed)
- 存储基准：**UTC 半小时**（前端按本地时区展示）
- 分桶维度：**按设备分桶**（`user_id + device_id + hour_start`）
- 上传策略：**只上传聚合**（不再上传逐事件明细）
- 兼容策略：**无旧客户端兼容窗口**（人工通知升级）
- 当前半小时：**允许上传并覆盖更新**

## Open Questions
- 是否需要在服务端对“同一半小时多次上传”做写入频控？
