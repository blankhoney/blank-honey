---
title: 踩坑实录：从能跑到适合教学
slug: medi-ac-2026-04-28-bugs-and-teaching-ready
description: 最后收尾时修掉两个很影响演示的小 bug，并把项目整理到可教学状态。
date: 2026-04-28
category: engineering
tags:
  - AI
  - LangGraph
  - Medical Demo
  - Engineering Log
draft: false
places: []
---

## “能跑”和“能教”之间还差几脚泥

4 月底这个 demo 已经有多轮、流式、异步报告和 trace，看起来差不多可以收尾了。结果最后还是被几个小问题卡了一下。

这些问题都不大，但很影响演示。教学项目最怕的不是功能少，而是别人一打开就看到重复消息、trace 缺口、文档对不上。

## 流式回复重复了一次

第一个 bug 出在前端。

A 线流式返回时，页面里有一个临时 streaming bubble。流结束后，后端消息又被提交到正式消息列表。结果用户看到同一段回复先流出来一次，结束后又出现一次。

问题不复杂，但观感很差。像是系统说话结巴了一下。

修法是把临时状态和正式消息分清楚：流式中只显示临时 bubble；完成并提交 assistant message 后，清掉临时状态。这样页面上只留一份最终消息。

## chat/stream 路径没有完整 trace

第二个问题更隐蔽。LangSmith 一开始主要覆盖 `/v1/dual`，但 v1.1/v1.2 后主要体验已经转到 chat 和 stream。

也就是说，用户最常走的新路径，排查时反而看不到完整 trace。这会让可观测性变成摆设。

最后是在 chat / stream 路径上补 `langsmith.trace()`，并把 run name 命好。入口一多，命名就很重要，否则 LangSmith 里看起来全是一团“LLM call”。

## 90 分钟教学线

收尾时我把讲解顺序也整理了一遍：

1. 为什么不是一个大 Chatbot；
2. 四容器怎么启动；
3. ingest 怎么进入 Qdrant 和 Neo4j；
4. hybrid / GraphRAG 怎么热切换；
5. LangGraph 怎么串 A/B；
6. judge loop 怎么给 B 线补证据；
7. 多轮、SSE、异步报告怎么一步步演进；
8. trace 和测试怎么定位问题。

这个顺序基本就是项目真实走过的路。比起硬讲最终架构，我更愿意按“为什么下一步必须出现”来讲。

## 最后只证明一件事

收尾检查跑了 pytest、前端 build、Docker health、多轮聊天、异步报告和 trace。它们不证明这个系统能用于真实医疗，也不应该这么宣传。

它只证明一件事：作为教学 demo，核心链路能跑，出了问题有地方看，技术选型有来路。

这比“看起来很 AI”重要得多。一个能讲清楚失败和取舍的 demo，比一份完美但空泛的介绍更可信。
