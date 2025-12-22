## 1. Implementation
- [x] 1.1 TREND 保留完整坐标轴，future 桶保留但不绘制（趋势线截断于当前）。
- [x] 1.2 DETAILS（日表）过滤未来日期行（不依赖 `future` 标记也能生效）。
- [x] 1.3 未来桶标记覆盖已有行（避免未来 0 值被当成真实数据）。

## 2. Verification
- [ ] 2.1 Dashboard week/month：TREND 不显示未来桶（无空线/零值）。
- [ ] 2.2 DETAILS 不显示未来日期行。
- [ ] 2.3 `?mock=1` 下验证行为一致。
