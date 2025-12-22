# Change: Optimize ingest path to reduce DB load

## 结论
基于第一性原理（减少重复读写与往返），在 **service-role ingest** 路径中引入“直接 upsert + ignore-duplicates”的快速通道，避免先 `select` 再 `insert` 的双查询。若后端不支持 upsert，安全回退到旧逻辑。

## Why
- ingest 是高频写路径，当前 service-role 路径做了 **预先查询** 去重，造成额外 DB 负担。
- 已存在 anon 路径的 `on_conflict + ignore-duplicates` 快速通道，可复用并保持幂等。

## What Changes
- service-role 路径优先使用 records API 的 `on_conflict=user_id,event_id` + `resolution=ignore-duplicates`。
- 若 upsert 不可用（或被拒绝），回退到原有的 `select` → `insert` 逻辑。
- 保持接口与行为不变。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-ingest.js`
- 风险：写路径变化，需要回归幂等与插入计数。
