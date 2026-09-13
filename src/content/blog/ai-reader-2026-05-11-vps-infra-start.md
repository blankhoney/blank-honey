---
title: DOMAIN 写进 .env 了，为什么 Caddy 还是读不到
slug: ai-reader-2026-05-11-vps-infra-start
description: 沿五月十一日的两次提交，检查变量从部署脚本到容器的传递。
date: 2026-05-11
category: engineering
tags:
  - AI Reader
draft: false
places: []
---

5 月 11 日先搭 VPS 入口。Caddyfile 里用 `{$DOMAIN}`，仓库的环境文件也准备了域名，服务却还拿不到它。回看当天提交，修复落在两个地方，刚好能把变量经过的路径说明白。

部署脚本调用 Compose 时，先要选对环境文件。当天 `deploy.sh` 的 `af995ef` 版本给 edge 的调用补了：

```bash
--env-file "$REPO_ROOT/.env"
```

它让 Compose 知道从哪里取得用于替换配置的值。但值进入 Compose，并不会自动变成容器内所有进程的环境变量。几分钟后的 `be35d40` 版本在 `docker-compose.edge.yml` 给 Caddy 服务补上了下面这段：

```yaml
environment:
  DOMAIN: ${DOMAIN}
```

这里 `${DOMAIN}` 先由 Compose 展开，结果传入容器。到了 Caddy 解析配置时，`{$DOMAIN}` 才能从自己的环境里取值。两种写法很像，读取者却不同。我觉得最容易漏的就是中间这一步：眼睛看见 `.env` 有值，便以为服务也该有了。

```text
仓库 .env
  → 部署命令指定 env-file
  → Compose 展开 ${DOMAIN}
  → environment 传入 Caddy 容器
  → Caddy 展开 {$DOMAIN}
```

[Compose 插值](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)和[Caddy 环境变量](https://caddyserver.com/docs/caddyfile/concepts#environment-variables)各有说明。排查时可以沿这张顺序逐层看，别在最上面的文件里反复改同一个值。

Authelia 的配置还要从模板生成运行文件，这部分用 `envsubst` 把输入输出固定下来。后续新增入口时，也遇到过宿主机 Caddyfile 已更新、容器仍读旧内容的问题。于是部署除了更新文件，还要处理运行中的入口，先确认容器里读到正确文件，再 reload 或重建。

评分服务那时还没准备好，就先放进 Compose profile，不默认启动。入口这边本来就在排错，没必要让未完成服务的报错挤满日志。当天这两处 DOMAIN 修改有代码可对照；要确认某次发布确实恢复，还得另外请求目标域名，看实际运行的入口有没有加载它。
