---
title: AI Reader 的工作台出来了，但真正难的是别让状态打架
slug: ai-reader-2026-05-13-ai-reader-workbench
description: reader-web 第一次成型：三栏工作台、文章状态、流式 Agent，以及被部署和认证边界反复教育的一天。
date: 2026-05-13
category: engineering
tags:
  - AI
  - RSS
  - AI Reader
  - Engineering Log
draft: false
places: []
---

## 工作台终于有样子了

5 月 13 日是项目最像“爆发”的一天。

reader-web 开始成型：文章 API、模块分类、阅读状态、订阅源接口、桌面工作台、流式 Agent、Caddy 路由，基本都在这一天集中推进。

最早的工作台是三栏：左侧模块，中间文章列表，右侧文章详情和问答。这个布局很直接，但刚好贴合我的使用方式。

我不是想沉浸式读一本书，而是在信息流里快速扫描、点开、判断，再决定要不要深入。所以中间列表必须密，右侧详情必须能立刻看到评分、摘要和正文，Agent 不能喧宾夺主。

## 列表数据不要到处 fetch

第一个坑是文章列表。

Miniflux API 会返回文章，但本地还要合并评分、稍后读、最近阅读、候选状态。如果数据流不清楚，很容易写成前端到处 fetch。

后来我把文章查询逻辑放到服务端，reader-web 的 Server Component 直接复用 Miniflux + scoring 的查询逻辑，而不是从服务端再绕公网调用自己的 `/api/articles`。

这个改动后面救了 staging。Authelia 会拦截公网自调用，导致页面空列表。服务端直接走内部逻辑，少了一层没必要的认证和网络绕路。

## user id 不统一，状态就会打架

第二个坑是阅读状态。

Miniflux 有 user id，本地 reader state 也要按 user id 存。如果读写用的不是同一个 `READER_MINIFLUX_USER_ID`，就会出现“写入成功但读不回来”。

这个 bug 很隐蔽，因为接口看起来都 200，只有行为不对。最后把 user id 全部统一到配置里，才算稳定。

## Agent 输出要在服务端清理

第三个坑是 Agent 输出。

模型有时候会把 `<think>` 这种推理内容直接吐出来。前端如果照单全收，用户看到的就不是回答，而是模型内心戏。

后来我把过滤放到了服务端 SSE 边界，前端只负责展示。这个边界很重要：不能指望每个 UI 都记得过滤一次，应该在输出进入产品之前就清理掉。

## 功能和部署同时打架

这一天也开始有了“AI Reader”的味道：文章能按模块筛，能看评分，能问当前文章。

但它还很粗糙。staging 路由没合并到 main，Caddy 不认识 `staging-ai-reader`，TLS 直接失败；reader-web 容器没起来；Caddy 宿主机和容器配置不一致。

那天一半时间写功能，一半时间都在证明“问题不是代码，是部署没到位”。

这也是我第一次强烈感觉到：AI 项目不能只看 demo。真正让它可用的是状态一致、部署一致、认证一致。否则页面再聪明，用户也只会看到 loading。
