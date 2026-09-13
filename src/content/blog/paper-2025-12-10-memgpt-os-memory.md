---
title: MemGPT：把上下文窗口当成操作系统内存来管理
slug: paper-2025-12-10-memgpt-os-memory
description: 读 MemGPT 的一点笔记：它有趣的地方不是“记忆更多”，而是把有限上下文变成可调度的内存层级。
date: 2025-12-10
category: papers
tags:
  - AI
  - Agent
  - Memory
  - Paper Notes
draft: false
places: []
---

## 这个比喻很准

MemGPT 的副标题是 _Towards LLMs as Operating Systems_。一开始看这个名字会觉得有点大，但读完以后发现，操作系统这个比喻很贴切。

LLM 的上下文窗口就像主内存。能放进去的信息，模型可以直接使用；放不进去的信息，就算存在外部数据库里，也必须被检索、换入、整理以后才能参与推理。

MemGPT 做的不是单纯扩大上下文，而是让模型学会管理上下文。

## Main context 和 external context

论文把记忆分成 main context 和 external context。

Main context 类似 RAM，就是 prompt tokens。里面的信息是 in-context 的，模型可以直接看见。External context 类似磁盘，信息存在外部，需要通过函数调用移入 main context 才能使用。

Main context 里又分几块：system instructions、working context、FIFO queue。Working context 保存用户和 agent persona 的关键事实；FIFO queue 保存滚动消息历史；队列快溢出时，系统会给模型发 memory pressure 警告。

这个设计让我觉得很工程：不是“记忆模块帮你记”，而是“当上下文压力上来时，模型要决定哪些东西该写入长期存储，哪些可以被摘要或驱逐”。

## Function chaining 是关键

MemGPT 通过函数调用在 main context 和 external context 之间移动数据。模型可以搜索记忆、写入 working context、翻页检索、最后再决定是否回复用户。

这和普通一次性 LLM 调用差别很大。普通调用是用户发消息、模型回答、结束。MemGPT 更像事件循环：用户消息、系统警告、定时事件、上传文档，都可能触发模型先管理上下文，再回答。

源笔记里有一句总结很好：这部分其实把普通 LLM 调用变成了一个系统架构。记忆不是孤立功能，而是和控制流绑在一起。

## 文档分析和长期对话

论文评估两个场景：文档分析和长期对话。

文档分析里，MemGPT 可以多次调用检索器和翻页机制，处理超过当前上下文窗口的大型文档。长期对话里，它能把重要信息写入 working context 或 external storage，让 Agent 保持用户一致性。

最有意思的是 nested key-value retrieval。普通模型在多跳 KV 查找上很快失败，MemGPT 可以通过函数查询反复访问 main context 中没有的 key-value，完成多跳查找。这说明“会检索多次”本身就是一种能力，不是一次 top-k 能解决的。

## 我会注意的问题

MemGPT 的风险在于，它把很多控制权交给模型。模型要判断什么时候写记忆、写什么、什么时候继续检索、什么时候停止。这会带来行为不稳定。

另外，外部记忆的质量、检索器的召回、摘要是否丢信息、function chaining 是否陷入循环，都会影响结果。它提供的是一种通用架构，不是一个自动可靠的记忆系统。

## 小结

MemGPT 对我最大的启发是：上下文窗口不是一个被动限制，而是可以被调度的资源。

Agent 如果要长期运行，就不能只靠“更长上下文”。它需要内存层级、写入策略、检索策略、驱逐策略、事件循环和函数链。换句话说，记忆系统最终会变成运行时系统的一部分。
