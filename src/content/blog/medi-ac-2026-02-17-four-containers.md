---
title: 四容器 Compose：先把演示底座跑通
slug: medi-ac-2026-02-17-four-containers
description: 把 FastAPI、Postgres、Qdrant、Neo4j 先跑起来：这个 demo 的第一块地基。
date: 2026-02-17
category: engineering
tags:
  - AI
  - RAG
  - Medical Demo
  - Engineering Log
draft: false
places: []
---

## 第一阶段没有写功能

M1 我没有先碰 Agent，也没有先做页面。目标只有一个：别人 clone 下来之后，能不能按 README 把服务跑起来。

当时定的最小闭环很粗暴：

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8000/health/ready
```

如果这一步不稳，后面所有 bug 都会变成玄学。你不知道是模型调用的问题、向量库的问题、数据库的问题，还是 API 根本没起来。

## 四个容器先各司其职

Compose 里放了四块：

- `api`：FastAPI + uvicorn，后面所有问诊、检索和报告接口都从这里进；
- `postgres`：放会话和结构化状态；
- `qdrant`：放向量检索数据；
- `neo4j`：给后面的 GraphRAG 对比留位置。

这套组合不轻，但比“先全放内存里，后面再补”更踏实。医疗问诊 demo 的重点是编排和对比，如果底层数据来源一直在变，后面很难判断效果差是哪里造成的。

## health check 要查“能不能用”

一开始我也差点只看容器是不是 running。后来想了一下，这不够。API 进程活着，不代表它连得上 Postgres；Qdrant 在跑，也不代表后端配置读对了。

所以加了 `/health/ready`。它不是为了好看，而是为了把“进程没死”和“系统准备好了”分开。后面调试 ingest 和 retrieve 时，这个 endpoint 省了不少时间：先确认底座，再看业务。

## 配置别藏在代码里

配置用 `pydantic-settings` 读 `.env`，同时维护 `.env.example`。这个选择很朴素，但对 demo 项目很重要。

很多教学项目的问题不是跑不起来，而是你不知道缺哪个变量。把数据库 URL、Qdrant、Neo4j、模型 key、LangSmith 这类东西都摆在示例配置里，至少新环境不会靠猜。

## 真正踩坑的是 Docker 构建

这一阶段最烦的不是 FastAPI，而是构建慢和上下文不干净。Docker 一旦把不该复制的东西也带进去，build 时间会变长，排错也会变脏。

最后是靠 `.dockerignore` 收住构建上下文。这个改动不大，但很关键：demo 要给别人跑，启动体验本身就是交付的一部分。

M1 做完之后，项目还没有“智能”起来，但已经不再是散落的一堆脚本。后面能继续做 ingest、检索和双轨，是因为这块地基先稳住了。
