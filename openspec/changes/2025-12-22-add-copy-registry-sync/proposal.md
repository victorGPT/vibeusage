# Change: Add copy registry sync (origin/main as source of truth)

## Why
当前文案表位于本地 `dashboard/src/content/copy.csv`，但在高频改动下缺少一条“可验证的官方基线同步链路”。需要提供统一的“拉取/推送”脚本，确保文案字段与 `origin/main` 保持一致，并在写入时具备校验、差异预览与显式确认，避免误覆盖。

## What Changes
- 新增一个文案同步脚本（`copy-sync`），支持从 `origin/main` 拉取官方文案表并写入本地。
- 支持将本地文案表推送回 `origin/main`，并带有安全闸门（校验、差异预览、确认）。
- 将 `origin/main:dashboard/src/content/copy.csv` 定义为官方来源，脚本明确显示实际使用的来源。

## Non-goals
- 不引入远程 CMS 或第三方文案平台。
- 不做多语言、AB 测试、运行时热更新。
- 不自动合并复杂冲突（冲突应在本地显式处理）。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code (预计):
  - 新增：`scripts/copy-sync.cjs`
  - 更新：`package.json`（新增 `copy:pull` / `copy:push`）
  - 影响：`dashboard/src/content/copy.csv`（同步与校验）
  - 可能涉及：`docs/copy-registry.md`

## Milestones & Acceptance (high level)
- M1: 同步脚本需求与安全规则明确（来源、校验、确认、回滚）。
- M2: `pull`/`push` 均具备可重复执行的验证步骤（含 `--dry-run`）。
- M3: 文档更新完成，并可在不破坏现有流程下使用。
