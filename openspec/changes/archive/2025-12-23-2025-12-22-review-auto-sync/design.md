## Context
Auto sync 依赖 Codex `notify` 触发 `sync --auto`，并受本地节流（20s spawn throttle + 上传节流）影响。用户需要确认 auto sync 是否生效以及是否还需改善。

## Goals / Non-Goals
- Goals:
  - 形成可复现、可判断的 auto sync 健康度标准。
  - 明确“生效/退化/失效”的证据点与行动指引。
  - 若存在缺口，提出最小改进（以可观测性为主）。
- Non-Goals:
  - 不引入系统级定时任务或后台常驻守护进程。
  - 不改变上传节流策略的核心语义（除非证据不足）。

## Module Brief
### Scope
- IN: auto sync 触发与诊断链路（notify → sync → queue → upload）。
- OUT: 后端聚合与 dashboard 展示逻辑。

### Interfaces
- CLI: `sync --auto`, `status`, `status --diagnostics`。

### Data flow and constraints
- notify handler 写入 `~/.vibescore/tracker/notify.signal` 并节流 spawn。
- `sync --auto` 解析日志，写队列并按节流决定上传批次。
- 上传成功/失败写入 `upload.throttle.json` 并影响后续自动上传。

### Non-negotiables
- notify handler 必须非阻塞且不影响 Codex CLI 正常完成。
- 不引入常驻服务。

### Test strategy
- 通过 `status`/`--diagnostics` 输出验证：
  - `last_notify` / `last_notify_triggered_sync` 更新
  - `queue.pending_bytes` 变化
  - `upload.last_success_at` 与 `next_allowed_after`

### Milestones
- M1: runbook 与健康度判定标准明确。
- M2: 若必要，补充最小可观测性改进（不改变行为）。
- M3: 记录验证证据。

## Decisions
- Decision: 优先做“证据链 + 诊断判定”，再决定是否调整节流或提示。

## Risks / Trade-offs
- 过度节流可能导致“看起来没同步”，但数据仍最终一致。
- 过度放宽节流可能导致频繁上传或 CPU 占用增加。

## Assumptions
- auto sync 的“生效”以触发链路与队列/上传状态为准，不要求实时。
