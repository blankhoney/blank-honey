---
title: LATS：把推理、行动和搜索放进同一棵树
slug: paper-2026-01-21-lats-search-agent
description: 读 Language Agent Tree Search 的一点笔记：它把 ReAct 的单轨迹行动，扩展成带环境反馈的树搜索。
date: 2026-01-21
category: papers
tags:
  - AI
  - Agent
  - Paper Notes
draft: false
places: []
---

## ReAct 的下一步

ReAct 让模型一边推理一边行动，但它大多数时候还是沿着一条轨迹走。走错了，可以靠 observation 修正；但它不会系统性地比较同一状态下多个后续选择。

LATS 想补这个缺口。它把 reasoning、acting、planning 放到同一个树搜索框架里，用 MCTS 的思想让模型在多个可能轨迹之间探索。

我读这篇时的感觉是：它像 ToT 和 ReAct 的结合版，只不过树里的节点不只有 thought，也可以包含外部 action 和 observation。

## 它怎么工作

LATS 的流程可以概括成几个阶段：

- Selection：从当前树里选一个值得扩展的节点；
- Expansion：采样多个 thoughts 或 actions，生成子节点；
- Evaluation：用模型打分和 self-consistency 评估状态；
- Simulation：继续推进候选轨迹；
- Backpropagation：把结果回传到树上；
- Reflection：失败轨迹生成反思，写进后续上下文。

和 ToT 的关键区别是，LATS 可以接外部环境反馈。模型不是只在内部想，还会执行 action，拿到 observation，再评估这个状态有没有前途。

## 为什么要用 MCTS

MCTS 的意义在于平衡探索和利用。已经看起来很好的路径会被继续探索，但访问次数少的路径也有机会被试。

这对 Agent 很重要。真实环境里，第一眼看起来最合理的 action 可能不是最优，尤其是在交互任务中。单轨迹 ReAct 很容易被早期选择锁死，LATS 至少提供了回退和替代路径。

源笔记里有个点我觉得很有用：LATS 一次 `k` 更像一次完整 rollout/trajectory，而不是一个节点数量。它是在预算内试几条轨迹，而不是无限扩树。

## Reflection 的位置

LATS 里的反思不是最后写一段总结给人看，而是失败轨迹的一部分。失败后，模型生成 verbal self-reflection，指出哪里错了，下一轮搜索可以把这些反思作为上下文。

这和 Reflexion 的思想相通，但 LATS 把它放进树搜索里。反思不是单条轨迹的自我安慰，而是后续探索的记忆材料。

## 适用边界

LATS 很强，但不轻。它比 ReAct、普通 CoT、甚至很多 ToT 变体都更贵。因为它要多次采样、执行、评估、回传。

另外它默认很多任务可以回退到 earlier states。语言推理可以回退，游戏模拟可以回退，但真实世界工具调用不一定可以。比如发邮件、下订单、删除数据，这些 action 有副作用，不能随便放到树里试。

所以工程上要把“可模拟动作”和“真实副作用动作”严格分开。搜索阶段只允许安全模拟或只读工具，确认后再执行副作用。

## 小结

LATS 给我的启发是：Agent 的 planning 不一定只靠 prompt，也可以靠搜索算法。

如果 ReAct 是一条可观察轨迹，LATS 就是一棵可比较、可回传、可反思的轨迹树。它不适合所有场景，但对高价值、可模拟、需要多步决策的问题很有参考意义。
