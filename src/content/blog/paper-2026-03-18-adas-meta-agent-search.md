---
title: ADAS：让一个 Agent 去设计更好的 Agent
slug: paper-2026-03-18-adas-meta-agent-search
description: 读 Automated Design of Agentic Systems 的一点笔记：它把 agentic system 定义成代码，再让 meta-agent 搜索更好的设计。
date: 2026-03-18
category: papers
tags:
  - AI
  - Agent
  - Paper Notes
draft: false
places: []
---

## 这个问题很有野心

ADAS 问的是：能不能自动化设计 agentic system？

过去很多 Agent 都是人工搭出来的：CoT、Self-Refine、ReAct、多 critic、ensemble、memory，各种模块靠人组合。ADAS 的想法是，把 Agent 定义成代码，让一个 meta-agent 不断写新 Agent、评估、保存，再基于历史发现继续生成更好的 Agent。

这听起来很像 AutoML 进入 Agent 时代。

## 三个核心要素

论文把 ADAS 拆成三件事：

- search space；
- search algorithm；
- evaluation function。

搜索空间决定什么样的 agentic system 能被表示。作者选择代码作为表示方式，因为代码可读、可复用，也更容易利用已有工程生态。

搜索算法决定怎么探索。本文的 Meta Agent Search 会维护一个 archive，里面保存历史发现的 Agent。meta-agent 基于 archive 生成新设计，写成代码，自反思检查，再在验证集上评估。

评价函数则决定什么叫“更好”。可以优化准确率、成本、延迟、安全等指标。这里其实是整个系统的核心。

## Archive 的意义

我觉得 ADAS 里最有意思的是 archive。它不是每轮只看当前最优解，而是保留历史设计作为 stepping stones。

这让搜索更像开放式探索，而不是单纯局部优化。一个早期看起来一般的设计，后面可能和别的模块组合出更强结构。

论文里发现的一些模式，比如多 CoT 候选、refinement、多维度 critic、ensemble，都是多个 stepping stones 逐步组合出来的。

## 最大瓶颈是评价函数

源笔记里最后强调得很好：ADAS 的强弱很大程度上取决于 evaluation function。

如果评价函数只看验证集 accuracy，系统就可能过拟合验证集。如果不包含成本、延迟、安全，搜出来的 Agent 可能很慢、很贵，甚至有副作用。如果用 LLM judge，又会引入 judge bias。

所以我不太会把 ADAS 理解成“让模型自动发明 Agent，万事大吉”。更现实的说法是：在一个人类设计好的搜索空间和评价函数里，让模型加速探索。

## 安全问题不能跳过

ADAS 让模型生成代码并执行，这本身就有风险。论文里提到容器化执行、人工检查、代码风险提示等安全措施。

如果放到真实系统里，还要更严格：沙箱、权限隔离、网络限制、资源限制、审计、回滚。尤其是当 meta-agent 能改自己的设计时，边界一定要清楚。

## 小结

ADAS 给我的启发是：Agent 设计可能会从手工 pattern collection，走向自动化搜索。

但它不是完全自动。搜索空间、初始模块、评价函数、安全沙箱，仍然是人类要设计好的部分。真正值得关注的，是怎么让自动搜索产出的东西既有效、又便宜、又可解释、又安全。
