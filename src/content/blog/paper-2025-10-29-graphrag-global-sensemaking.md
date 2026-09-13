---
title: GraphRAG 的引用，怎样一路找到原文
slug: paper-2025-10-29-graphrag-global-sensemaking
description: 从答案里的社区报告编号往回查，理解全局汇总为什么多了几层材料。
date: 2025-10-29
category: papers
tags:
  - 检索增强
draft: false
places: []
---

看一份 GraphRAG 生成的回答，引用里可能写着 `Data: Reports`，后面跟报告编号。这个编号指向的是系统事先写好的社区报告，还没有直接到原文。如果想确认一句话是不是资料里真的说过，接下来还得往回走几步。

[GraphRAG](https://arxiv.org/abs/2404.16130) 的 global search 先把语料加工成实体和关系，做层级社区发现，再给社区生成报告。用户提问时，系统把某一层的报告分组，各组生成局部回答，再汇总成最终答案。它适合讨论一批资料的整体主题，例如大量访谈中反复出现了哪些问题，所读的材料也因此经过了不止一次整理。

![从抽取后的实体关系中发现的图社区](../../assets/papers/paper-2025-10-29-graphrag-global-sensemaking.jpg)

图源：[原论文 Figure 4](https://arxiv.org/html/2404.16130v2#A2.F4)，版权归原作者。这里的社区是图中连接较密的节点分组。

我想把引用这条路单独记下来，因为它决定了汇总以后还方便不方便核对。按官方早期 `v0.1.1` 的结构，可以这样查：

```text
最终答案中的报告编号
  → 社区报告
  → 报告所引的实体、关系等记录
  → 记录关联的 text_unit_ids
  → 原文文本块及 document_ids
  → 来源文档
```

[map 提示](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/query/structured_search/global_search/map_system_prompt.py) 要求局部结果给出描述、帮助分数和报告引用，[reduce 提示](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/query/structured_search/global_search/reduce_system_prompt.py) 再汇总并保留引用。社区报告里又可以引用实体、关系或声明的记录 ID。这些数不是原文页码，也不能直接当数组下标。

引用里显示的编号对应记录的 `short_id`，先按这个字段找到记录，再沿内部关联查找。它和内部 `id` 分开，具体见 [Identified 定义](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/model/identified.py)。不能把一个显示编号直接当成内部 ID 去查询文本块。

接下来看数据对象。[实体](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/model/entity.py) 和[关系](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/model/relationship.py)保留 `text_unit_ids`，通过它找到 [TextUnit](https://github.com/microsoft/graphrag/blob/v0.1.1/graphrag/model/text_unit.py) 的文本和文档关联。这样读者看到一句关于某个实体的概括，至少有路径继续回到被抽取的段落。这份笔记对照的是该早期版本，后续接口变化时需要重查字段。

不过“编号存在”还只是第一步。报告可能引用了一条真实关系，写出的解释却超出了那条关系；最后答案也可能把局部结论概括得太宽。沿这条路回查，才能区分原文说了什么、抽取写了什么，以及哪一层开始多说了一点。把引用点击后只打开另一份 AI 摘要，读者仍然没完成核对。

原论文用约一百万和一百七十万 token 的播客转录、新闻材料，每份语料生成 125 个全局问题，再让模型两两比较答案。除了普通向量检索，还比较了直接对原始文本做 map-reduce 的 TS 基线，这个对照很必要，否则更全面可能只是因为看了更多内容。GraphRAG 在全面性、多样性上优于向量检索；相对 TS，部分中低层报告有较小提升，根层并非一直更好。[实验部分](https://arxiv.org/html/2404.16130v2#S4)

最低层报告的查询上下文比直接处理原文少约 26% 至 33%，但事先抽取和生成报告的花费在查询之前已经发生了。节省来自把原文加工成能反复使用的报告，这也意味着原文到报告的关联值得一起保存。
