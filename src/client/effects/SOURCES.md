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
