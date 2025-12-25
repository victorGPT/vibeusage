# Change: Add ingest batch metrics for observability

## Why
- 当前仅能通过数据库聚合推断 ingest 负载，缺少 per-request 的批量指标与节流证据。
- InsForge 侧对“短时间大量写入”的担忧需要可验证的指标与审计轨迹。

## What Changes
- 新增 ingest 批量指标表（按请求记录 bucket 数、inserted/skipped、来源与设备维度）。
- `vibescore-ingest` 在成功鉴权与校验后记录一次 metrics（best-effort，不影响主流程）。
- 增加 retention 机制，定期清理过期 metrics（默认 30 天）。
- 更新运维/接口说明文档，提供查询示例与解释 `created_at/updated_at`。

## Impact
- Affected specs: `vibescore-tracker`
- Affected code: `insforge-src/functions/vibescore-ingest.js`, `insforge-src/functions/vibescore-events-retention.js` (or new retention path), DB schema
- **BREAKING**: none

## Architecture / Flow
- Ingest request (device token) → validate payload → upsert hourly buckets → best-effort insert metrics row → respond.
- Metrics insert failure MUST NOT fail the ingest response.

## Risks & Mitigations
- 风险：每次 ingest 额外写入一次记录。
  - 缓解：best-effort + 小字段 + retention 清理。
- 风险：指标表泄露敏感内容。
  - 缓解：仅记录数值与 ID（不记录 prompt/response）。

## Rollout / Milestones
- M1: Requirements + Acceptance
- M2: SQL + Edge Function + retention plan
- M3: Tests + verification queries
- M4: Deploy + observe
