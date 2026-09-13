# 运行与维护

## 启动与验收

复制 `.env.example` 为 `.env`，配置 `SITE_URL` 与 `LAB_ORIGIN`，运行：

```sh
npm ci
npm run check
npm test
npm run build
npm run docker:up
```

默认主站 `http://localhost:8080`，工具与实验站 `http://localhost:8081`。Compose 包含 `web`、`worker`、`node-exporter`、`otel`、`prometheus`。采集与指标端口只在内部网络使用，不发布到宿主机。Docker 下采集器反映 Docker Linux 环境，不代表 macOS 宿主机全部状态。

```sh
docker compose ps
docker compose logs --tail 100
npm run docker:down
```

构建先载入 `.env`，生成电台配置与 `lab-dist`，再生成静态站、Pagefind 索引，以及正文 AVIF/WebP picture。工具和实验 HTML 不进入主站 `dist`。页面错误、播放器错误与探针日志通过窄口留在本机。

## 聚合配置

在 `src/config.ts` 增加工具或实验记录后重新构建。每条记录包含 `slug`、名称、描述、`html` 和 `urlEnv`。本地 HTML 及相对资源从其所在目录复制，路径不得越出该目录，符号链接同样校验真实路径。设置 `urlEnv` 对应变量时直接使用独立的外部 HTTP(S) 地址。

`__SITE_RETURN__` 会替换为主站 `/tools/` 或 `/lab/` 地址。自带 HTML 应使用该标记提供返回链接。HTML 里不得嵌入密钥；构建产物可被访问者读取。

电台源只接受 HTTP(S)，RSS 解析有 8 秒超时和 2 MB 上限。缺失源不生成对应台；解析失败保留暂不可用状态。浏览器不获取 RSS 地址。

## 探针与生产部署

`deploy/hosts.json` 是数组。每项包含 `publicId`、`displayName`、`regionLabel`、`timeZone` 和内部 `instance`。前四项用于公开展示，`instance` 只在服务端查询指标。公开响应不得带真实地址、凭证或原始 Prometheus 数据。

Docker 默认以 `.env.example` 构建；使用实际配置时运行 `BUILD_ENV_FILE=.env docker compose up -d --build`。环境文件经 BuildKit secret 传入，只有前台必需值进入静态产物。

生产域名、真实主机清单、采集目标和备份凭证放在私有环境中，通过 Compose override 只读挂载。不要将真实服务器配置提交公共仓库。`SITE_URL` 与 `LAB_ORIGIN` 必须是不同的源；生产请设置独立域名并按 `deploy/README.md` 配置 TLS。

## 日志与备份

`logs/site.jsonl` 记录运行错误，最多 1 MiB 后轮转到 `site.jsonl.1`；`logs/build.jsonl` 记录构建失败。日志不记录文章输入、工具输入或用户文本。构建日志不自动轮转，保留时长由本机运维管理。

使用 `deploy/backup.sh` 调用 restic。先在私有环境配置 `RESTIC_REPOSITORY` 和密码文件；初次使用时按 restic 要求初始化仓库。备份包括配置、服务文件、日志、私有环境和工具源文件。具体目录以脚本为准。

恢复时先恢复到独立目录，检查内容后再替换运行文件：

```sh
restic snapshots
restic restore latest --target /path/to/restore-review
```

恢复检查包括文章、环境变量、主机清单、工具 HTML 与日志。重新构建并完成路由和探针检查后再对外服务。备份本身不代表恢复已经验收。

## 去个人化模板

在已提交且干净的工作区运行 `node scripts/template.mjs`。脚本使用临时 worktree 创建没有父提交的 `template` 分支，不切换当前工作区，不自动发布。它清除文章、图片、地点、关系、电台、主机清单和私人参考文档，并生成新的通用 `STATE.md`。

脚本不是秘密扫描器。发布前检查后续自行添加的代码常量、第三方账号和部署配置；无历史分支只能避免把原分支历史带入模板，不能替代凭证管理。
