---
title: Adapters 薄层：把 LLM 和检索从编排里拆出去
slug: medi-ac-2026-03-05-adapters-layer
description: 没有大重构，只加一层薄 adapter，让编排代码别直接绑死模型和检索实现。
date: 2026-03-05
category: engineering
tags:
  - AI
  - RAG
  - LangGraph
  - Engineering Log
draft: false
places: []
---

## 不是为了架构好看

做完检索热切换后，代码开始有一点危险信号：LangGraph 节点里既要知道怎么调模型，又要知道怎么调检索，还要读配置。

短期能跑，长期会很难测。尤其是这个 demo 后面还要切云端模型、本地模型、hybrid、GraphRAG。如果每个节点都直接碰外部依赖，改一次就要到处找。

所以 M3 后面我加了两个很薄的 adapter：`backend/adapters/llm.py` 和 `backend/adapters/retrieve.py`。

## LLM adapter 只管调用

LLM adapter 不负责写 prompt，也不负责决定问诊流程。它只做一件事：按配置调用模型，把文本结果交回去。

prompt 继续放在业务语义附近。这样做是为了避免 adapter 变成新的“万能层”。很多项目抽象到最后，最难懂的不是业务代码，而是那个看似优雅、其实什么都管的中间层。

这里我只想让 LangGraph 节点不用关心 API key、模型名、base URL 这些东西。

## Retrieval adapter 统一返回结构

Retrieval adapter 接收 query 和 mode，返回统一的 `recall_bundle`。不管底层走的是 hybrid 还是 GraphRAG，上层拿到的结构都一样。

这个边界对测试特别有用。单测可以 monkeypatch adapter，塞一份固定召回结果进去，然后只验证编排逻辑。否则每个测试都要拖着 Qdrant、Neo4j 或真实 embedding 跑，速度慢，也不稳定。

## 没有做 provider 框架

我当时也想过要不要做一套 provider interface：OpenAI、Qwen、Ollama、不同 embedding、不同检索后端都挂进去。

最后没做。原因很简单：项目还没复杂到那个程度。现在的问题不是“缺一个通用框架”，而是“编排层已经开始直接依赖外部服务”。薄 adapter 能解决当前问题，就先停在这里。

这一层的标准是：越薄越好，能测就行。

## 一个小收获

`test_retrieve_structure.py` 和 judge 相关测试都因为这层变简单了。测试不用真的访问模型，也不用把检索服务全拉起来。只要 adapter 的返回结构稳定，上层逻辑就能单独验证。

这类改动不显眼，但很实用。它不会让 demo 看起来更酷，却会让后面每次改 prompt、改模型、改检索模式时少一点心虚。
