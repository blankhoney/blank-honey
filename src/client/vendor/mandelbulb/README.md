# mandelbulb-xr 提取说明

上游：[ibrews/mandelbulb-xr](https://github.com/ibrews/mandelbulb-xr)，固定提交
`4b67dde1f420e9bba726d34a396ffb3fd0a2931b`，MIT（Copyright (c) 2026 Alex Coulombe / Agile Lens）。
该提交 `LICENSE` 原文随本目录保存为 `LICENSE.txt`，部署产物保留于
`/vendor/licenses/mandelbulb-LICENSE.txt`。

## 取用的内容

`fragment.glsl` 是该提交 `index.html` 中 `<script type="text/plain" id="frag">` 的逐字副本
（blob `b8c8520e46c876807e8c9311b6c7e542c6a4307a`，3416 字节）。这是实际网页运行的那份 GLSL，
包含距离估计 `bulbDE`、球体范围裁剪、四次采样的梯度法线、`softShadow`、orbit trap 配色与
`1-exp(-2.2*col)` + gamma 的输出链。

**没有**取用同一仓库的 `core/mandelbulb.glsl`：那份 `mb_shade()` 里写作
`mb_softShadow(p + n * 0.01, lightDir, /*power*/ 8.0)`，把阴影步的 power 固定成 8.0，而同一帧的
`mb_de()`、`mb_calcNormal()` 用的是动态 power，power 偏离 8 时阴影与形体不对应。实际网页版把动态
power 传进阴影，本站以网页版为准。上游 `core/PARAMETERS.md` 自己也把 power 描述为在约 5.2–9.8 之间游走。

没有搬运：`core/` 文档、`variants/`（Shadertoy / WebGL / LÖVR / OpenXR）、`social-card.png`、
页面 overlay 标题与提示、错误层，以及上游的拖拽轨道控制与 `preserveDrawingBuffer: true` 的循环。
顶点着色器（上游 `index.html` 内三行）也不单独复制：本站全屏三角形由
`src/client/algorithms/gl.ts` 的 `FULLSCREEN_VERTEX` 提供，片元侧改用它的 `vUv`。

## 本站修改

改动集中在 `src/client/algorithms/mandelbulb/shader.ts`，逐字保留的原文可直接与 `fragment.glsl` 对比：

1. `power` 与 `pulse` 改为 uniform（`u_power` / `u_pulse`）。数值仍是上游的 `mb_power`（两条不可约
   正弦 `7.5 + 1.4*sin(0.11t) + 0.9*sin(0.063t + 1.7)`）与 `1.0 + 0.03*sin(0.8t)`，但只由 CPU 计算：
   一个时钟、可单测，也不再有第二处独立时间源。
2. uv 由 `(2.0*vUv - 1.0) * vec2(u_aspect, 1.0)` 得到，替代 `gl_FragCoord` / `u_resolution`：两者映射一致
   （`vUv` 覆盖 [0,1] 且 y 向上，只在半像素采样中心上有差异），`u_aspect` 即宽/高。
3. `MAX_STEPS` / `ITERS` / `SHADOW_STEPS` 按预算档位取 128 / 10 / 16（高档）与 72 / 7 / 8（低档）；
   上游是 150 / 10 / 20。球体裁剪半径（`dot(ro,ro)-1.6`）、相机距离 3.2 与焦距 1.6 未改。
4. 构图：`u_framing` 把主体放到偏右或中下，并随画布宽高比留出 padding（`model.ts` 的
   `mandelbulbFraming`），取代上游固定居中的取景；相机是固定视点 + 慢速自转 + 有界 pointer 视差，
   没有拖拽轨道。
5. 配色改为深靛背景与金/紫 orbit trap，`palette()` 变为紫—金插值，替代上游彩虹调色；轨道陷阱项、
   光照与输出链结构不变。

站内运行时（全屏三角形、`resize` 像素预算、帧调度、可见性暂停、context lost、资源释放）由本站实现，
不使用上游的 `requestAnimationFrame` 循环与全局监听。不含 CDN 运行时依赖、编辑 UI 与社交图片。
