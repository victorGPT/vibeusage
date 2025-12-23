## 1. Implementation
- [x] 1.1 在 `MatrixRain` 中引入低分辨率渲染缓冲与全屏拉伸显示。
- [x] 1.2 添加帧率上限与时间步进控制，避免 60fps 常驻绘制。
- [x] 1.3 增加列密度控制与参数化配置，减少 draw calls。
- [x] 1.4 处理 `visibilitychange` 与 `prefers-reduced-motion`，隐藏/降噪时暂停渲染。

## 2. Verification
- [ ] 2.1 Chrome Task Manager 观测 GPU process：前台静置 60s 平均 <2%。
- [ ] 2.2 验证动画仍为动态效果（可见持续下落与尾迹）。
- [ ] 2.3 切到后台后不再调度帧，回到前台恢复。
