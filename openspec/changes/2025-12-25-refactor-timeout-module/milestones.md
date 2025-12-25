# Milestones

## M1 - Requirements & Acceptance
- Entry criteria: 需求边界确认（仅前端超时模块）。
- Exit criteria: `requirements-analysis.md` + `acceptance-criteria.md` 完成。
- Required artifacts: 需求与验收文档。

## M2 - OpenSpec Proposal (if applicable)
- Entry criteria: 明确变更 ID 与影响范围。
- Exit criteria: `proposal.md` + `tasks.md` 完成。
- Required artifacts: 变更提案与任务清单。

## M3 - Unit Test Coverage
- Entry criteria: 模块 API 设计冻结。
- Exit criteria: 新增单测覆盖关键分支。
- Required artifacts: `test/http-timeout.test.js`。

## M4 - Regression & Integration
- Entry criteria: 单测通过。
- Exit criteria: `node --test test/*.test.js` 通过。
- Required artifacts: 回归命令与结果记录。

## M5 - Release & Monitoring
- Entry criteria: 代码变更合并。
- Exit criteria: 线上手动验证超时行为无回归。
- Required artifacts: 线上验证记录（简要）。
