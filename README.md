# 个人站点模板

通用个人站点。Astro 生成静态页面，Pagefind 提供本地搜索；探针与日志由独立的只读服务处理，工具和实验 HTML 发布到独立源。

## 本地运行

需要 Node.js 24 与 Docker。

```sh
npm ci
cp .env.example .env
npm run check
npm test
npm run build
npm run docker:up
```

`npm run dev` 只启动 Astro。工具、探针和错误日志请在 Docker 环境查看。

Docker 默认使用 `.env.example` 构建演示站；使用自己的配置时运行 `BUILD_ENV_FILE=.env docker compose up -d --build`，环境文件通过构建 secret 传入，不写入镜像层。

主站默认地址为 `http://localhost:8080`，工具及实验为 `http://localhost:8081`，只有这两个端口绑定到宿主机回环地址。结束后运行 `npm run docker:down`。

`.env` 只保留在本机，不要提交。脚本与测试通过只代表通用功能验证，不代表任何具体环境已完成验收。

## 内容与配置

- `src/config.ts` 聚合站点名称、介绍、导航、分类、首屏效果、粒子数量、瓦片、电台、工具和实验。
- 文章放在 `src/content/blog/*.md`，图片放在 `src/assets/`。Frontmatter 包含 `title`、`description`、`date`、`category`，可选 `tags`、`places`、`draft`。草稿不进入公开文章、搜索或关系图。
- 地点放在 `src/data/places.json`，关系放在 `src/data/relations.json`，两者初始为空。关系两端是文章 slug，只有 `definite` 且两端已发布的关系公开展示。
- 域名、电台来源、Giscus 和服务地址由 `.env` 提供，不提交 Git；变量名参考 `.env.example`。
- 首屏效果的来源与第三方许可见 `src/client/effects/SOURCES.md`。

新增工具或实验时，在 `config.tools` 或 `config.experiments` 增加一条记录即可。实验的 `html` 指向项目内 HTML；关联 CSS、图片等使用相对路径，并放在该 HTML 目录之内。HTML 中的 `__SITE_RETURN__` 在构建时替换为主站工具页或实验页地址。不要放置密钥或私人文件。

本地工具登记 `config.tools` 的 `slug`、`name`、`description`、`urlEnv` 和 `html`。`html` 是条目位置的唯一来源：它必须正好是 `src/tools/<目录>/<文件>.html` 这一层，文件名不必是 `index.html`，目录也不必与 `slug` 同名。`scripts/build-tools.ts` 把所有本地工具一起交给一次 Vite 多页构建，产物按 `slug` 路由到 `lab-dist/tools/<slug>/index.html`，共享一份 `lab-dist/tools/assets/`，与博客主站 `dist/` 分开。工具的构建、运行边界（本机处理、无远程字体/图片/CDN）见 `src/tools/README.md`。

已有外部工具时，设置记录的 `urlEnv` 对应环境变量，构建会使用外部地址并跳过该工具的本地页面；外部工具和本地实验均不得与主站同源，且必须是公开的 HTTP(S) 地址。修改配置、源码或域名后重新构建，列表和产物自动更新。这里没有上传后台。

## 五款本机工具

工具目录仍在主站 `/tools/`，下面的工作台路径属于独立工具源，新标签打开，不中断博客音乐。

| 工作台 | 路径 | 范围与默认上限 |
| --- | --- | --- |
| 压缩小箱 | `/tools/archive/` | 创建/读取 ZIP、7z，单项下载或将所选内容打成 ZIP；输入 100 MiB、展开 256 MiB、1000 条目。窄屏降为 48 MiB、128 MiB、300 条目；可取消，拒绝危险路径和链接。拖入目录保留空目录，文件夹选择按钮受浏览器文件列表能力限制。 |
| 图片裁切 | `/tools/image-crop/` | PNG/JPEG/静态 WebP，旋转、缩放、比例/坐标裁切，导出三种格式；输入 20 MiB、32 MP，输出单边最多 8192 像素且不超过 32 MP。 |
| Markdown 书桌 | `/tools/markdown/` | UTF-8 `.md` / `.markdown`，最多 2 MiB；渲染/原文切换，禁用原始 HTML 与图片加载。 |
| 公平好运 | `/tools/luck/` | Web Crypto 拒绝采样的骰子与硬币，无加权、无后台；最近 12 轮只留在内存。 |
| 今日小签 | `/tools/fortune/` | 1900–2100 年公历、固定 UTC+8 的传统历法；未知时辰或节气边界明确未定。每日签按同一输入稳定生成，仅供娱乐，非科学预测。 |

