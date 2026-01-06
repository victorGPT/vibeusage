<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Canvas 规则

- 每次创建/修改/删除前必须先查阅 `architecture.canvas`，确认受影响的节点。
- 制定计划前必须先更新 Canvas：运行 `node scripts/ops/architecture-canvas.cjs`；若脚本不可用，手动更新并保持节点格式与已有节点一致。
- 全流程结束后必须再次更新 Canvas，保证节点格式与现有节点保持同步。
- 渐进式披露：阅读架构时先运行 `node scripts/ops/architecture-canvas.cjs --list-modules` 获取模块，再用 `--focus <module> --out architecture.focus.canvas` 生成聚焦画布；阅读时只打开 `architecture.focus.canvas`，需要全量时再查看 `architecture.canvas`。

# OpenSpec 使用范围

- 默认使用 skill 工作流，不强制走 OpenSpec。
- 仅在以下“重大模块”场景触发 OpenSpec：外部集成、跨模块核心流程、DB schema 变更、安全/权限边界变化、破坏性变更。

# 文案规则（Copy Registry）

- 本项目页面上所有展示文字必须来自 `dashboard/src/content/copy.csv`。
- 任何文案改动必须汇总到文案表，不允许在组件内新增/修改硬编码文本。
- 文案表与项目官网内容必须双向同步：官网改动需回写文案表，文案表更新需同步到官网。

# 回归用例要求

- 每次提交必须执行回归用例（至少覆盖本次变更相关路径），并记录执行命令与结果。

# 工作流规则（Workflow）

- 完成代码后仅执行本地提交（git commit），未经用户明确指示不得推送（git push）。
