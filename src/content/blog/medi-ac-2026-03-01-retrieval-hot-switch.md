---
title: Hybrid / GraphRAG 热切换：一次只跑一条检索链
slug: medi-ac-2026-03-01-retrieval-hot-switch
description: 一次关于检索复杂度的取舍：先热切换 hybrid / GraphRAG，而不是急着融合。
date: 2026-03-01
category: engineering
tags:
  - AI
  - RAG
  - Medical Demo
  - Engineering Log
draft: false
places: []
---

## 两套检索都想要，但不能全塞进去

M3 开始做检索接口时，我面前有两个选择。

一个是每次请求都跑 hybrid 和 GraphRAG，再把结果融合起来。听起来更“完整”，也更像很多 RAG 方案会写在架构图里的样子。

另一个是简单一点：同一套接口，`RETRIEVAL_MODE` 控制这次到底走 `hybrid` 还是 `graphrag`。

我最后选了后者。

## 先别急着融合

原因不是融合没价值，而是这个阶段融合会让问题变脏。

hybrid 走 Qdrant + BM25，适合普通 Markdown 资料；GraphRAG 走 Neo4j，想展示实体关系和图路径。它们本来就是两种不同思路。如果一开始就混在一起，输出变好或变坏都说不清楚。

还有延迟问题。A 线问诊要短、要快，用户还在补信息时，不应该每轮都拖着两套检索跑一遍。B 线报告可以重一些，但也需要知道重在哪里。

融合还有一堆工程细节：去重、分数归一化、来源权重、失败降级。每一项都能写，但每一项都会让 demo 提前变复杂。

## `retrieve(q, mode)` 先把边界收住

最后我把检索层收成一个入口：

```text
retrieve(q, mode)
```

调用方只知道问题和模式，不关心底层是 Qdrant、BM25 还是 Neo4j。这样 LangGraph 后面拿到的始终是同一种结构。

模式通过 `RETRIEVAL_MODE=hybrid` 或 `RETRIEVAL_MODE=graphrag` 切。调试时不用改代码，demo 时也能快速切换同一个问题看差别。

## 统一成 `recall_bundle`

这一轮最值得保留的设计其实不是 hot switch，而是 `recall_bundle`。

它把召回片段、来源、后续生成需要的上下文都包在一起。生成层不需要知道这段内容来自 BM25 还是图数据库，只需要知道：有哪些证据、能不能引用、文本长什么样。

这个结构让排错顺序清楚了很多：先看 `recall_bundle` 召回得对不对，再看 prompt 和生成。如果没有这层，很多问题会直接变成“模型怎么又乱答了”。

M3 的结论很普通：先让两条检索链各自可用，再考虑融合。demo 不是论文系统，越早能清楚比较，越早知道下一步该改哪里。
