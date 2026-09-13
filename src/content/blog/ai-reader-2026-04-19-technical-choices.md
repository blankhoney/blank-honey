---
title: AI Reader 选型：一篇文章经过哪些服务
slug: ai-reader-2026-04-19-technical-choices
description: Miniflux 继续抓取与管理订阅，新增的评分和项目状态由工作台自己保存。
date: 2026-04-19
category: engineering
tags:
  - AI Reader
draft: false
places: []
---

选技术栈时，我先拿一篇文章把流程过一遍：订阅源发布，Miniflux 抓到正文；评分程序读正文，把分析写下来；页面再把文章和分析放到一起。沿这条路径分工作，比先列一排框架名字更容易决定要写什么。

Miniflux 已经管着订阅、刷新、已读和星标，我准备继续用它。抓取出错回它那里查，评分失败到评分服务查。文章本身没有必要为了新界面再复制成另一套真相。

```text
Miniflux ──文章与阅读状态──→ reader web
    │                         ↑
    └→ Python 评分程序 → 本地 Postgres
```

这是四月的方案示意。仓库中能追溯的实现从五月开始，图里的分工后来逐步落地，不能把后面的代码都算到选型这一天。

本地库需要保存的，是 Miniflux 没负责的部分。评分自然在这里；后来用户把文章选进项目，也用本地 `entry_project_queue` 保存。五月的项目查询实现（`scoring/repository.ts`，版本 `b733e6a`）能看出这个区别：它查的是用户留作项目线索的文章，并非等待 worker 处理的评分任务。候选收藏仍对应 [Miniflux API](https://miniflux.app/docs/api.html) 的 starred。

页面这边倾向 Next.js。服务端取数与页面放在一个项目里，浏览器只和工作台交互，内部地址、访问凭据留在服务端。文章数据已经到了同一个进程，需要复用查询逻辑时就直接调用函数。

模型调用先用 Python 写评分，文章问答则围绕当前正文、摘要与选中文本组织上下文，逐段返回答案。考虑过 LangChain 和 Vercel AI SDK，第一版没有接进来。此时调用路径还短，自己读得明白；等某段重复工作确实变多，再决定要不要换。

部署用 Docker Compose，Caddy 接域名入口，Authelia 做访问控制。它们增加了配置工作，不过职责明确：外部用户经过入口认证，服务之间使用内部地址和自己的凭据。Next.js、Python worker 与两个数据来源都要沿这条线接好。

我最想保留的是一条能独立调试的路径：拿到一篇文章，读到哪一步失败，就去对应的服务看，不必每次把所有组件从头重启。
