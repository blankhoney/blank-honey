---
title: Plan-and-Solve Prompting：先计划，再推理
slug: paper-2025-06-04-plan-and-solve-prompting
description: 读 Plan-and-Solve Prompting 的一点笔记：它不是 Agent 框架，而是把“先想计划”这件事塞回 prompt 里的简单方法。
date: 2025-06-04
category: papers
tags:
  - AI
  - Prompting
  - Paper Notes
draft: false
places: []
---

## 我最开始关心的问题

这篇论文的原题是 _Plan-and-Solve Prompting: Improving Zero-Shot Chain-of-Thought Reasoning by Large Language Models_。

我读它的时候，其实不是想找一个新的 Agent 框架，而是想搞清楚一件很小但很常见的事：为什么有时候一句 `Let's think step by step.` 能让模型变好，但又经常好得不稳定。

读完以后我的感觉是，Plan-and-Solve 解决的不是“模型不会推理”，而是更具体的问题：模型经常一上来就开始算，算着算着漏步骤，最后答案看起来有推理过程，但中间其实断过。

## CoT 的几个毛病

论文里把 Zero-shot-CoT 的错误大致拆成三类：

1. 计算错误；
2. 步骤缺失错误；
3. 语义误解错误。

这个分类对我挺有用。以前看到模型答错，我容易一句话概括成“模型推理不行”，但这三类错其实对应的修法不一样。

计算错误有时候可以交给工具，比如让模型写代码、调用计算器，或者把数值计算交给外部程序。步骤缺失更像是生成轨迹的问题，模型不是完全不知道怎么做，而是没把中间某一步写出来。语义误解就更麻烦，题都理解错了，后面计划再完整也没用。

Plan-and-Solve 主要瞄准的是第二类：missing-step errors。PS+ 又在 PS 的基础上进一步要求抽取变量、计算中间变量、注意数值和常识，所以它也会顺手缓解一部分 calculation errors。

## PS 到底改了什么

它的操作很朴素。

Zero-shot-CoT 常用的是：

> Let's think step by step.

Plan-and-Solve 换成类似这样的指令：

> 先理解问题并制定计划，然后按计划逐步解决问题。

PS+ 再多加一些要求：

> 抽取相关变量及其数值，计算中间变量，注意数值计算和常识。

这件事看起来很轻，但我觉得它抓住了自回归模型的一个特点：模型不是先在脑子里完整想完再输出，它是一边生成一边继续往下走。开头给它一个“先列计划”的轨道，后面的 token 分布就会不一样。

换句话说，PS 不是让模型突然变聪明，而是把模型导向一种更像解题模板的生成路径。它减少了“还没想清楚就直接开算”的概率。

## 它不是 Agent Framework

这里很容易误会。Plan-and-Solve 不是 Agent framework。

它没有多轮环境交互，没有工具调用循环，没有 memory，也没有状态转移。很多时候它就是一轮 prompt，一轮回答。

如果硬要放在 Agent 系统里，我会把它看成某个节点里的 prompt 技巧。比如一个 Agent 在真正调用工具前，先要求模型生成一个短计划；或者在复杂任务里，把“读题、拆变量、列步骤”作为一个单独的 reasoning stage。

但它本身不是 ReAct，也不是 Reflexion。它更像是把“别急，先规划”这句话写进 prompt 里。

## 论文实验给我的感觉

论文在几类任务上做了评测：数学推理、常识推理、符号推理。

数学类包括 GSM8K、SVAMP、MultiArith、AddSub、AQuA、SingleEq；常识类包括 CommonsenseQA、StrategyQA；符号类包括 Last Letter Concatenation 和 Coin Flip。

结果大体上是 Zero-shot-PS 比 Zero-shot-CoT 更稳，甚至在一些数据集上超过人工 few-shot CoT。

我不会把这个结论理解成“以后都用 PS 就行”。更合理的理解是：很多任务里，模型不是缺少知识，而是缺少一个稳定的输出结构。结构给对了，错误会少一截。

## PoT 和 Self-Consistency

读这篇的时候，我也顺手把它和 PoT、Self-Consistency 放在一起看。

PoT，也就是 Program-of-Thought Prompting，是让模型读题后生成程序，再运行程序，用程序执行结果作为答案。它对计算类任务很有吸引力，因为真正容易出错的数值部分交给程序跑，不再靠模型自己心算。

Self-Consistency 则是另一种思路：让模型生成多条推理路径，然后投票。它不是强迫模型一次生成得更好，而是用多样采样降低随机性。

这三者各自解决的问题不太一样：

- PS 让单条推理路径更完整；
- PoT 把计算交给可执行程序；
- Self-Consistency 用多条路径投票降低偶然错误。

工程里如果真要用，我会先看任务瓶颈在哪里。如果是漏步骤，PS 很便宜；如果是算错数，PoT 或工具更靠谱；如果模型回答波动大，Self-Consistency 更直接。

## 局限

作者也承认两个限制。

第一，prompt 表达很敏感。换句话说，这不是一个完全稳固的算法，它还是 prompt engineering。

第二，PS/PS+ 可以缓解 calculation errors 和 missing-reasoning-step errors，但 semantic misunderstanding errors 仍然存在。题意理解错了，计划写得再漂亮也救不回来。

我自己的结论是：Plan-and-Solve 值得记，但不要神化。它最有价值的地方是提醒我，很多“推理能力”问题其实是生成过程管理问题。模型需要的不一定是一大套系统，有时只是先停一下，把计划说清楚。
