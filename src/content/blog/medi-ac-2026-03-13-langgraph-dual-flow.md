---
title: LangGraph 双轨流程：一次改写、一次检索、并行生成
slug: medi-ac-2026-03-13-langgraph-dual-flow
description: 第一次让双轨 demo 像个产品接口：用 LangGraph 串起改写、检索和 A/B 输出。
date: 2026-03-13
category: engineering
tags:
  - AI
  - RAG
  - LangGraph
  - Engineering Log
draft: false
places: []
---

## `/v1/dual` 出来以后，demo 才像那么回事

前面几轮都在打地基：容器、ingest、检索、adapter。M4 才真正把它们串起来，做出 `/v1/dual`。

这个接口的目标很明确：用户输入一句话，系统先改写 query，再检索，然后同时产出 A 线问诊回复和 B 线结构化报告。

这也是我第一次觉得这个项目不只是几个脚本拼在一起。

## 为什么用 LangGraph

这个流程完全可以用普通函数写，也可以用 `asyncio.gather` 并发跑 A/B。更省事，代码也更短。

但我最后还是用了 LangGraph。原因不是为了显得“Agent 化”，而是流程一旦分成 rewrite、retrieve、A answer、B report，状态传递会越来越乱。用 graph state 之后，每个节点消费什么、产出什么都更清楚。

另一个原因是 LangSmith。这个 demo 后面要讲给别人看，trace 里能看到每一步输入输出，比口头解释“我们中间有检索”有说服力得多。

## 共享一次 rewrite 和 retrieval

`/v1/dual` 里 A 线和 B 线没有各查一遍。它们共享一次 query rewrite 和一次 retrieval。

这样做有两个好处。第一，少一次外部调用，速度和成本都更可控。第二，A/B 基于同一份 `recall_bundle`，后面比较输出时不会被“召回内容不同”干扰。

流程大概是：

1. 读用户输入和最近会话；
2. 改写查询；
3. 按当前检索模式召回；
4. A 线生成短回复；
5. B 线生成结构化报告；
6. 一起返回。

## route 不要变成垃圾桶

这一轮我特别克制 route 层。Route 只接请求、调用 graph、返回响应。Graph 管流程，adapter 管模型和检索。

这个边界看起来普通，但很容易被破坏。只要图省事把 prompt、检索、日志、返回格式都塞进 route，后面任何改动都会牵一大片。

## Trace 不是装上就好

LangSmith 接上以后也踩了点小坑：有些节点一开始没有按预期出现在 trace 里，主要是 wrapper 位置、异步调用和 run name 没处理好。

这让我意识到，可观测性不是“引入 SDK”就完事。你得认真命名每个节点，让 trace 真能对应到代码里的流程边界。否则出了问题，trace 也只是一张漂亮但没法用的图。

M4 的价值不在于模型回答变聪明，而在于整个链路终于能被看见：改写、检索、A 线、B 线各自在哪里，输入输出是什么，问题该从哪一段开始查。
