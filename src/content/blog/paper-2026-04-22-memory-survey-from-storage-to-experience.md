---
title: 从 Storage 到 Experience：Agent Memory 的演化路线
slug: paper-2026-04-22-memory-survey-from-storage-to-experience
description: 读 2026 Agent Memory Survey 的一点笔记：记忆系统的目标正在从保存轨迹，走向抽象可迁移经验。
date: 2026-04-22
category: papers
tags:
  - AI
  - Agent
  - Memory
  - Paper Notes
draft: false
places: []
---

## 这篇综述更像阶段划分

前面那篇 2024 记忆综述主要帮我建立“什么是 Agent memory”的分类框架。这篇 2026 的 _From Storage to Experience_ 更像是在讲演化路线。

它把记忆机制分成三个阶段：Storage、Reflection、Experience。

这个划分我觉得很有用，因为它提醒我们：记忆系统不是存得越多越好，而是信息密度和抽象能力不断提高。

## Storage：先保存轨迹

Storage 阶段的目标是保存历史交互。线性存储、向量存储、结构化存储都属于这个范畴。

它解决的是上下文窗口不够的问题。聊天历史、观察-动作轨迹、工具调用结果，都可以被放到外部存储里。

但 Storage 的问题也很明显：它保存了很多东西，却不一定知道哪些东西有用。原始轨迹里有幻觉、错误、重复、无效尝试。只存不管，记忆库会越来越脏。

## Reflection：从记录到批判

Reflection 阶段开始对轨迹做质量处理。它不只是保存，而是纠错、压缩、总结、反思。

论文把反思分成内省式、环境式和协同式。内省式依靠模型自己批判；环境式依靠真实反馈校准；协同式让多个 Agent 或角色共同评估。

我觉得这一步是很多实际系统缺的。很多 Agent 记录了失败日志，但没有把失败转成可复用的经验。Reflection 的意义就是把噪音密集的历史轨迹变成更高质量的记忆单元。

## Experience：跨轨迹抽象

Experience 是这篇论文最想强调的阶段。

它不再只修正单条轨迹，而是从多条相似轨迹中抽象出可迁移的策略、规则或技能。论文里提到显式经验、隐式经验和混合经验。

显式经验可以是自然语言策略、可执行函数、技能库。隐式经验则可能通过 fine-tuning、RL 或其他方式压缩进模型参数。混合经验则是在显式缓存和参数内化之间循环。

这让我想到 Voyager 的 skill library、ADAS/AFlow 的 archive 和 experience backpropagation，以及 Heuristic Learning 里的测试、日志、规则压缩。它们都在做一件事：把局部失败和成功变成未来可用的经验。

## 为什么 Experience 重要

如果记忆只停留在 Storage，Agent 每次还是要从大量历史里检索，然后重新推理。Reflection 能提高质量，但仍可能是碎片化的。

Experience 的目标是让 Agent 获得类似“直觉”的东西：遇到新场景时，不只是找历史片段，而是调用从历史中抽象出的策略先验。

这对长期运行 Agent 很关键。否则它会一直停留在“记得很多，但不会成长”的状态。

## 小结

这篇综述给我的最大收获，是把记忆从存储问题提升到学习问题。

Agent memory 的路线可能是：先能保存，再能反思，再能抽象经验。真正难的是第三步，因为它要求系统跨轨迹归纳，并且知道哪些经验可以迁移、哪些只是偶然有效。
