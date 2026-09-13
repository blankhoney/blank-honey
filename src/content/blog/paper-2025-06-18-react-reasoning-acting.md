---
title: ReAct：让模型一边推理一边行动
slug: paper-2025-06-18-react-reasoning-acting
description: 读 ReAct 的一点笔记：它不是简单的工具调用，而是把推理、行动和环境反馈放进同一个循环里。
date: 2025-06-18
category: papers
tags:
  - AI
  - Agent
  - Paper Notes
draft: false
places: []
---

## 读这篇时我想搞清楚什么

ReAct 的原题是 _ReAct: Synergizing Reasoning and Acting in Language Models_，ICLR 2023。

这篇现在被引用得很多，但我之前对它有个误解：以为 ReAct 就等于“模型先 think，再 tool call，再看 observation”。读完以后感觉没这么机械。

更准确一点说，ReAct 关心的是：模型不要只在脑子里编答案，也不要只是盲目调用工具，而是把推理和行动交替起来。需要想的时候想，需要查的时候查，查完以后再根据外部反馈继续走。

## 先区分 CoT 和 CoT-SC

CoT 本身不需要循环。

它通常只是通过 prompt 给模型一些逻辑链条示例，或者要求模型按步骤输出推理过程。模型一次输入、一次输出，中间没有环境状态，没有工具反馈，也没有“动作执行后再继续”的机制。

CoT-SC，也就是 Self-Consistency，也不是 Agent 循环。它更像是多采样：生成多条推理链，再用投票选答案。它能缓解随机性，但仍然是在模型内部生成多个候选，不涉及外部环境。

这个区分很重要。因为 ReAct 真正多出来的不是“思考”两个字，而是 Action 和 Observation。

## ReAct 的循环

论文里常见的写法是 Thought、Action、Observation。

我的理解是：

- Thought：模型对当前任务状态的判断；
- Action：模型决定采取的动作，比如搜索、查询、点击、拿物品；
- Observation：环境或工具执行 Action 后返回的结果。

下一轮模型会基于原问题、历史 Thought、历史 Action 和 Observation 继续生成。

如果放到真实代码里，它不一定真的长成三个独立字段。很多现代 tool calling API 里，Thought 可能根本不显式输出，Action 表现为 tool call，Observation 就是工具返回结果再塞回 messages。

所以我现在不太会把 ReAct 理解成一个固定 prompt 模板，而是理解成一种控制流：模型产生动作，环境返回结果，模型再基于结果继续决策。

## 工程里最容易忽略的是上下文噪音

真实跑 ReAct 循环时，一个很烦的问题是上下文会变脏。

工具参数、错误日志、搜索结果、重复 action、trace 信息，全都可能进上下文。循环一长，模型看到的不是“清晰任务状态”，而是一堆半有用半没用的过程材料。

所以我觉得工程实现里通常需要压缩。循环结束后，把关键过程整理成一段摘要和最终结果，返回给主 session，而不是把所有工具调用垃圾都长期保存在上下文里。

这不是论文里最显眼的点，但对实际系统很关键。

## ReAct 解决了什么

CoT 的问题在于，它只能靠模型已有知识和当前上下文往下想。知识密集型问题里，模型很容易自我感觉良好地编一个答案。

ReAct 把外部信息接进来，让模型可以边推理边查证。HotpotQA、FEVER 这类知识密集任务里，模型能通过搜索获得事实；ALFWorld、WebShop 这类交互任务里，模型能根据环境反馈修正下一步动作。

这不是说 ReAct 消灭了幻觉。更准确的说法是，它把一部分“凭空想”的错误，转移成“工具结果质量”和“模型是否正确读懂工具结果”的问题。

## Thought 不一定每一步都有

我之前容易把 ReAct 固定理解成：

> Thought -> Action -> Observation -> Thought -> Action -> Observation

但论文里其实有 dense thought 和 sparse thought 的区别。

知识推理任务，比如 HotpotQA / FEVER，通常每一步都有 Thought-Action-Observation。因为每次搜索后都需要解释当前证据和下一步查什么。

但在 ALFWorld / WebShop 这种长时程决策任务里，Thought 可以 sparse，只在关键位置出现。很多动作没必要每一步都解释一遍，否则上下文会很长，模型也容易绕。

这点对工程实现很有启发：不要为了“符合 ReAct”强迫模型每个动作前都输出一段思考。思考密度应该服务任务，而不是服务格式。

## ReAct 也有自己的错误模式

论文里的错误分析我觉得比主结果更值得看。

CoT 失败时，hallucination 占比很高。ReAct 的 groundedness 更强，但它也会出现新的错误：

- reasoning error：重复生成旧 thought/action，或者跳不出循环；
- search result error：搜索结果质量差，模型被带偏；
- action repetition：同样的动作反复做；
- tool result misread：工具返回了东西，但模型理解错。

所以 ReAct 不是“用了工具就不会幻觉”。它只是把模型放到了一个更接近真实环境的循环里。这个循环更可信，但也更依赖工具质量、状态管理和停止条件。

## Fine-tuning 的观察

论文还有一个点挺有意思：prompting 下，小模型学 ReAct 并不容易；但用 3000 条正确轨迹 fine-tune 后，ReAct 变成四种方法里最强。

作者的解释是，Standard / CoT fine-tuning 更像教模型记忆事实，而 Act / ReAct fine-tuning 更像教模型如何访问 Wikipedia。这种能力更可泛化。

这让我想到后面的 Toolformer、Reflexion、ReWOO 这些路线。大家都不只是让模型“回答”，而是在训练或 prompt 中让模型学会怎样使用外部结构。

## 我的结论

ReAct 对我最大的提醒是：Agent 的核心不只是 tool call，而是闭环。

模型要能判断当前状态，选择动作，读懂反馈，再决定下一步。真正难的地方也在这里：上下文怎么清理，循环什么时候停，错误工具结果怎么处理，重复动作怎么打断。

如果只把 ReAct 理解成一个 prompt 格式，反而会错过它最有价值的部分。
