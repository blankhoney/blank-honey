---
title: MediAC 启动记录：先看 ready 返回了什么
slug: medi-ac-2026-02-17-four-containers
description: 四个容器启动后，用依赖检查区分服务没起来和应用没有连上。
date: 2026-02-17
category: engineering
tags:
  - MediAC
draft: false
places: []
---

这一阶段先不做页面，把启动步骤走通。项目用 API、Postgres、Qdrant 和 Neo4j 四个容器，后面要比较文本检索和图检索，两套数据服务都先留下。README 里的入口尽量短：

```bash
cp .env.example .env
```

复制后还得编辑模型 key 和连接配置，再启动：

```bash
docker compose up -d --build
curl http://localhost:8000/health/ready
```

`docker compose ps` 里看到 running，我还想再问一步：API 能连上这几个服务吗？端口开始监听和数据库可用并不总是同时发生，地址也可能配错。于是保留一个只检查连通性的 ready 接口，先把问题缩小到连接这一层。

九月整理代码时，`backend/main.py` 里的检查很直白：Postgres 执行 `SELECT 1`，Qdrant 请求 `/collections`，Neo4j 执行 `RETURN 1 as ok`。返回里分别列三项结果；有一项失败，整体状态就是 `degraded`。这些是整理时的实现细节，方便对照接口读代码。

```text
postgres = true
qdrant   = false
neo4j    = true
→ status = degraded
```

这是一个说明用返回状态。遇到这种情况，我会先检查 API 配的 Qdrant 地址和服务响应，不急着换 embedding 模型。连通性恢复以后，才继续查 collection 有没有资料、向量维度对不对。ready 没有调用问答模型，也没有验证资料是否入库，绿色结果只到这里。

配置集中交给 `pydantic-settings`，变量名称列在 `.env.example`。这部分最容易混的是文件在哪儿被读：Compose 会先用变量处理部署配置，API 进程再读取自己的环境。宿主机里的一份 `.env`，不会因为放在目录里就自动成为所有容器的配置。[Pydantic Settings 文档](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)可以对照读取规则，实际路径还要按启动方式看。

项目用 `.dockerignore` 把不用的文件挡在构建上下文外。新环境按启动、请求 ready、导入数据的顺序检查，哪一步没过就停在哪一步查，比等最终问答报错以后再检查四个服务省事。
