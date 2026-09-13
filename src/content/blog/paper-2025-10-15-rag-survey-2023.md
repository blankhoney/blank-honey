---
title: RAG Survey：从 Naive RAG 到 Modular RAG
slug: paper-2025-10-15-rag-survey-2023
description: 读 2023 RAG Survey 的一点笔记：RAG 的关键不是“塞资料”，而是索引、检索、组织、生成和评估的系统工程。
date: 2025-10-15
category: papers
tags:
  - AI
  - RAG
  - Paper Notes
draft: false
places: []
---

## RAG 不是一个组件

这篇 RAG Survey 适合拿来整理脑子。很多时候我们说“加 RAG”，听起来像是给模型前面接一个向量库。但这篇综述把 RAG 拆开看：Retrieval、Generation、Augmentation，还有索引、查询优化、重排、压缩、评估。

读完以后我的感觉是：RAG 更像一个系统工程，而不是某个库的功能。

## 三个阶段

论文把 RAG 的演化分成 Naive RAG、Advanced RAG、Modular RAG。

Naive RAG 是最常见的 retrieve-read 流程：文档清洗、切块、embedding 入库；用户问题编码成向量；检索 top-k chunk；把 chunk 塞进 prompt 让模型回答。

Advanced RAG 开始修补这个流程的缺陷。检索前做 query rewriting、query expansion、metadata filter、chunk 优化；检索后做 reranking、context compression、selection。它承认一个事实：召回出来“看似相关”的文本，不一定适合直接塞给模型。

Modular RAG 则进一步把线性流程变成可组合系统。可以有 routing、fusion、memory、predict、task adapter，也可以用迭代检索、递归检索、自适应检索等控制流。

## 索引质量比想象中更重要

很多 RAG 失败不是模型不会答，而是索引一开始就把信息切坏了。

PDF、网页、表格、Markdown、结构化数据，处理方式都不一样。chunk 太细，语义断裂；chunk 太粗，噪音太多；没有元数据，就很难按来源、时间、权限过滤；只靠 dense retrieval，精确术语和编号可能召回差。

这就是为什么生产 RAG 往往不会只用一个 embedding。Hybrid retrieval、metadata、hierarchical index、甚至知识图谱，都是为了补单一路径的短板。

## 生成端也不是简单回答

检索完成后，把所有内容直接塞给 LLM 往往不是好做法。上下文太长会稀释注意力，也会出现 lost in the middle。

所以生成前需要整理证据包：重排、压缩、选择、去重、保留引用。我的理解是，一个好的 RAG prompt 不应该像“资料堆”，而应该像“给模型准备好的审阅材料”。

微调也可以增强生成端，让模型更会用证据、更少编造、格式更稳定。但微调不能替代检索质量。如果证据错了，微调过的模型也只是在更稳定地使用错误证据。

## 评估不能只看最终答案

RAG 的评估难点在于，最终答案错了，不知道错在哪里。可能是检索错、重排错、上下文组织错、模型没遵守证据，也可能是评估标准本身不清楚。

所以论文里提到的评估维度很有用：

- context relevance：上下文是否相关；
- faithfulness：答案是否被上下文支持；
- answer relevance：是否真正回答问题。

工程上还要加延迟、成本、权限、安全、引用展示、失败回退。这些不是论文指标里的装饰项，而是能不能上线的核心。

## RAG 和长上下文

长上下文变强以后，RAG 会不会没用了？我觉得不会。

长上下文扩大了模型一次能看的范围，但不解决数据更新、权限过滤、引用定位、成本控制和证据组织问题。RAG 的价值不是让模型“看更多”，而是让系统“找得准、可追踪、可更新”。

## 小结

这篇综述给我的最大帮助，是把 RAG 从一个 demo 技术拆回系统边界。

真正的 RAG 不只是向量库加 LLM，而是一套从数据接入、索引、查询优化、重排、证据组织、生成、评估到监控的链路。越接近生产，越不能只讨论 embedding 模型。
