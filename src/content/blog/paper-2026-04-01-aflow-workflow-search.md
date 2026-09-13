---
title: AFlow：自动搜索 Agentic Workflow，但不是完全放飞
slug: paper-2026-04-01-aflow-workflow-search
description: 读 AFlow 的一点笔记：它用 MCTS 和执行反馈搜索 workflow，把自动化 Agent 设计收束到可评估的工程空间。
date: 2026-04-01
category: papers
tags:
  - AI
  - Agent
  - Paper Notes
draft: false
places: []
---

## 它接在 ADAS 后面看很合适

AFlow 可以放在 ADAS 后面读。ADAS 提出让 meta-agent 自动设计 agentic systems，AFlow 则更具体地把目标放在 agentic workflow generation 上。

它关心的是：能不能自动搜索一套适合任务的 LLM workflow，而不是人手工搭 prompt、节点和流程。

## Workflow 是什么

论文把 agentic workflow 定义成由 LLM-invoking nodes 和 edges 组成的流程。Node 包含 model、prompt、temperature、output format；edge 定义执行顺序、条件、依赖和循环。

这比单个 prompt 更接近真实应用。很多任务不是一次 LLM 调用能完成的，而是需要分解、生成、评估、修正、聚合。

但 workflow 搜索空间太大，所以 AFlow 不是真的让模型随便生成一切。它用模板、operators、code edges 和 evaluator 把搜索空间收住。

## 搜索循环

AFlow 的搜索过程可以概括成四步：

1. Soft Mixed Probability Selection：从已有 workflow 中选一个父 workflow；
2. LLM-Based Expansion：让 LLM optimizer 修改 prompt 或代码连接；
3. Execution Evaluation：实际执行 workflow，在验证集上评分；
4. Experience Backpropagation：把性能、修改记录、失败经验回传。

这个结构让我觉得比较可靠，因为它不是让 LLM 自己宣称“我改好了”。改完以后要跑验证集，分数说话。

## 人类设计仍然存在

我不喜欢把 AFlow 说成“完全自动化 workflow 发现”。它更准确的描述是：在人类约束好的空间里自动优化。

人类仍然提供 template、operator set、评估函数和任务数据。LLM optimizer 决定每轮改哪里、怎么改。验证集决定是否有效。

这个边界很重要。否则很容易误解成“以后 workflow 不用设计了”。实际是设计工作从手写流程，部分转移到了设计搜索空间和评价函数。

## 成本和迁移

AFlow 有一个现实意义：弱模型通过搜索到更合适的 workflow，可能在成本-性能 Pareto front 上超过强模型的朴素调用。这对部署很有用。

但源笔记里也提到模型迁移问题：用一个模型优化出来的 workflow，换到另一个模型上性能可能下降。因为不同模型的能力、格式稳定性、推理习惯不一样。workflow 不是完全模型无关的。

## 小结

AFlow 给我的启发是：Agent workflow 的自动化不是“让模型自由发挥”，而是“受约束搜索 + 执行反馈 + 经验回传”。

它比手工调 prompt 更系统，也比完全开放的代码生成更可控。未来如果要做可维护的 Agent 平台，我会优先关注这种能评估、能回滚、能记录失败经验的 workflow search，而不是只堆更多 prompt trick。
