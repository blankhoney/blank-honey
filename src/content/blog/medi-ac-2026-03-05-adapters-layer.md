---
title: MediAC 的模型返回了 not-json，测试该看哪里
slug: medi-ac-2026-03-05-adapters-layer
description: 两个薄 adapter 的用途，从 judge 的解析和回退说起。
date: 2026-03-05
category: engineering
tags:
  - MediAC
draft: false
places: []
---

只想检查 judge 返回坏格式时怎么办，是否也要先启动 Qdrant、Neo4j，再连一次模型？节点里混着外部调用时，这种小检查也会变得很长。所以先把调用收在 `backend/adapters/llm.py` 和 `backend/adapters/retrieve.py` 两个入口。

LLM adapter 负责模型地址、key、角色对应的模型名和请求。追问与报告的 prompt 还留在各自节点旁边：改一句追问，应该能直接看到这句在什么流程里使用。检索 adapter 则接 query 和 mode，返回统一字段。暂时只拆这些，不为还没接入的 provider 设计整套接口。

九月整理测试时，`test_llm_judge.py` 提供了一个很适合讲解的例子。先用测试替身让 `chat` 返回合法 JSON，再让它返回 `not-json`，两次都不调用真实模型。

```python
async def fake_chat_bad(**kwargs):
    return "not-json"
```

`judge_json` 解析失败后返回 `sufficient=False`，reason 以 `judge_invalid_json` 开头。测试检查这两个结果，就能知道坏格式没有被当作“材料充分”。这里的 False 记录的是解析失败，不能解读成模型认真判断过证据不足。

这种测试只覆盖解析与回退。后面是否追加检索、达到上限是否停止，还需要另外检查 B 线控制逻辑；这个文件没有替它们全部测完。我觉得把范围说清楚挺有必要，不然看见名字叫 judge 测试，很容易以为连整条循环都验证了。

有了两个入口，先用固定输入看程序反应，再接真实服务检查内容，就可以分别做。模型没返回 JSON 时先看解析路径，检索片段不相关时再查数据和检索；不用每次都等一整套服务，才知道出错的其实只是一个字段。