## 工具构建与许可

- 所有本地工具在**同一次** Vite 多页构建里打包，相对 `base`，资源名带内容哈希，公共模块提升为共享 chunk。构建设置 `envDir: false` 且不读取仓库 `.env`，`import.meta.env` 不注入任何环境变量。
- 工具图内的本地 import 只允许落在 `src/tools/` 内或已安装依赖里，路径经 `realpath` 解析，因此符号链接无法绕出边界；工具源码里的隐藏文件（如 `.env`）不能作为资源被引入。跨出 `src/tools/`、指向项目源码或指向项目根 `.env` 的引用都会让构建失败。
- 构建不扫描产物文本，也不改写文案：工具页面里合法出现的 URL 文本原样保留。防止密钥外泄靠的是不读 `.env` 和不注入 `import.meta.env`，而不是事后过滤。
- 每个源 HTML 必须**恰好**含一处 `<a href="__SITE_RETURN__">`。缺失、重复、出现在标签外或 `<script>`/`<style>` 等原始文本里都会失败；构建不会自动补一条回链。
- 7-Zip 引擎（`7z-wasm`）按原样复制到 `lab-dist/tools/vendor/7z/`，附带 `7zz.es6.js`、`7zz.wasm`、包内许可、完整 `LGPL-2.1.txt`、`unRarLicense.txt`、7-Zip 24.09 与 7z-wasm 1.2.0 对应源码归档及 `SOURCE.md` 构建说明。原始来源材料保存在 `scripts/licenses/`。引擎是 **GNU LGPL + unRAR 限制**，不是 MIT，本项目授权不覆盖它；只有本地构建压缩工具时才复制。引擎不进业务 bundle，由 archive 的 module Worker 动态 import，可单独替换。
- 第三方依赖许可只在 `lab-dist/tools/licenses/index.html` 全局列出一次，并附完整许可原文（MIT、MPL-2.0/Apache-2.0 等），不在各工具下重复、也不在主站声明。运行时依赖的嵌套依赖（如 `@cropper/*`、`readline-sync`）同样列出。
- 工具页面在本机处理文件与姓名，不上传、不写 URL/console/localStorage；`__SITE_RETURN__` 是唯一的跨源回链。

AI 生成实验集中登记在 `src/data/experiments.json`（初始为空）。静态产物放在 `examples/benchmarks/<slug>/`，该目录默认被 Git 忽略。清单记录原始提示词、来源版本、模型与推理强度、生成时间和观察结果；构建自动生成实验卡片、详情和源码下载，原始产物不注入博客样式。题面与第三方库的权利归原作者，不包含在本项目 MIT 授权内。

电台地址仅在构建时读取。`direct` 使用音频 URL；`rss` 取第一条可用音频 enclosure。没有配置来源则隐藏电台；单台解析失败显示暂不可用，不阻断站点构建。RSS 变更需要重新构建。

## 公共仓库边界

本仓库只包含通用代码。真实文章、图片、地点和实验记录不要提交：

- `src/content/blog/`、`src/assets/`、`public/content-diagrams/`、`public/benchmarks/`、`public/images/hero/` 与 `examples/benchmarks/` 已在 `.gitignore` 中忽略。
- `src/data/places.json`、`src/data/relations.json`、`src/data/experiments.json` 与 `deploy/hosts.json` 保持空值。

个人内容需要在仓库外的私有构建快照中叠加后再构建，不通过 GitHub CI 发布；仓库没有自动生产部署流程。第三方依赖与随附资源的许可证原文随产物保留。

## 代码边界

`src/domain` 定义数据规则，`src/application` 组合内容与配置，页面和浏览器增强位于外层。探针不公开 Prometheus 查询能力。工具 HTML 不进入主站 `dist`；工具源码只在 `scripts/build-tools.ts` 的构建里被读取，不进入主站 Astro 构建。

代码使用 MIT；文章、照片与第三方资源版权独立。

运行、配置与日志见[运维说明](docs/operations.md)；本地 Docker 与私有配置见[本地部署说明](deploy/README.md)。
