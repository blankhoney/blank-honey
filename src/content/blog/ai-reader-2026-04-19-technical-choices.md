---
title: 技术选型那几天：我决定让系统先像工具，而不是像产品
slug: ai-reader-2026-04-19-technical-choices
description: AI Reader 早期技术栈的取舍：先保持能部署、能排查、能替换，而不是堆一整套 AI 平台。
date: 2026-04-19
category: engineering
tags:
  - AI
  - RSS
  - AI Reader
  - Engineering Log
draft: false
places: []
---

## 先做工具，不做平台

4 月中旬我开始认真想技术栈。那几天最怕的不是写不出来，而是写成一个自己都维护不动的系统。

AI 项目特别容易变成这样：一开始只是想加个问答，最后向量库、任务队列、知识图谱、插件系统全塞进去。架构图看起来很先进，实际每天都在修胶水代码。

所以我给自己定了一个原则：先做工具，不做平台。

## 选能解释的东西

后端基础选 Docker Compose。这个项目本质上是自用加小规模部署，不需要 Kubernetes。

入口层用 Caddy，主要是配置简单，自动证书省心。认证用 Authelia，是因为 reader、auth、staging、prod 这些域名后面都要统一保护，我不想每个应用自己写一套登录。

RSS 核心继续交给 Miniflux。它提供 API、已读状态、星标和订阅源刷新。数据库用 Postgres，一方面 Miniflux 本来就用，另一方面评分、阅读状态、候选队列这些关系数据也适合放进去。

模型侧一开始就决定不绑死 OpenAI。实际部署环境里 MiniMax 更顺手，后面 scorer-worker 接 MiniMax M2.7，也是在这个方向上继续走。

## Next.js 是为边界服务的

前端当时还没完全确定，但我已经偏向 Next.js。

不是因为它最酷，而是它能同时处理服务端读取、API route 和前端工作台。对这个项目来说，服务端直接读 Miniflux 和评分库很重要。我不想在浏览器里暴露内部服务，也不想让页面靠公网绕一圈调用自己。

我也想过要不要引入 LangChain 或 Vercel AI SDK。最后没有。当前 Agent 功能只是围绕当前文章问答，上下文来自文章正文、摘要、评分和用户选中文本。直接写 prompt、调用模型、流式返回，反而更容易控制。

框架不是不能用，只是我当时的问题还没复杂到那个程度。

## 难点其实是状态边界

这个阶段我开始意识到，项目的难点不是某个单点技术，而是状态边界。

Miniflux 有自己的状态，reader-web 有自己的状态，scorer-worker 有评分状态，Authelia 又控制访问状态。如果这些边界混了，后面一定会出现“写入成功但读不回来”“页面能打开但 API 被拦截”这类问题。

所以技术选型最后变成一种克制：Caddy + Authelia + Miniflux + Postgres + Next.js + Python worker。

没有魔法，都是能解释、能排查、能替换的东西。那时候项目还没正式启动，但架子其实已经定下来了。
