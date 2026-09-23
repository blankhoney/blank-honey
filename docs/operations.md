# 运行与维护

本页说明通用功能的本地运行方式。脚本与测试通过只代表通用功能验证，不代表任何具体环境已完成验收。

## 环境与启动

需要 Node.js 24 与 Docker（用于工具/实验产物构建和本地监控栈）。

```sh
npm ci
cp .env.example .env
npm run check
npm test
npm run build
npm run docker:up
```

`.env` 只保留在本机，不要提交 Git。Docker 默认读取 `.env.example` 构建演示配置；使用自己的配置时运行 `BUILD_ENV_FILE=.env docker compose up -d --build`，环境文件通过 BuildKit secret 传入，不写入镜像层。

默认主站 `http://localhost:8080`，工具与实验站 `http://localhost:8081`；只有这两个端口绑定到宿主机回环地址。Compose 包含 `web`、`worker`、`node-exporter`、`otel`、`prometheus`，采集与指标端口只在内部网络使用。Docker 下的采集结果反映 Docker Linux 环境，不是 macOS 宿主机状态。

```sh
docker compose ps
docker compose logs --tail 100
npm run docker:down
```

构建依次生成电台配置、`lab-dist`、静态站、Pagefind 索引与正文图片变体。工具和实验 HTML 不进入主站 `dist`。页面错误、播放器错误与探针日志通过窄口留在本机。

## 聚合配置

站点名称、介绍、导航、分类、首屏效果、工具与实验在 `src/config.ts` 中配置。域名、电台来源、Giscus 与外部工具地址由 `.env` 提供。

在 `src/config.ts` 增加工具或实验记录后重新构建。每条记录包含 `slug`、名称、描述、`html` 和 `urlEnv`。本地 HTML 及相对资源从其所在目录复制，路径不得越出该目录，符号链接同样校验真实路径。设置 `urlEnv` 对应变量时直接使用独立的外部 HTTP(S) 地址。

`__SITE_RETURN__` 会替换为主站 `/tools/` 或 `/lab/` 地址。自带 HTML 应使用该标记提供返回链接。HTML 里不得嵌入密钥；构建产物可被访问者读取。

电台源只接受 HTTP(S)，RSS 解析有 8 秒超时和 2 MB 上限。缺失源不生成对应台；解析失败保留暂不可用状态。浏览器不获取 RSS 地址。

## RSS 与公开阅读

`/rss.xml` 只订阅本站已发布的原创文章，`/rss/` 提供地址和复制入口。`/reader/` 展示管理员订阅的外部 RSS/Atom；它不进入原创文章 RSS 或 Pagefind 索引。订阅条目公开可读，不能添加私密或授权受限的源。正文是源实际提供的内容或摘要，不额外抓取原网页；图片和嵌入默认不加载。

数据库保存在 worker 的 `/data/reader/reader.sqlite`，本地 Compose 用 `reader-data` 命名卷。默认没有订阅、没有管理员密码，也没有公开的初始化接口。在自己的服务器终端执行：

```sh
docker compose exec worker node server/reader-admin.mjs password
```

终端会要求输入两次新密码（至少12个字符），输入不显示。不要把密码放在命令参数、环境变量或聊天中，也不要用管道输入。随后打开 `/reader/manage/` 登录，添加明确的 RSS/Atom 地址；不是普通网页地址。设置 `ALLOWED_ORIGIN` 为实际主站源（不带路径或结尾斜杠），生产必须是 HTTPS，以启用 Secure 会话 Cookie。改密码撤销全部旧会话，忘记密码可在终端重新运行同一命令。

启用的源默认每24小时抓取一次，启动时补跑到期任务；新增立即入队，也可手动刷新。全服务只抓取一个源，失败退避且保留旧缓存。首版只接收公开网络的 HTTP(S) 80/443 端口和 UTF-8 XML，最多50个源、每次200条、解压后2MiB、每条正文64KiB、总计10000条。达到总容量会拒绝整批新增，不悄悄删除历史；清缓存会重抓源当前窗口，不能恢复它已撤下的旧条目。

备份运行中的数据库必须使用 SQLite 在线备份，不能直接复制正在写入的主文件：

```sh
docker compose exec worker node server/reader-admin.mjs backup /data/reader/snapshot-YYYYMMDD.sqlite
```

目标必须是尚不存在的文件；快照也含订阅与登录信息，应保持私有、纳入自己的加密备份，绝不提交 Git。恢复时先停止自己维护的 worker、在独立目录核对快照，再替换数据库；保留原数据库及配套 WAL，不把不同时间的主库/WAL 混用。不要使用 `docker compose down -v` 删除阅读数据。

## 探针与主机清单

`deploy/hosts.json` 初始为空数组。需要探针时按数组添加条目：每项包含 `publicId`、`displayName`、`regionLabel`、`timeZone` 和内部 `instance`。前四项用于公开展示，`instance` 只在服务端查询指标。公开响应不得带真实地址、凭证或原始 Prometheus 数据。

采集目标在 `deploy/otel.yaml` 中登记，当前指向本地容器的 `node-exporter`。生产域名、真实主机清单、采集目标与备份凭证请使用使用者自有的私有配置，通过 Compose override 只读挂载，不要提交公共仓库。`SITE_URL` 与 `LAB_ORIGIN` 必须是不同的源；生产请设置独立域名并自行配置 TLS。

## 日志

`logs/site.jsonl` 记录运行错误，最多 1 MiB 后轮转到 `site.jsonl.1`；`logs/build.jsonl` 记录构建失败。日志不记录文章输入、工具输入或用户文本。构建日志不自动轮转，保留时长由本机运维管理。

## 公共仓库边界

本仓库只包含通用代码。请不要提交真实文章、图片、地点或实验记录：`src/content/blog/`、`src/assets/`、`public/content-diagrams/`、`public/benchmarks/`、`public/images/hero/` 与 `examples/benchmarks/` 已在 `.gitignore` 中忽略，`src/data/places.json`、`src/data/relations.json`、`src/data/experiments.json` 与 `deploy/hosts.json` 保持空值。

个人内容需要在仓库外的私有构建快照中叠加后再构建，不通过 GitHub CI 发布。仓库没有自动生产部署流程，也不提供发布命令；部署方式由使用者按自己的环境决定。

第三方依赖与随附资源的许可证原文随产物保留，不因本项目的 MIT 授权而改变。首屏效果的来源说明见 `src/client/effects/SOURCES.md`。
