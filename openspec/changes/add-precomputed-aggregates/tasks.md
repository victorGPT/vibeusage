# add-precomputed-aggregates 任务清单

## 1) 设计与验证
- [x] 明确快照表字段与索引（含唯一键与 RLS）
- [x] 明确刷新策略（GitHub Actions 频率与触发方式）
- [x] 明确刷新端点鉴权与幂等策略

## 2) 数据层
- [x] 创建排行榜快照表
- [x] 创建排行榜 source 视图（day/week/month/total）
- [x] 添加必要索引（按 period/window/rank/user）

## 3) Functions 与自动化
- [x] 新增 `vibescore-leaderboard-refresh`（service role 鉴权）
- [x] `vibescore-leaderboard` 读取快照表（不可用时回退旧视图）
- [x] 新增 GitHub Actions 定时触发刷新

## 4) 验证与回滚
- [ ] 加入验证脚本或手动 smoke 步骤
- [ ] 记录回滚策略与回滚步骤

## 5) 文档
- [x] 更新 `BACKEND_API.md`
- [x] 更新 `openspec/specs/vibescore-tracker/spec.md`
