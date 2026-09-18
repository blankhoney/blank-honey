# 首屏效果来源

2026-09-13 用 Chrome 查看首屏，并检查站点公开脚本。个人内容由 config 与首页模板提供。

| 模块 | 参考与已核验效果 | 复用实现 |
| --- | --- | --- |
| io724 | https://io724.com ：黑底居中标题，鼠标彩色墨迹流动；公开脚本标注 AquaInkGL | `webgl-fluid-enhanced` 0.8.0，MIT；与 AquaInkGL 同源 PavelDoGreat/WebGL-Fluid-Simulation，使用公开生命周期 API |
| miniload | https://miniload.top ：黑白 Bayer 抖色云、像素标题；站点 bundle 使用 React Bits Dither | `@paper-design/shaders` 0.0.80 Dithering，Apache-2.0；以现成 simplex noise + Bayer 8×8 配置重现效果类型。不是原 shader 的逐像素复制 |
| isaca | https://isaca.pro ：两张明暗大卡片错层切换，舒缓入场 | 原生 CSS transform/transition；未复制无明确许可的站点 bundle |
| yantao | https://yantao.wiki ：当前 Memphis 首屏，连线粒子、代码窗口打字、轮播 | 项目已安装的 tsParticles（MIT），原生文字渐进呈现；不复制主题脚本 |

第五站 https://ios25span.com 在 Chrome、直接网络及代理 HTTP/HTTPS 均未能打开，未核验，不以其他效果冒充。待参考恢复再加入配置。

## 许可边界

- AquaInkGL 未提供明确仓库许可，因此没有复制其代码；直接使用带 MIT 许可的同算法上游封装：https://github.com/michaelbrusegard/WebGL-Fluid-Enhanced 。
- React Bits 当前及 Dither 首次发布许可包含禁止组件、模板和跨框架组件库再分发的限制，因此没有复制它的组件或 shader：https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md 。
- Paper Shaders 明确允许再分发并要求保留 LICENSE / NOTICE，npm 包内保留原文：https://github.com/paper-design/shaders 。项目没有手写 WebGL renderer 或 shader。

新增效果：在此目录加入同名模块，导出接收 HeroContext 的挂载函数；在 config.hero 添加 id / name / source。所有监听、计时器、引擎资源须在传入 signal 中止时释放。只有选中的模块按需加载；库没有个人信息依赖。

部署产物保留许可原文：`/vendor/licenses/paper-shaders-LICENSE.txt`、`/vendor/licenses/paper-shaders-NOTICE.txt`、`/vendor/licenses/fluid-LICENSE.txt`，不依赖生产机存在 node_modules。

像素云交互补验：原站鼠标附近是柔边黑色暗区（降低噪声强度），不是盖住标题的黑圆。当前用背景层内原生 radial-gradient 跟随鼠标，离开/窗口失焦时恢复；卸载同时移除遮罩与监听。未移植受限 shader。

## 科技页字面与背景（第二轮返修）

持续粒子字面直接适配用户验收 HTML 的 BHInterfaceCloud；原型 shader 单独保留，生产模块格式化并接入 Astro 生命周期。复用相同的 Phenomenon 1.6.0（MIT、无依赖）负责 WebGL buffers 与渲染；公开接口与许可来源为 https://github.com/vaneenige/phenomenon 。不再使用此前稀疏粒子层结束后淡入正文的路径。小字号说明与输入控件保持原生语义。

早期科技背景采用验收 HTML Quiet Topography 点阵，2026-09-19 按用户反馈替换为下述数字雨；字面点云仍保留。Phenomenon 许可随产物保留于 `/vendor/licenses/phenomenon-LICENSE.txt`。

## 阅读与科技转场（2026-09-19）

- **软页翻转**：复用 [StPageFlip 2.0.7](https://github.com/Nodlik/StPageFlip)，固定上游 commit `ab30ecc1d9f6d98de1a99b8e296469382f41c120`。已查看[官方演示](https://nodlik.github.io/StPageFlip/demo.html)的折页中间态。可读本地 bundle、精确生命周期补丁及再生成步骤见 `../vendor/README.md`；完整 MIT 许可位于 `/vendor/licenses/page-flip-LICENSE.txt`。只传入安全快照，库不持有真实 main；应用只生成旧、新两份快照，portrait 渲染时库自身会临时克隆折面，不再制作 36 份正文。
- **数字雨**：精确使用 `@tsparticles/preset-matrix@4.4.0`，与现有 engine 同版。向下运动、trail、shadow、容器生命周期均由[官方 Matrix 预设](https://particles.js.org/demos/recipes/matrix)提供。`binary-rain.ts` 从 MIT 的 `@tsparticles/shape-matrix/esm/Utils.js` 和 `MatrixDrawer.js` 适配 WeakMap 字形轮换，仅把字符来源改为 0/1、字体改为项目已有 VT323；通过公开 shape API 注册，不声称官方支持 characters 配置，也不修改官方字符表。完整 MIT 位于 `/vendor/licenses/tsparticles-LICENSE.txt`。
- **装饰乱码**：使用 [Baffle 0.3.6](https://github.com/camwiegert/baffle)，MIT，许可位于 `/vendor/licenses/baffle-LICENSE.txt`（npm 包未带 LICENSE，原文取自上游仓库）。`cipher-lines.ts` 仅操作 aria-hidden 装饰字符串。源码审查发现 `reveal()` 有不受 stop 控制的延迟启动，因此使用公开 start/stop/text，加自行持有并可取消的短时调度；不篡改文章或真实监控指标，不显示虚假入侵告警。
- **视觉参考**：[Rezmason Matrix](https://rezmason.github.io/matrix/) 的向下码流、头尾亮度与节奏；已实际查看。没有复制其字体/图集或整页应用，也没有迁入 React Bits 受额外许可限制的组件。
- **视口内淡变**：参考 [Motion scroll offset](https://motion.dev/docs/scroll) 的进入/离开区间表达，使用现有事件驱动 RAF；没有引入 Motion/React 运行时，也不是复制该库的代码。淡变位置在视口内部，中心阅读区保持清晰。

背景由持久化宿主分别管理新旧场景，暂停后保留旧像素直到淡出；palette 固定在场景上，不依赖路由切换后的根 token。常驻 Shell 在 Astro 重挂前捕获旧配色，交换后以 WAAPI 补足颜色过渡。数字雨、乱码、纸页与正文点云各自拥有明确的暂停和销毁边界；tsParticles 4.4.0 的公开 play() 不是幂等调用，加载自动播放后以 animationStatus 判断是否需要恢复，避免重复建立 RAF 调度链。
