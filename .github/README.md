# 持续集成与部署

`CI` 在 main、template 推送和 PR 上执行依赖安装、类型检查、测试、静态构建以及两个 Docker 镜像构建。它只获得仓库读取权限，不使用生产凭证。

`Deploy` 仅接受本仓库 main 推送触发且已成功的 CI。部署任务没有仓库令牌权限，不检出或执行仓库代码，只通过 SSH 调用服务端的固定命令 `deploy <已验证提交>`。生产任务串行执行。

在 GitHub 的 `production` environment 配置以下 secrets：

- `DEPLOY_HOST`：服务器域名或 IPv4 地址，SSH 使用 22 端口。
- `DEPLOY_USER`：拥有受限部署密钥的服务账号。
- `DEPLOY_SSH_KEY`：部署专用私钥。服务器 authorized_keys 应限制为固定命令，禁止转发和交互终端。
- `DEPLOY_KNOWN_HOSTS`：通过可信渠道核对的服务器 SSH host key 行；工作流不自动信任扫描结果。

服务端命令只接受固定格式的提交标识，fetch 后要求它等于 origin/main，串行构建并保留前一版用于回滚。安装方式与恢复命令见 `deploy/` 文档。GitHub Actions 不发送服务器环境文件，生产配置只保留在服务器。

模板分支只保留 `ci.yml`，删除 `deploy.yml` 和本文；模板使用者自行配置部署。
