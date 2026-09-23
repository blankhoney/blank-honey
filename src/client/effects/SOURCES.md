# 首屏效果来源

首屏效果在 `src/config.ts` 的 `config.hero` 登记，每条记录包含 `id`、显示名和参考来源。只有当前选中的模块按需加载；模块导出接收 `HeroContext` 的挂载函数，所有监听、计时器与引擎资源必须在传入的 signal 中止时释放，模块本身不依赖个人信息。

| 模块 | 参考与已核验效果 | 复用实现 |
| --- | --- | --- |
| io724 | https://io724.com ：黑底居中标题，鼠标彩色墨迹流动；公开脚本标注 AquaInkGL | `webgl-fluid-enhanced` 0.8.0，MIT；与 AquaInkGL 同源 PavelDoGreat/WebGL-Fluid-Simulation，使用公开生命周期 API |
| miniload | https://miniload.top ：黑白 Bayer 抖色云、像素标题；站点 bundle 使用 React Bits Dither | `@paper-design/shaders` 0.0.80 Dithering，Apache-2.0；保留 simplex/Bayer 8×8，密度函数适配为时变域扭曲 fBm 烟雾。不是原 shader 的逐像素复制 |
| isaca | https://isaca.pro ：两张明暗大卡片错层切换，舒缓入场 | 原生 CSS transform/transition；未复制无明确许可的站点 bundle |
| yantao | https://yantao.wiki ：Memphis 首屏，连线粒子、代码窗口打字、轮播 | 项目已安装的 tsParticles（MIT），原生文字渐进呈现；不复制主题脚本 |

另有一个参考站当时在直接网络与代理下均无法打开，未核验，也不以其他效果冒充它。群鸟效果是单独新增的，不声称来自上述任何参考站。

## 群鸟掠空

