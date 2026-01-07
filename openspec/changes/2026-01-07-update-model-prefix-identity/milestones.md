# Milestones

## 1) Spec & TDD baseline
- Entry: 需求确认（前缀保留、严格匹配、默认价格回退）
- Exit:
  - `requirements-analysis.md`
  - `acceptance-criteria.md`
  - `test-strategy.md`
  - `proposal.md` + `tasks.md`
  - spec delta created

## 2) Implementation & unit tests
- Entry: Spec 与任务清单已确认
- Exit:
  - `normalizeUsageModel`/`applyUsageModelFilter` 更新
  - 单元测试通过

## 3) Endpoint integration
- Entry: unit tests 通过
- Exit:
  - usage 端点过滤与 alias 扩展行为符合 AC
  - pricing alias 行为符合 AC

## 4) Verification & report
- Entry: 端点测试通过
- Exit:
  - 运行指定测试命令并记录结果
  - Canvas 更新完成
