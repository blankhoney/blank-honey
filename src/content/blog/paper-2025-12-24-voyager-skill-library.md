---
title: Voyager：开放世界里的技能库和自我修正
slug: paper-2025-12-24-voyager-skill-library
description: 读 Voyager 的一点笔记：它不只是 Minecraft Agent，而是把探索、环境反馈和可复用代码技能连成闭环。
date: 2025-12-24
category: papers
tags:
  - AI
  - Agent
  - Memory
  - Paper Notes
draft: false
places: []
---

## 为什么 Voyager 值得看

Voyager 经常被说成“GPT-4 玩 Minecraft”。但我读这篇时更在意它怎么持续变强。

它不是训练一个神经网络，也不微调模型。它通过 GPT-4 生成代码，在环境中执行，根据反馈修正，再把成功技能保存到 skill library。也就是说，它学到的东西不是参数，而是可执行代码。

这和前面读到的记忆系统很像：经验要被保存，还要能在未来任务中检索和复用。

## 三个核心组件

Voyager 有三个组件：

1. automatic curriculum；
2. skill library；
3. iterative prompting mechanism。

Automatic curriculum 负责提出下一个任务。它根据当前状态、已完成任务、失败任务和额外上下文，让智能体不断探索新东西。这个设计很重要，因为开放世界没有固定任务列表。如果没有课程机制，Agent 很容易卡在重复行为里。

Skill library 把成功技能保存成可执行代码。新任务来了，再根据任务描述检索相关技能。虽然论文里的检索方式现在看有点老，但“把技能变成可检索程序”这个思想非常有生命力。

Iterative prompting 则把环境反馈、执行错误、自我验证都放进代码改进循环。程序执行失败后，模型不是重新随便写，而是根据错误和 critic 反馈继续修。

## 成功来自闭环，不是一次生成

Voyager 最值得学的是闭环。

它每轮大概是：课程生成任务，检索技能，生成程序，环境执行，拿到反馈和错误，self-verification 判断是否完成，失败就修正，成功就入库。

这比“一次 prompt 让模型生成动作”可靠得多。代码技能能被复用，错误能被定位，成功经验能沉淀。

这也是为什么它在 Minecraft 里比 ReAct、Reflexion、AutoGPT 这类 baseline 更能持续探索。不是模型每次都更聪明，而是系统把每次成功变成下一次的基础。

## 局限也很现实

Voyager 很贵。它依赖 GPT-4 的代码生成质量，GPT-3.5 当时差很多。

它也会幻觉。Automatic curriculum 可能提出 Minecraft 不存在的任务，比如制作不存在的物品；代码生成也可能调用不存在的 API，或者把物品用途搞错。

self-verification 也不总可靠。它可能没识别出任务已经完成，或者把失败当成功。这说明闭环里的每个反馈源都需要质量控制。

## 和真实产品的关系

如果把 Voyager 的思想放到一般 Agent 产品里，我会把 skill library 看成“可复用动作库”。比如浏览器自动化、代码修复、数据清洗、部署检查，都可以沉淀成可调用技能。

但前提是要有测试、日志、失败记录和版本管理。否则技能库会变成一堆过时脚本，检索出来反而误导 Agent。

## 小结

Voyager 的价值不是证明 LLM 会玩游戏，而是展示了一种学习形式：把环境反馈转成代码技能，把成功经验保存下来，再让后续任务复用。

这条线和长期记忆、经验抽象、Heuristic Learning 都有关系。区别只是 Voyager 的记忆形态更偏程序：能执行、能测试、能迭代。
