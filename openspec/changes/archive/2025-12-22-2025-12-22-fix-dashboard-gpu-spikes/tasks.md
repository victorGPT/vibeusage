## 1. Implementation
- [x] 1.1 移除 `AsciiBox`/`SystemHeader` 等大容器的 `backdrop-filter`，提高纯色背景不透明度。
- [x] 1.2 收敛大面积阴影（`shadow-2xl`/大半径 glow），保留小元素光晕。
- [x] 1.3 下调 `MatrixRain` 的 `fps` 与 `scale`，保持全屏落雨。
- [x] 1.4 视觉验收：Matrix 风格保持一致，信息可读性不变。

## 2. Verification
- [ ] 2.1 Dashboard 静置 60s GPU 平均/峰值对比（改动前后）。
- [ ] 2.2 Landing 静置 60s GPU 平均/峰值对比。
- [ ] 2.3 记录对比结果与结论。

### Evidence
- 用户确认：视觉验收通过（风格与可读性可接受）。
