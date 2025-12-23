# Change: Add copy registry for web UI text

## Why
当前网页文案分散在多个页面/组件中，修改成本高、难以追踪所属模块。需要一个可编辑的“文案表”作为单一事实来源，让你只改表即可统一变更，并保持可追溯的模块归属。

## What Changes
- 在仓库内引入“文案注册表（Copy Registry）”，集中管理所有网页文案。
- 每条文案记录包含模块/页面/组件/用途信息，确保可追溯。
- 页面文案改为通过稳定 `key` 引用注册表内容（不再硬编码）。

## Non-goals
- 不引入外部 CMS 或远程配置服务。
- 不做多语言/AB 测试/运行时热更新（后续可扩展）。

## Impact
- Affected specs: `openspec/specs/vibescore-tracker/spec.md`
- Affected code (预计):
  - `dashboard/src/pages/**`
  - `dashboard/src/components/**`
  - `dashboard/src/ui/**`
  - 新增：`dashboard/src/content/copy.csv`（或等价格式）

## Milestones & Acceptance (high level)
- M1: 文案注册表格式与字段确定，包含模块归属。
- M2: 网页文案覆盖率 100%（页面/组件全部改用 key）。
- M3: 具备校验/验证流程，避免缺 key 或模块信息缺失。
