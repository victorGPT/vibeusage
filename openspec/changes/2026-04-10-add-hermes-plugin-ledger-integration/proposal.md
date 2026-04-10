# Change: Add Hermes plugin-ledger integration

## Why

- 让 `vibeusage init` 可以像管理 Codex / Claude / Gemini / OpenClaw 一样，正式安装并管理 Hermes 集成。
- Hermes 已经提供插件与 lifecycle hook 扩展面，并在 `post_api_request` 暴露规范化 token usage；直接消费这些最小事实比解析 `~/.hermes/state.db` 或 session transcript 更符合隐私边界与第一性原理。
- 当前仓库尚无 Hermes 接入路径；如果继续走内部存储解析或多路径 fallback，会破坏“唯一事实源”并增加长期维护成本。

## What Changes

- 新增 Hermes integration，并规定 `vibeusage init` 是唯一允许安装/修改 Hermes 集成状态的命令。
- 通过 `vibeusage init` 安装 Hermes VibeUsage 插件到 Hermes 插件目录；插件使用 Hermes lifecycle hooks 采集 usage。
- 定义 Hermes 本地 usage ledger 为唯一受支持的本地事实源，`sync` 只读取该 ledger，不解析 `~/.hermes/state.db`、`~/.hermes/sessions/` 或 trajectory 文件。
- 新增 Hermes ledger 的增量解析与半小时桶聚合路径，`source = "hermes"`。
- 将 `status` / `diagnostics` / `uninstall` / README 更新为 Hermes plugin 术语与新数据流。

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `src/commands/init.js`, `src/commands/status.js`, `src/commands/uninstall.js`, `src/commands/sync.js`, `src/lib/integrations/`, new Hermes config/plugin template helpers, new Hermes ledger parser, diagnostics, tests, README
- **BREAKING**: Hermes support SHALL only work through the plugin-ledger path; parsing Hermes internal state stores is explicitly unsupported.

## Architecture / Flow

- `vibeusage init` installs the Hermes VibeUsage plugin.
- Hermes plugin listens to `on_session_start`, `post_api_request`, and `on_session_end`.
- Plugin appends privacy-safe records to a local Hermes usage ledger under VibeUsage control.
- `vibeusage sync` incrementally parses that ledger, aggregates UTC half-hour buckets, and uploads through the existing ingest pipeline.

## Principles

- **No backward compatibility:** no fallback parsing of Hermes internal stores.
- **Single source of truth:** Hermes local usage = plugin-written ledger only; cloud aggregates = PostgreSQL only.
- **First principles:** capture normalized usage at the API boundary, not by reverse-engineering transcripts.
- **Atomic commits:** land spec, plugin install path, sync/parser path, and docs/tests in separate commits.

## Risks & Mitigations

- 风险：Hermes hook payload drift。
  - 缓解：插件只依赖已接入核心的 stable hook names，并对字段缺失做显式保护。
- 风险：hook 中做太多工作导致主流程卡顿。
  - 缓解：插件只做 append-only 本地落盘，不做网络上传。
- 风险：Hermes usage 字段比现有 bucket 更细。
  - 缓解：ledger 保留细粒度字段；聚合层仅在上传时投影到当前 bucket 合同。

## Rollout / Milestones

- M1 OpenSpec proposal/design/tasks approved
- M2 Hermes plugin install/uninstall path implemented
- M3 Hermes ledger parser + sync path implemented
- M4 Status/diagnostics/docs/tests completed and verified
