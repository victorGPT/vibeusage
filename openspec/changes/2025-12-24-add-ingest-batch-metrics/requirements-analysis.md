# Requirement Analysis

## Goal
- 为 ingest 负载提供可验证、可查询的批量指标，回应“短时间大量写入”的可观测性需求。

## Scope
- In scope:
  - 记录每次 ingest 请求的批量指标（bucket 数、inserted/skipped、来源、设备、时间）。
  - 指标 retention（默认 30 天）。
- Out of scope:
  - 修改 ingest 幂等逻辑或上传策略。
  - Dashboard 展示或用户可见 UI。

## Users / Actors
- 运维/开发（排查负载与节流效果）。
- InsForge 维护人员（验证写入峰值合理性）。

## Inputs
- Ingest request payload（hourly buckets）
- Ingest response metrics（inserted/skipped）

## Outputs
- 可查询的 ingest 批量指标表（支持按分钟聚合）。

## Business Rules
- 指标写入 MUST be best-effort，不得影响 ingest 成功路径。
- 指标不得包含 prompt/response 等敏感内容。
- 过期指标必须可清理（retention）。

## Assumptions
- 每次 ingest 最大 bucket 数受现有上限控制。
- 现有 retention 机制可扩展或复用。

## Dependencies
- InsForge DB schema / RLS
- Edge Function `vibescore-ingest`
- Retention workflow

## Risks
- 额外写入放大压力（可通过轻量字段 + retention 缓解）。
- 指标写入失败导致 ingest 失败（需 best-effort 处理）。
