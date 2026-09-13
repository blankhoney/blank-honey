---
title: 真正开始搭 VPS：第一天就被配置细节教育了
slug: ai-reader-2026-05-11-vps-infra-start
description: AI Reader 基础设施第一天：Caddy、Authelia、Compose 和部署脚本带来的现实排障。
date: 2026-05-11
category: engineering
tags:
  - AI Reader
  - RSS
  - Infrastructure
  - Engineering Log
draft: false
places: []
---

## 第一天基本都在搭骨架

5 月 11 日，仓库正式动起来。第一批提交几乎都是基础设施：Caddy、Authelia、Docker Compose、部署脚本、环境变量和备份。

听起来很 boring，但这一天其实决定了后面能不能持续迭代。

我一开始以为这些东西会很快。结果第一天就被各种小问题打脸：Caddy 里的 `DOMAIN` 没传进去，Authelia 配置模板不按预期替换，Docker Compose 校验又因为 `.env.example` 里的中文注释出问题。

每个问题都不大，但叠在一起非常消耗耐心。

## Authelia 模板越聪明越容易坏

Authelia 的配置需要域名、邮件、notifier、用户库这些东西。

如果写死，staging/prod 会很难维护；如果全靠模板，又容易在容器里生成失败。最后我把模板处理改得更直接，用 `envsubst` 生成运行时配置，少一些“聪明”的模板逻辑。

这个选择很土，但稳定。

## Caddy 是入口，不是附属配置

Caddy 也类似。最开始我低估了 edge 入口的重要性。

reader、auth、staging-reader、staging-auth、后来的 ai-reader，所有域名都挂在这里。只要 Caddyfile 和容器内实际加载的文件不一致，外面看到的就是 TLS 握手失败、SNI 找不到证书。

后面真的遇到过这个问题：宿主机 Caddyfile 已经有新站点，容器里还是旧的。那次之后我明确了一点：部署脚本必须负责 reload 或重建 edge，不能靠“我记得手动执行过”。

## worker 先别默认启动

这一天还做了一个重要的小决定：`scorer-worker` 先放到 Compose profile 里，不默认启动。

因为当时评分任务还没完成，如果 worker 跟着基础设施一起跑，会制造一堆假错误。后面再启用 worker profile，比一开始就让它乱跑要干净很多。

基础设施阶段最怕的是“差不多能跑”。差不多能跑的系统，后面每次出问题都要猜。

第一天虽然慢，但把 Caddy、Authelia、Compose、deploy 这些链路一点点理顺，后面才能把注意力放回产品本身。那天结束时，项目还不像产品，更像一台刚接好电源的机器。但至少它开始有了骨架。
