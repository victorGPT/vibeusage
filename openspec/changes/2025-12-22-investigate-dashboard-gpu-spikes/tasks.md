## 1. Discovery & Baseline
- [x] 1.1 固化复现步骤（Dashboard / Landing，线上与本地对比）。
- [ ] 1.2 记录基线：Chrome Task Manager GPU Process，前台静置 60s。
- [ ] 1.3 记录 Performance Trace（包含 GPU / Compositor / Paint 轨迹）。

## 2. Isolation Matrix (No code changes)
- [x] 2.1 禁用动画（DevTools: `animation: none !important`），对比 GPU 突刺变化。
- [x] 2.2 禁用模糊与阴影（`backdrop-filter/filter/box-shadow`），对比变化。
- [x] 2.3 暂停定时器驱动组件（逐一注释或 DevTools override），对比变化。
- [x] 2.4 对比 Landing vs Dashboard 差异组件列表，定位增量负载。
- [x] 2.5 临时隐藏 ActivityHeatmap（或禁用其滚轮映射），观察告警与 GPU 变化。

### Evidence
- 用户报告：隐藏 ActivityHeatmap 后 GPU 突刺无明显下降。
- 用户报告：禁用所有动画/过渡后 GPU 突刺无明显下降。
- 用户报告：禁用模糊与阴影后 GPU 突刺下降约 25%。
- 用户报告：仅禁用 `setInterval` 时下降约 8%；与“禁用模糊/阴影”叠加无明显额外收益。
- 用户报告：禁用 `requestAnimationFrame` 的效果与禁用 `setInterval` 接近。
- 用户报告：关闭代码雨 + 模糊/阴影后 GPU 下降约 30%；关闭页面后 GPU 进一步下降约 30%。

## 3. Root Cause & Recommendations
- [ ] 3.1 输出主因归类（Top 1-2）与证据截图/trace。
- [ ] 3.2 给出最小化修复建议（不移除核心视觉）。
- [ ] 3.3 若需要代码级诊断开关，提出后续变更建议。

## 4. Verification
- [ ] 4.1 复现/隔离步骤可被他人复跑。
- [ ] 4.2 记录最终结论与下一步决策点。
