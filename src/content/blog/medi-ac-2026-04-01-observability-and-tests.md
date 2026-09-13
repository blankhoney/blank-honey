---
title: LangSmith、pytest 与可交付的演示项目
slug: medi-ac-2026-04-01-observability-and-tests
description: 把 demo 从“看起来能讲”推进到“别人能跑、能查、能验收”。
date: 2026-04-01
category: engineering
tags:
  - AI
  - LangGraph
  - Medical Demo
  - Engineering Log
draft: false
places: []
---

## 这周没加新能力

M6 我没有继续堆功能，而是补 trace、测试和文档。

原因很现实：前面 `/v1/dual` 已经能演示了，但“能演示”和“能交付”差得很远。如果别人问你“它为什么这样答”“召回了什么”“怎么在我机器上跑”，你只能现场解释，那项目还是停在 PPT 阶段。

## LangSmith 是给排错用的

LangSmith 接进来以后，我主要看几个节点：rewrite、retrieve、A 线、B 线、judge。

它能回答一些很具体的问题：

- 用户原话被改写成了什么；
- 检索到底召回了哪些 chunk；
- A 线为什么继续追问；
- B 线用了哪些证据；
- judge 有没有触发追加检索。

没有 trace 时，很多问题只能靠日志猜。尤其是模型输出不对时，人很容易第一反应怪 prompt。trace 至少能逼你先看召回内容是不是已经错了。

## 测试不碰医学正确性

pytest 这一轮测的是工程边界，不是医学判断。

我关心的是：`recall_bundle` 结构稳不稳，judge loop 会不会停，API 返回是不是前端能消费，prompt 输入输出有没有基本形状。

这类测试很土，但很有用。后面改模型、改检索、改 prompt，只要主链路被破坏，测试能早点叫出来。

## 文档也是交付物

这一轮还补了 `DEMO_CHECKLIST`、`INTERVIEW` 和 README 里的启动说明。

`DEMO_CHECKLIST` 是给演示前用的，防止现场才发现容器没起、key 没配、health 不通。`INTERVIEW` 更像项目复盘，帮我把技术选型和取舍讲清楚。

我还做了一件笨事：把项目 clone 到新目录，按 README 从头跑。这个动作很容易暴露假文档。只要某个 env 没写、命令顺序不对、Docker build 太慢，新目录都会马上告诉你。

## smoke eval 只当冒烟

`eval_smoke.py` 不是严格评测，也不证明医疗效果。它只是跑几组典型输入，看链路有没有明显坏掉：A 线是否还会追问，B 线是否还有结构和引用，输出有没有离谱。

M6 的收获是把 demo 从“我电脑上能跑”推进到“别人有机会跑起来，还能知道哪里坏”。这一步不炫，但很必要。
