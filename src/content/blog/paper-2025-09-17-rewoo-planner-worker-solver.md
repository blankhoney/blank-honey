---
title: ReWOO：先规划完整工具蓝图，再一次性执行
slug: paper-2025-09-17-rewoo-planner-worker-solver
description: 读 ReWOO 的一点笔记：它关心的不是让 agent 更会循环，而是减少 ReAct 式循环带来的 token 和延迟浪费。
date: 2025-09-17
category: papers
tags:
  - AI
  - Agent
  - Tool Use
  - Paper Notes
draft: false
places: []
---

## 为什么会有 ReWOO

ReWOO 的全名是 _Reasoning WithOut Observation_，这个名字一开始有点反直觉。工具增强模型不就是要看 observation 吗？为什么反而强调 without observation？

读完以后我理解，它不是说不要工具结果，而是把“推理规划”和“工具观察”拆开。传统 ReAct 类系统是想一步、调一次工具、看一次结果、再想下一步。ReWOO 认为这种交错方式在很多任务里会造成大量重复 prompt 和多轮 LLM 调用。

如果任务可以提前规划，那就没必要每一步都等观察回来再决定下一步。

## Planner、Worker、Solver

ReWOO 把系统拆成三个角色：

- Planner：一次性生成完整任务蓝图；
- Worker：按照蓝图执行工具调用，并填充 evidence；
- Solver：结合 plan 和 evidence 生成最终答案。

Planner 生成计划时，会用占位符表示后续工具结果，比如 `#E1`、`#E2`。Worker 执行工具后把真实 evidence 填进去。Solver 最后看完整计划和证据。

这种结构的好处很明显：LLM 不用每轮都吃全量历史，也不容易陷入重复 action 循环。上下文增长更慢，token 消耗也更可控。

## 它适合什么任务

我觉得 ReWOO 适合那些“路径可以预先决定”的任务。

比如多跳检索、文档问答、事实比较、信息聚合。虽然每一步工具返回内容不同，但整体执行结构大体可预见：先查 A，再查 B，再比较，最后总结。

但它不太适合强动态交互任务。比如 GUI 操作、代码调试、网页购买、需要根据中间结果选择完全不同路径的任务。因为这些任务的下一步确实依赖观察结果，强行提前写完整计划容易出错。

所以 ReWOO 不是 ReAct 的全面替代。它更像是把一类任务从“交互式循环”改造成“静态依赖计划”。

## 参数效率这条线

论文还有一个点：把大模型的 Planner 能力迁移到小模型。作者通过 GPT-3.5 生成 blueprint 数据，再 instruction fine-tuning 一个 7B Planner，让小模型也能承担规划角色。

这个思路到今天看不算新，但方向仍然成立：把昂贵模型擅长的结构化规划能力蒸馏出来，让便宜模型执行稳定的部分，再用强模型兜底复杂场景。

工程上大概会变成：

- 小模型做计划或格式化；
- 工具层负责可靠执行；
- verifier 或强模型检查结果；
- 必要时 fallback 到更强的交互式 agent。

## 我会保留的判断

ReWOO 的优势在于减少冗余，不在于解决所有推理问题。源笔记里提到一个很重要的补充：在 GSM8K 这种不需要外部工具的任务上，CoT 可能比 ReWOO 更好，token 也更少。TriviaQA 里 Direct 也可能超过 ReWOO。

这说明工具和规划不是越多越好。任务如果不需要工具，工具只会引入噪音。如果任务需要动态重规划，静态蓝图又会不够灵活。

## 小结

ReWOO 给我的启发是：Agent loop 不一定要每一步都让模型重新思考。

如果任务结构可预见，先规划、再执行、最后汇总，可能比 ReAct 式反复暂停恢复更便宜、更稳定。真正的工程判断在于识别任务类型：什么时候用 ReAct，什么时候用 ReWOO，什么时候干脆 Direct 或 CoT 就够了。
