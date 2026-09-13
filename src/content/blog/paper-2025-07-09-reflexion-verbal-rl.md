---
title: Reflexion：把失败写成下一轮的经验
slug: paper-2025-07-09-reflexion-verbal-rl
description: 读 Reflexion 的一点笔记：它不是简单自我润色，而是把失败、评价和反思写进 Agent 的记忆循环。
date: 2025-07-09
category: papers
tags:
  - AI
  - Agent
  - Paper Notes
draft: false
places: []
---

## 这篇我读得比较慢

Reflexion 的原题是 _Reflexion: Language Agents with Verbal Reinforcement Learning_。

我读它的时候，最开始容易把它理解成“让模型反思一下再回答”。但读到后面发现，这样理解太轻了。

Reflexion 不是单次 self-refinement。它更像是一个 Agent 在一次 trial 失败之后，把失败原因总结成自然语言经验，存到 memory 里，下一次再用这段经验指导行动。

这个区别很关键。self-refinement 更像“这段回答不好，你再改改”；Reflexion 关心的是“这次任务为什么失败，把经验保存下来，下次别再这么做”。

## 它想解决什么

ReAct 说明了大语言模型可以一边推理一边行动，但 ReAct 很依赖 in-context examples。传统强化学习又要靠梯度下降和大量训练成本。

Reflexion 走的是另一条路：不改模型参数，而是用 verbal reinforcement，也就是语言形式的强化反馈，让 Agent 从过去失败里学一点东西。

这里的“学”不是参数学习，而是上下文学习。模型权重没有变化，变化的是 memory 里多了一条经验。

它的好处是轻，解释性也强。你可以直接看到这轮反思写了什么，它为什么影响下一轮动作。

## 三类任务和反馈

论文里主要看三类任务：decision-making、programming、reasoning。

它使用的反馈也不止一种：

1. 简单的二元环境反馈，比如成功或失败；
2. 针对常见失败情况的 heuristic；
3. 自我评价，比如用 LLM 做二元分类器，或者在编程任务里生成和运行 unit tests。

我比较喜欢这个设计，因为它承认了一个现实：很多任务没有一个完美 evaluator。

有些任务可以 exact match，有些任务只能靠环境反馈，有些任务只能写启发式规则。Reflexion 不是强行要求所有任务统一成一种评分方式，而是把不同反馈都转成语言经验，再交给下一轮使用。

## Reflexion 的几个组件

Reflexion 里有四个核心东西：Actor、Evaluator、Self-Reflection、Memory。

Actor 负责行动。它基于当前任务、短期轨迹和长期经验，生成文本或动作。

Evaluator 负责评价。它接收 trajectory，输出 reward score 或 success/fail。不同任务里 evaluator 的形式不同，可能是 exact match，可能是 heuristic，也可能是 LLM evaluator 或 unit tests。

Self-Reflection 负责把评价和轨迹变成自然语言反思。它不是简单说一句“下次更努力”，而是要总结具体哪里错了，下次应该怎么改。

Memory 负责保存这些经验。论文里把 trajectory history 看成 short-term memory，把 self-reflection 的输出看成 long-term memory。

## 长期记忆和短期记忆

这部分我觉得对工程实现很有用。

短期记忆一般就是当前 trial 的 trajectory：模型做了什么动作，环境返回了什么结果，哪里卡住了。它不一定需要跨 session 存在，很多时候任务结束就可以丢掉，或者压缩成摘要。

长期记忆保存的是反思后的经验。它可能跨多个 trial 存在，用来提醒下一次尝试。

但长期记忆不等于全部塞进上下文。上下文窗口有限，论文实践里通常只保留 1 到 3 条 experiences。工程上如果记忆变多，可能要做检索，挑 top-k 放进 prompt，而不是把所有失败史都塞给模型。

这点和我现在理解的 Agent memory 很接近：存储是一回事，进入上下文又是另一回事。

## 一个 trial 怎么循环

简化一下，Reflexion 的流程是：

1. Actor 先做一次任务，产生 trajectory；
2. Evaluator 判断这次结果好不好；
3. 如果失败，Self-Reflection 根据 trajectory 和 reward 写一段反思；
4. 这段反思进入 memory；
5. 下一次 trial，Actor 带着这段经验再试。

这套流程最吸引我的地方是，它把“失败”变成了可复用材料。

很多 Agent 系统失败后只是报错，最多把日志存起来。Reflexion 的思路是：日志本身对模型不一定有用，需要把它加工成模型能读懂的经验。

## Evaluator 是瓶颈

Reflexion 听起来很漂亮，但它的瓶颈也很明显：你得知道怎么评价一次尝试。

几种 evaluator 各有问题：

| Evaluator | 适合任务 | 主要问题 |
| --- | --- | --- |
| EM scoring | QA / reasoning benchmark | 不识别同义答案 |
| Heuristic | 结构化决策任务 | 规则依赖任务 |
| LLM Evaluator | 开放式语义任务 | 可能误判、幻觉 |
| Unit tests | 编程任务 | 测试可能不完备 |
| Environment reward | 游戏、GUI、机器人 | 需要可执行环境 |

这里我最大的感受是：反思质量不是凭空来的。Evaluator 如果不可靠，反思就可能把错误经验写进 memory，下一轮反而更差。

尤其是 LLM Evaluator，看起来省事，但它本身也会误判。编程任务里 unit tests 更可靠一些，但测试覆盖不完整时，也会给出错误安全感。

## 它和编程任务的关系

论文里也对比了 AlphaCode、CodeT、Self-Debugging、CodeRL 这些方向。

我的理解是：

- AlphaCode 更像生成一堆候选代码，再靠测试筛；
- CodeT 关注生成 unit tests，用测试给候选实现打分；
- Self-Debugging 根据执行反馈修复已有实现；
- CodeRL 把代码修复做成 actor-critic RL。

Reflexion 和它们的不同点在于，执行反馈、测试、调试和反思被连成了一个 loop。它不只是“这次代码错了，修一下”，而是“这次为什么错，写成经验，下次生成时提前避开”。

这也是我觉得它对 coding agent 很有启发的地方。

## 限制

Reflexion 不是万能的。

第一，反思质量受 LLM 能力限制。如果模型不能正确定位错误，它写出来的反思会误导后续 trial。

第二，Evaluator 可靠性是瓶颈。EM、heuristic、LLM evaluator、unit tests 都可能误判。

第三，memory 容量有限。经验太多会挤爆上下文，太少又可能学不到东西。

第四，它不是真正的参数学习。它改变的是上下文，不是模型权重，所以跨任务泛化能力有限。

第五，它需要可评价反馈。没有 reward、test 或 environment signal 时，这个循环很难闭合。

论文也提到 Reflexion 在需要大量探索和多样性的任务上不一定有效，比如 WebShop 这类任务，多轮循环可能提出不了真正新的改进。

## 我的结论

Reflexion 对我最大的价值，是把“反思”这件事从一句 prompt 变成了一个系统结构。

失败不是直接丢掉，也不是简单重试，而是经过 Evaluator 和 Self-Reflection 加工成经验，再进入下一轮。

如果以后做更复杂的 Agent，我会把 Reflexion 当成一个提醒：不要只存 action log，也不要只存最终答案。真正有用的是把失败压缩成模型下一次能用的经验，而且这个经验必须有评价信号支撑。