`birds` 复用 [Vanta BIRDS](https://www.vantajs.com/?effect=birds) 的 GPU Boids 与折纸鸟形。第三方集成教程见 https://blog.patrickskinner.tech/how-to-create-a-badass-links-page-with-3d-motion-background-using-vantajs ；教程本身不是运行该效果的首页，未复制博主内容。

固定 Vanta **0.5.24** 的 shader/geometry 提取到 `../vendor/vanta-birds.ts`，保留成熟群鸟规则；Three **0.186.0** 官方 GPUComputationRenderer 替代旧计算封装。本项目负责延迟加载、full/light 预算、静态回退、唯一 RAF 与完整资源清理；不引入 Vanta Base 的全局修改和旧资源泄漏。具体来源、单鸟 UV 修正与其他差异见 [提取说明](../vendor/vanta-birds.md)。完整 MIT 随部署保留于 `/vendor/licenses/vanta-LICENSE.txt` 与 `/vendor/licenses/three-LICENSE.txt`。

### 动态雾谷镜湖

山谷、湖面与雾层由运行时程序生成，不是整张背景图。新增确定性低多边形地形、实例化树石、几何水波与少量动态雾片，均和群鸟共用原场景与时钟。水面复用同版 Three **0.186.0** 的 [Reflector](https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/objects/Reflector.js) 公开接口，参考 [Water](https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/objects/Water.js) 的 Fresnel/太阳高光处理；倒影只缓存静态景物，首次/投影失效时更新，不每帧重画山谷。完整 Three MIT 已随站保留。

背景程序模块、相机与鸟群空间适配、预算/降级和静态 CSS 渐变边界见[适配说明](../vendor/vanta-birds.md)。没有提取或修改其他示例工程的产物；不新增运行时 CDN、模型下载、体积光追或后处理框架。

## 许可边界

- AquaInkGL 未提供明确仓库许可，因此没有复制其代码；直接使用带 MIT 许可的同算法上游封装：https://github.com/michaelbrusegard/WebGL-Fluid-Enhanced 。
- React Bits 当前及 Dither 首次发布许可包含禁止组件、模板和跨框架组件库再分发的限制，因此没有复制它的组件或 shader：https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md 。
- Paper Shaders 明确允许再分发并要求保留 LICENSE / NOTICE，npm 包内保留原文：https://github.com/paper-design/shaders 。像素云仍复用其 WebGL renderer；本地 shader 适配见下文，不能再称完全未修改 shader。

部署产物保留许可原文：`/vendor/licenses/paper-shaders-LICENSE.txt`、`/vendor/licenses/paper-shaders-NOTICE.txt`、`/vendor/licenses/fluid-LICENSE.txt`，不依赖生产机存在 node_modules。

像素云交互：鼠标附近是柔边暗区（降低噪声强度），不盖住标题。实现为背景层内原生 radial-gradient 跟随鼠标，离开或窗口失焦时恢复；卸载同时移除遮罩与监听。未移植受限 shader。

### 像素云持续烟雾

`pixel-cloud-shader.ts` 对固定 Paper 0.0.80 Dithering 的具名噪声函数作唯一匹配替换：保留上游 simplex 实现、Bayer 矩阵、像素坐标与输出，本地增加归一化 fBm 和二维时变域扭曲。full 三层、light 两层；时间分别进入两个扭曲通道和密度采样，固定抖色阈值，不以随机闪点或整片亮暗变化代替运动。这是程序烟雾密度，不是完整 curl-noise 流场、Navier–Stokes 求解或体积烟雾模拟。

`pixel-cloud.ts` 用公开 ShaderMount 接口且 speed 始终为 0，`effects/miniload.ts` 的唯一 RAF 以 `setFrame` 驱动，分别限制 30/20fps 与 90 万/32 万像素，持续慢帧可单向降低两级。复用纯帧预算判定，不引入新库。渲染器释放后补释放自有 context，异常保留静态后备；reduced 不加载 Paper 或创建 WebGL。静态后备是背景层内的原生渐变，不是动态效果本体。

## 科技页字面与背景

持续粒子字面复用 Phenomenon 1.6.0（MIT、无依赖）负责 WebGL buffers 与渲染；公开接口与许可来源为 https://github.com/vaneenige/phenomenon 。小字号说明与输入控件保持原生语义。

早期科技背景采用点阵，后替换为下述数字雨；字面点云仍保留。Phenomenon 许可随产物保留于 `/vendor/licenses/phenomenon-LICENSE.txt`。

## 阅读与科技转场

- **软页翻转**：复用 [StPageFlip 2.0.7](https://github.com/Nodlik/StPageFlip)，固定上游 commit `ab30ecc1d9f6d98de1a99b8e296469382f41c120`。可读本地 bundle、精确生命周期补丁及再生成步骤见 `../vendor/README.md`；完整 MIT 许可位于 `/vendor/licenses/page-flip-LICENSE.txt`。只传入安全快照，库不持有真实 main；应用只生成旧、新两份快照，portrait 渲染时库自身会临时克隆折面，不再制作 36 份正文。
- **数字雨**：精确使用 `@tsparticles/preset-matrix@4.4.0`，与现有 engine 同版。向下运动、trail、shadow、容器生命周期均由[官方 Matrix 预设](https://particles.js.org/demos/recipes/matrix)提供。`binary-rain.ts` 从 MIT 的 `@tsparticles/shape-matrix/esm/Utils.js` 和 `MatrixDrawer.js` 适配 WeakMap 字形轮换，仅把字符来源改为 0/1、字体改为项目已有 VT323；通过公开 shape API 注册，不声称官方支持 characters 配置，也不修改官方字符表。完整 MIT 位于 `/vendor/licenses/tsparticles-LICENSE.txt`。
- **装饰乱码**：使用 [Baffle 0.3.6](https://github.com/camwiegert/baffle)，MIT，许可位于 `/vendor/licenses/baffle-LICENSE.txt`（npm 包未带 LICENSE，原文取自上游仓库）。`cipher-lines.ts` 仅操作 aria-hidden 装饰字符串。源码审查发现 `reveal()` 有不受 stop 控制的延迟启动，因此使用公开 start/stop/text，加自行持有并可取消的短时调度；不篡改文章或真实监控指标，不显示虚假入侵告警。
- **视觉参考**：[Rezmason Matrix](https://rezmason.github.io/matrix/) 的向下码流、头尾亮度与节奏。没有复制其字体/图集或整页应用，也没有迁入 React Bits 受额外许可限制的组件。
- **视口内淡变**：参考 [Motion scroll offset](https://motion.dev/docs/scroll) 的进入/离开区间表达，使用现有事件驱动 RAF；没有引入 Motion/React 运行时，也不是复制该库的代码。淡变位置在视口内部，中心阅读区保持清晰。

背景由持久化宿主分别管理新旧场景，暂停后保留旧像素直到淡出；palette 固定在场景上，不依赖路由切换后的根 token。常驻 Shell 在 Astro 重挂前捕获旧配色，交换后以 WAAPI 补足颜色过渡。数字雨、乱码、纸页与正文点云各自拥有明确的暂停和销毁边界；tsParticles 4.4.0 的公开 play() 不是幂等调用，加载自动播放后以 animationStatus 判断是否需要恢复，避免重复建立 RAF 调度链。

## 算法场景

第六至第九项首屏 `blackhole`、`ocean`、`reaction`、`terrain` 是同一切换器与 `?effect=` 直达链接下的四个算法场景：`../effects/<id>.ts` 只做适配，渲染实现在 `../algorithms/<id>/`，共享生命周期与帧/像素预算在 `../algorithm-hero.ts`、`../algorithms/types.ts` 与 `../algorithms/gl.ts`。上游源码、固定提交与改动说明放在 `../vendor/<项目>/`（`blackhole/manifest.json` 的逐文件来源/字节/摘要，`reaction/README.md` 等），许可原文随产物保留于 `/vendor/licenses/`。运行期不请求 GitHub、CDN 或任何第三方主机，也不带上游编辑器外壳、账号体系、追踪或声音。

- **blackhole（引力回廊）**：上游 `ebruneton/black_hole_shader`，源码固定 `e72b3f293409893a6fa25528b29572c96fc57f57`，BSD-3-Clause（Copyright (c) 2020 Eric Bruneton）；运行资源固定数据分支 `0a65035fa6ed8557b7bcb1492894c55f555fdae8`。复用 `black_hole/{definitions,functions,model}.glsl` 与 `black_hole/demo/camera_view/fragment_shader.glsl`，保留 `LENSING=1` 的查表射线偏折、盘面交点、黑体色与 Doppler。同源部署 deflection / inverse_radius / doppler / black_body 四张 `.dat` 与噪声 PNG（合计约 3.7MB），只在选中该场景后才加载，float 头、维度、长度与 sha256 见 `manifest.json`。未搬运 516 块约 256MB 的 Gaia 天图，也不带上游火箭、编辑面板与其 RAF：`GalaxyColor` 换成本地确定种子的程序化星空，`STARS=0` 关闭依赖 Gaia 的星点分支；曝光与色调映射放在本地输出 pass，不带上游多级 bloom。相机沿用上游 uniform 变换做固定视点＋小幅 pointer 轨道。
- **ocean（频谱潮汐）**：上游 `squall01337/abyssal-ocean`（README 标题 ABYSSAL），固定 `142265f5013b6f27bea4f4f819b832dec75c7bad`，MIT。从该单文件实现提取 h0 风浪谱（JONSWAP + TMA + Donelan–Banner）、时间谱、双向蝶形 IFFT、位移/Jacobian 组装、泡沫 ping-pong 与海面 shader，不是用几条正弦波代替 FFT；水面使用项目已有 Three 0.186.0（MIT，许可已随站保留），不加载 CDN 版本。桌面 N=256、低档 N=128，径向网格桌面 128×192、低档 64×96，保留三级联、天光与反射/折射；不带上游参数工作室、浮标/水下操控或每帧 readback 探针，镜头固定在水面上方。WebGL2 或浮点 render target 不可用时回退静态层，不悄悄换成另一种波面算法。
- **reaction（生长纹理）**：上游 `piellardj/reaction-diffusion-webgl`，固定 `be78fc4e6c02ea8ccc573407f37ca3a3477b9b57`，MIT（Copyright (c) 2021 Jérémie Piellard）。取 `src/shaders/update/_reaction-diffusion.frag`、`src/shaders/update/brush-apply.frag` 与 `src/shaders/_encode-decode.frag`（该提交的 encode-decode 在 `update/` 的上一级目录）里的 RGBA8 打包 16 位浓度、3×3 Laplacian、feed/kill 与扰动策略；桌面 512²、每显示帧 8 次迭代，低档 256²、4 次，固定种子与稳定参数，首绘前有限预热。不引入生成式 Page 全局、控件模板与上游色彩图，颜色由本地 palette 生成；不加载 cat.jpg 或任何上游纹理。
- **terrain（山脉生成器）**：上游 `ZyFou/ProceduralTerrains`（其 package.json 名为 terrain-studio），固定 `f58a8ddb81d1fbb526a41282a9a7e9c05c2d2070`，MIT（Copyright (c) 2026 ZyFou）。只逐字取 2D 噪声 GLSL primitives（`../vendor/terrain/noise-glsl.ts`），并参考 `TerrainHeightSampler` / `biomeGLSL` 的连续高度、中心差分法线与高度/坡度/气候混色的思路，本地定义确定种子的 domain-warp fBM＋ridged 高度、山谷与水位、雪/岩/植被混色、程序化天空与距离雾；不打包上游引擎、编辑器、账号或桌面应用依赖闭包，也不声称实现其完整侵蚀编辑器。

四种场景共用一套舞台合约：纯 CSS 静态层先显示，模块报告首次成功绘制后才显示 canvas，失败或 reduced-motion 都保留静态层，因此 shader 出错不会让首屏文字消失。静态层只是本地用渐变写的构图（每场景配色与标题留白见 `../../styles/hero.css`），不是算法本身，不引用本站私有图片或任何外链图；所有层都在 `#hero-stage` 内（`z-index:-1`、`pointer-events:none`），页头、GitHub 入口、切换器与文章入口始终在上层且可点击，鼠标/触屏只绑定场景背景，链接、滚动与触屏手势不被拦截。reduced-motion 在导入 GPU 依赖前返回，不加载任何算法模块；未选中的场景不加载其重依赖。
