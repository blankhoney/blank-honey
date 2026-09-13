# Blank Honey

小型个人博客。Astro 生成静态页面，Pagefind 提供本地搜索；探针与日志由独立的只读服务处理。工具和实验 HTML 发布到独立源。

## 本地运行

使用 Node.js 22.12+（推荐 Node.js 24 LTS）和 Docker Desktop。

```sh
npm ci
cp .env.example .env
npm run build
npm run dev
```

`dev` 只启动 Astro。工具、探针和错误日志请在 Docker 环境验收。

```sh
npm run check
npm test
npm run docker:up
```

Docker 默认使用 `.env.example` 构建演示站。需要使用个人配置时，运行 `BUILD_ENV_FILE=.env docker compose up -d --build`；环境文件通过构建 secret 传入，不写入镜像层。

主站默认地址为 `http://localhost:8080`，工具及实验为 `http://localhost:8081`。结束后运行 `npm run docker:down`。实际验证记录见 `STATE.md`。

## 内容与配置

- `src/config.ts` 聚合导航、分类、首屏效果、粒子数量、瓦片、电台、工具和实验。
- `.env` 配置真实域名、电台来源、Giscus 和服务地址，不提交 Git。变量名参考 `.env.example`。
- 文章放在 `src/content/blog/*.md`，图片放在 `src/assets/`。Frontmatter 包含 `title`、`description`、`date`、`category`，可选 `tags`、`places`、`draft`。草稿不进入公开文章、搜索或关系图。
- 地点放在 `src/data/places.json`，关系放在 `src/data/relations.json`。关系两端是文章 slug，只有 `definite` 且两端已发布的关系公开展示。
- 当前文章与图片为演示内容，不代表真实经历。换入个人内容后将 `demoContent` 设为 `false`。

新增工具或实验时，在 `config.tools` 或 `config.experiments` 增加一条记录即可。`html` 指向项目内 HTML；关联 CSS、图片等使用相对路径，并放在该 HTML 目录之内。HTML 中的 `__SITE_RETURN__` 在构建时替换为主站工具页或实验页地址。不要放置密钥或私人文件。

已有外部工具时，设置记录的 `urlEnv` 对应环境变量，构建会使用外部地址。外部工具和本地实验均不得与主站同源。修改配置、HTML 或域名后重新构建，列表和产物自动更新。这里没有上传后台。多文件 JavaScript 工程先使用自己的构建工具打包，再登记生成的 HTML；本项目只跟随 HTML/CSS 的静态资源引用。

电台地址仅在构建时读取。`direct` 使用音频 URL；`rss` 取第一条可用音频 enclosure。没有配置来源则隐藏电台；单台解析失败显示暂不可用，不阻断站点构建。RSS 变更需要重新构建。

## 代码边界

`src/domain` 定义数据规则，`src/application` 组合内容与配置，页面和浏览器增强位于外层。探针不公开 Prometheus 查询能力。工具 HTML 不进入主站 `dist`。

代码使用 MIT；文章、照片与第三方资源版权独立。需要无历史的公开模板时，在工作区干净且已提交后运行 `node scripts/template.mjs`，生成独立 `template` 分支。脚本清除文章、图片、地点、关系、电台、主机清单和参考文档；发布前检查自己后来加入的个人信息。脚本不会上传或切换当前工作区。

部署、日志与备份见 [运维说明](docs/operations.md)。
