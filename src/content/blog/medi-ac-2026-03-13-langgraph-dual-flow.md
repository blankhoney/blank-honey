---
title: MediAC 双轨：A 已经写完，接口还在等 B
slug: medi-ac-2026-03-13-langgraph-dual-flow
description: 共享召回之后同时生成追问与报告，等待发生在 gather。
date: 2026-03-13
category: engineering
tags:
  - MediAC
draft: false
places: []
---

两条线同时跑，即使 A 先写完，接口也仍要等 B。原因并不复杂：`/v1/dual` 要一起交回追问和报告，所以仍得等 B 线。前面做的并行有用，但用户拿到第一句话的时间，还是被较慢的分支拖着。

这一阶段先把同步双轨接清楚。输入经过一次 rewrite，再召回成 `recall_bundle`，A/B 共用这批初始资料。A 生成追问，B 生成报告并检查是否继续检索，两份结果在末尾汇合。

![MediAC 同步双轨的共享召回与汇合等待](/content-diagrams/medi-dual-sync.svg)

按同步接口绘制的示意图，分支长度不代表实测耗时。右侧汇合点仍等待两条线都完成。

九月整理 `backend/dual_graph.py` 时，图实际只有 `rewrite_once`、`shared_retrieve` 和 `run_tracks` 三个节点。A/B 的并发放在最后一个节点内部：

```python
consult_task = asyncio.create_task(self.run_consult(state))
report_task = asyncio.create_task(self.run_report(state))
consult_text, report = await asyncio.gather(consult_task, report_task)
```

因此 B 的每一轮追加检索并不是独立图节点，它在 `run_report` 函数里循环。画图时可以展开解释内部步骤，读 trace 时却要知道实际节点到哪里为止，不然容易找一个代码里根本没有命名的节点。

共享召回省了一次初始检索，也便于比较两边用了什么材料。rewrite 只负责把问题整理成适合检索的短句；当前图的这个节点读取 query，不能把后来聊天路径携带的完整历史也算进来。生成节点要利用历史，还得显式传入相应 state。

我选 [LangGraph](https://docs.langchain.com/oss/python/langgraph/graph-api) 是想把这几个读写位置固定下来：rewrite 写出新 query，retrieve 写证据，run_tracks 写两个结果。Route 只处理请求和返回，外部调用放 adapter。同步调用本来用普通函数也能组织，图的用途在于后面可以沿节点检查数据。

要让 A 先到页面，下一步得改变接口的交付方式。只把 `gather` 前面的两个调用并发起来，做不到这件事。同步 `/v1/dual` 先保留给完整流程演示，聊天和报告分别返回的版本另做。
