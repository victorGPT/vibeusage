# Requirement Analysis

## Goal
- 在不改变业务语义的前提下，为关键写入路径补齐 M1 结构化日志、并发保护与 canary 探针。

## Scope
- In scope:
  - `vibescore-ingest` 并发上限与 429/Retry-After
  - `vibescore-ingest` / `vibescore-device-token-issue` / `vibescore-sync-ping` M1 结构化日志
  - canary 探针脚本（外部调度）
- Out of scope:
  - 变更数据库 schema
  - 改动 CLI/前端业务语义
  - 引入新的第三方监控平台

## Users / Actors
- 后端维护者
- 监控/运维系统

## Inputs
- HTTP 请求（`/functions/*`）
- 环境变量（并发上限、Retry-After）
- canary 设备 token

## Outputs
- M1 结构化日志
- 429 响应与 `Retry-After` 头
- canary 脚本执行结果（退出码）

## Business Rules
- 不记录 payload/PII
- 幂等语义不变
- canary 使用专用 token + `source/model=canary`
- usage 端默认排除 canary 桶（除非显式请求）
- 并发限制为显式开启（默认不限制）

## Assumptions
- Insforge Edge Function 支持环境变量配置
- 外部可运行定时脚本（cron/Actions/自建监控）

## Dependencies
- `insforge-src/shared/logging.js`
- Insforge records API

## Risks
- 并发限制导致高峰期 429
- 日志量增加
- canary token 泄漏
