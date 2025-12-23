# Design: Copy Registry for Web UI Text

## Context
网页文案分散在组件与页面内，导致改动不可控、难追踪模块归属。需要建立单一事实来源，做到“只改表、不改代码文本”。

## First Principles
- **Single source of truth**: 文案只能有一个来源，避免重复与漂移。
- **Traceability**: 每条文案必须能定位到模块/页面/组件与用途。
- **Replaceability**: 文案可被整体替换而不改动业务逻辑。

## Goals / Non-Goals
- Goals:
  - 所有网页文案统一注册管理。
  - 提供明确的模块/页面/组件归属字段。
  - 降低修改成本与出错概率。
- Non-Goals:
  - 不引入外部 CMS。
  - 不做多语言与实验分流（未来可扩展）。

## Decisions
- **Registry format**: 采用仓库内表格文件（建议 CSV），便于非开发者编辑与批量修改。
- **Canonical file location**: `dashboard/src/content/copy.csv`。
- **Key strategy**: 稳定 `key`（例如 `landing.hero.title`），页面只引用 key。

## Registry Schema (proposed)
Required columns:
- `key`: Stable lookup key (e.g., `dashboard.header.clock_label`)
- `module`: Module name (e.g., `landing`, `dashboard`, `connect`)
- `page`: Page/component scope (e.g., `LandingPage`, `DashboardPage`)
- `component`: UI component (e.g., `MatrixShell`, `AsciiBox`)
- `slot`: Usage/placement (e.g., `title`, `subtitle`, `cta`)
- `text`: Display copy

Optional columns:
- `notes`: Constraints or context
- `status`: `active|deprecated` (default `active`)

## Data Flow
- UI components reference `key` only.
- Runtime loader resolves `key` → `text` from registry.
- Validation ensures all keys exist and all records have module/page/component.

## Risks / Trade-offs
- CSV editing may introduce format errors → mitigate with validation script.
- Refactor effort is cross-cutting → stage migration by page/module.

## Migration Plan
1. Inventory all UI copy strings.
2. Populate registry with existing copy.
3. Replace hardcoded text with `copy(key)` calls.
4. Add validation to prevent missing keys.

## Open Questions
- 是否需要为“动态插值文案”定义统一模板格式？
