---
title: 把评分 Worker 改成一个真正可调用的内部服务
slug: ai-reader-2026-05-28-event-driven-scoring-service
description: AI Reader 的评分链路从后台脚本收敛成内部 HTTP 服务，支持健康检查、单篇重评和 Miniflux webhook。
date: 2026-05-28
category: engineering
tags:
  - AI
  - RSS
  - AI Reader
  - Engineering Log
draft: false
places: []
---

## 不只是一个后台脚本

5 月 28 日这轮改动，我没有继续往界面上堆东西，而是回头处理评分链路。

前面 AI Reader 已经能给文章打分、生成摘要和理由，但评分的触发方式还不太像一个产品：要么靠定时批量跑，要么靠我手动观察数据库。它能工作，但不够可控。

最开始的 `scorer-worker` 更像一个后台脚本：隔一段时间拉一批文章，调用 MiniMax，然后写入 PostgreSQL。这个模式适合验证算法，但不适合日常阅读。

我真正需要的不是“每隔多久扫一次”，而是三个明确动作：

- 新文章来了自动评分；
- 我在页面上点一篇文章时可以实时重评；
- 系统能告诉我 scorer 本身是不是健康。

## 改成内部 HTTP 服务

所以这轮把 `scorer-worker` 改成了内部 HTTP 服务。它有三个核心接口：

- `GET /healthz`：给部署和 smoke test 检查健康；
- `POST /internal/score-entry`：按文章 ID 评分，支持 `force=true` 重新评分；
- `POST /webhooks/miniflux`：接 Miniflux 的 `new_entries` webhook。

这样评分不再是一个黑盒循环，而是一个可以被 `reader-web`、Miniflux 和部署脚本明确调用的服务。

这个改动看起来只是接口变化，其实边界更清楚了。Miniflux 仍然负责 RSS 抓取和条目状态；`scorer-worker` 只负责拿到文章、判断、写评分；`reader-web` 不直接调用 MiniMax，而是通过内网 scoring service 发起单篇评分。

这样前端按钮不会变成 LLM 代理，MiniMax key 也不会暴露到浏览器。

## 只在内网调用

为了防止接口被乱用，内部评分接口用了 Basic Auth，并且只设计在 Docker 内网里调用。

webhook 地址也是 `scoring-service-staging:8000` 或 `scoring-service-prod:8000` 这种内部别名，不走公网 Caddy。这个细节让我放心很多：AI 能力成本不高，但也不能把它随便挂在公网。

## LLM 输出必须先校验

另一个变化是评分结果本身。

之前模型返回如果混了 `<think>` 或多余文本，JSON 解析会失败，甚至会落到 baseline 分数，导致所有维度都是 37，理由还是 `length/hash`。

后来我把解析逻辑收紧：先清理模型思考文本，再从噪音里提取 JSON。成功评分必须包含总分、各维度分、中文摘要、原文摘要、语言和维度理由。

baseline/error 不再当作有效评分展示，也不参与排序。

这个地方其实挺典型：LLM 输出不是数据库结构，它只是候选文本。真正进系统前必须经过解析、校验和降级。用户看到的是评分和摘要，不应该看到模型的中间过程，也不应该因为一次失败就把一堆假的同分写进体验里。

## 从 demo 往工具走

这轮之后，评分链路变得更接近日常使用：新到文章可以通过 webhook 自动评分，当前页可以点“重评前 N 篇”，单篇文章可以实时重评，部署时也能用 `/healthz` 验证服务活着。

它不再是一个“晚上跑一下的脚本”，而是 AI Reader 里一个明确的内部能力。

我觉得这算是项目从 demo 往工具走的一步。demo 只要能打一次分就行；工具需要知道什么时候打、失败了怎么提示、旧错误怎么隐藏、接口边界在哪里。

评分这件事本身不复杂，复杂的是让它稳定地参与阅读流程。
