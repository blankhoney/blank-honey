---
title: 数据先于 API：两条 Ingest 脚本的取舍
slug: medi-ac-2026-02-23-ingest-pipeline
description: 先把数据喂进去，再谈 RAG：图谱、向量和 BM25 的第一版导入脚本。
date: 2026-02-23
category: engineering
tags:
  - AI
  - RAG
  - Medical Demo
  - Engineering Log
draft: false
places: []
---

## RAG 不能只写一个检索接口

M2 的任务是 ingest。这个阶段看起来不如 Agent 编排有意思，但它决定了后面的检索到底有没有底。

我之前很想直接写 `/retrieve`，因为那样更快看到效果。后来还是忍住了。这个 demo 同时要对比 hybrid 和 GraphRAG，如果数据入口不固定，后面每次召回不稳定都不知道该怪谁：chunk 切坏了？embedding 维度不对？Neo4j 没写进去？还是检索逻辑本身有问题？

所以先把数据喂进去。

## 两条脚本，各管一类数据

图谱侧走 `ingest_graph.py` 和 `export_youtu_graph.py`。这部分不追求完整医学知识图谱，先把节点、关系、写入 Neo4j 的路径跑通。GraphRAG 需要一个能查的图，而不是一份停在文档里的设计。

文本侧走 `ingest_hybrid.py`。它读取 `data/hybrid_sources/*.md`，按 `##` 拆 chunk，生成 embedding 写进 Qdrant，同时把 BM25 需要的数据落到 jsonl。

这里我刻意让向量和 BM25 共用同一批 chunk。后面如果召回不准，至少可以先排除“两个索引用的文本块不一样”这种干扰。

## 没有上 Elasticsearch

BM25 当然可以用 Elasticsearch 或 OpenSearch。问题是这个 demo 已经有 Postgres、Qdrant、Neo4j、API，再加一个搜索服务，启动门槛会明显变高。

第一版我只需要一个 baseline：能按关键词召回，能和向量结果对比，能在本地快速重建。Python 本地索引够用了。它不是最强，但很适合这个阶段。

## host-run 带来的小麻烦

导入脚本一开始是在宿主机上跑的。好处是改脚本、看文件、重跑都方便；坏处是 URL 很容易乱。

容器里访问 Qdrant 可能用服务名，宿主机上访问又是 `localhost`。这个问题不复杂，但特别容易浪费时间。后来我把配置写得更直白：脚本在哪跑，就用哪一套地址，不靠猜。

还有一个坑是 embedding 维度。只要换模型，Qdrant collection 里的旧向量就可能不兼容。这里我没有做精细迁移，直接在切换 embedding 时清 collection。demo 阶段粗一点没关系，关键是不要把脏数据混进去。

M2 做完以后，项目才真正有了可复现的检索地基：Markdown 能进 Qdrant 和 BM25，图数据能进 Neo4j。后面检索效果好不好，终于有地方查了。
