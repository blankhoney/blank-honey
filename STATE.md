# Blank Honey 施工状态

更新：2026-09-13。用户要求本轮完成施工、Chrome 验收、GitHub、CI/CD 与生产替换；后置仅表示顺序，不设置人工阶段中断。

## 范围与计划

- [x] 对齐 PRD v1.3、架构 v1.4、程序设计 v1.1；HTML 只作为首屏内容和气质参考。
- [x] 自下而上实现 domain、application、Astro 页面与浏览器增强，集中配置工具、实验 HTML 和外部地址。
- [x] 五种 Hero、单向转场、持久侧栏、搜索、音乐、阅读增强、地图、图谱、真实探针及隔离实验。
- [x] 迁移原博客 50 篇已发布文章及 13 张原图，保留日期、标题、正文与 slug；清除示例文章和虚构旅行记录。
- [x] 根据文章正文的明确引用建立 5 条关系，支持中文文章 ID。
- [x] Docker 全链路、静态检查、边界测试、Chrome 桌面与手机交互检查；问题先定位再修复。
- [x] 创建公开 GitHub 仓库，配置 CI/CD 和受限部署身份，实际 CI 与 Deploy 均已成功运行。
- [x] 备份旧站、接通 Giscus、两路电台、生产探针与 restic 每日备份，完成恢复检查及本机加密副本。
- [x] 最新模板分支构建验收并推送，独立分支 CI 成功。
- [x] 主域切换、旧站停止及公网 Chrome 最终验收；50 篇文章和 100 条旧中英文链接全量通过。
- [x] 已验收功能提交自动部署成功，最终备份刷新；临时 worktree、SSH 隧道及本次加载的 SSH 身份已清理。

## 已验证的实现

- Astro 静态生成，原生 TypeScript 增强；无 React 或大型 UI 组件框架。文章首载不加载 Leaflet、Cytoscape 或粒子引擎。
- 暖纸到阅读安静交换；终端到暖纸单张翻纸；终端页面的边框粒子依据真实内容尺寸重组。五种首屏为 orbit、drift、helix、terrain、archive。
- 桌面最多 1100 粒子，手机最多 420；轻量 30fps，全量上限 60fps。系统减少动效优先，卸载清理动画、事件与观察器。
- 侧栏覆盖正文，打开聚焦搜索，Escape 关闭；点击导航或搜索结果自动关闭，音乐在站内切换持续播放，手动暂停保持。
- Pagefind 仅索引已发布文章；空模板不索引功能页。Giscus 使用本仓库 Announcements、pathname 与 strict 匹配，滚动到评论区才加载。
- 工具与实验通过配置记录生成列表及独立源产物，无公网上传后台。主站日志接口拒绝实验源跨域写入。
- 指标使用真实 node_exporter、OTel、Prometheus 数据；百分比与 load 原值分开。10 秒轮询、后台暂停、过期不冒充新数据。
- 只保留合同需求；所有代码代理启用 ponytail full。未添加 SHA-256 实现。

## 验收证据

- 最新静态检查：0 错误、0 警告，2 条现有 XMLValidator 弃用提示；12 项测试通过，50 篇文章生产构建成功。
- Docker 五服务构建运行正常。真实故障注入区分离线与不可用，恢复后返回 ok；跨源日志拒绝、大小限制、缓存和 404 已验证。
- Chrome 1440×900、390×844：首屏、阅读、目录、搜索、导航、地图缩放、图谱、工具、主题与关闭动效；无横向溢出。修复小字对比度、手机导航关闭、图谱裁切及中文标题行距。
- Chrome Lighthouse 文章目录：Accessibility 100、Best Practices 100、SEO 100。未限速本地性能轨迹 LCP 219ms、CLS 0；这是本地单次测量，不等同公网移动网络性能。
- Chrome 实际 Ambient 电台 readyState 4、时间持续增长，并跨页播放；古典 RSS 电台也已 readyState 4 且播放时间增长；手动暂停与暗色/关闭动效设置跨页保留。Giscus 正常显示评论表单与 GitHub 登录入口。
- 服务器新站经 SSH 隧道检查真实文章、中文全文搜索及 Giscus；独立实验 HTTPS 已验证。公网文章 Chrome 移动端 Lighthouse：Accessibility、Best Practices、SEO 均 100，无失败项；未限速单次轨迹 LCP 537ms、CLS 0。公网 Giscus 表单与独立工具输入/实验滑块均实测正常。
- 发布审计：146 个已跟踪文本文件未发现真实凭据；Git 与 Docker 排除 .private、环境文件、日志、电台生成文件和验收产物。SSH key、密码、主机私有配置不提交。

## Git 与运维

仓库：https://github.com/blankhoney/blank-honey 。main 保留施工检查点；template 使用无祖先的独立历史并清除个人内容和生产专用文件。

CI 对 push/PR 执行检查、测试、生产构建与 Docker 构建。Deploy 只接受本仓库 main 的成功 push CI；受限 SSH 命令只部署当前 main，主机密钥固定，部署加锁并保留前一版 manifest 和镜像供回滚。

旧站代码、配置、数据库与持久内容已备份，数据库目录恢复清单检查通过。新站 restic 已实际备份、check、恢复并比较文件；每日 timer 已启用，本机保留独立加密副本。详细结果见 deploy/ACCEPTANCE.md，回滚操作见 docs/operations.md。

模板检查点 `45de573`：空内容构建、12 项测试和工作流检查通过；模板 CI `34729111775` 成功。主站功能提交 `7ca32a2` 的 CI `34728997988`、Deploy `34729083870` 均成功。最终文档提交的 CI/CD 结果可按 Actions 对应提交查看。

最终恢复副本已刷新并通过归档校验；生产每日备份启用。保留本地 Docker 与公网服务供验收。工具/实验使用独立 HTTPS 源；现有自有 lab 子域 DNS 未改动，当前通过可配置的独立解析域提供服务。
