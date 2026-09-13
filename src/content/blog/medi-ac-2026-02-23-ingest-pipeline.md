---
title: MediAC 入库：一条横线也被切成了 chunk
slug: medi-ac-2026-02-23-ingest-pipeline
description: 顺着 Markdown 到双索引的路径，检查标题、空行和片段正文。
date: 2026-02-23
category: engineering
tags:
  - MediAC
draft: false
places: []
---

准备接 `/retrieve` 以前，我先把资料入库做了。输入是 `data/hybrid_sources` 里的 Markdown，同一批片段分别生成向量写进 Qdrant，并保存成 jsonl 给本地 BM25 使用。之后比较两路召回，至少能找到同一个 chunk，看看它在两边各排什么位置。

原本很容易把这段概括成“按标题切块”，但这样写太省事了。九月整理时重新看 `scripts/ingest_hybrid.py`，实际函数还在空行处结束缓冲区，而且识别的是所有以 `#` 开头的行，不只二级标题。标题进入 `metadata.section`，没有拼进片段正文。

下面用一份自拟的极短文档说明当前函数的行为：

```markdown
## 导入说明

第一段正文。

---

第二段正文。
```

它会得到三个正文片段：`第一段正文。`、`---`、`第二段正文。`，三者的 section 都是“导入说明”。横线没有特殊处理，前后又有空行，于是单独入了块。项目里的样本文件也存在这种分隔线；只检查“成功导入多少条”，很难注意到其中还有这样的内容。

我觉得这一步应该先把 jsonl 打开读几条。正文只剩横线，就算 embedding 调用成功，对回答也没帮助；条件与结论被空行分开，检索只命中其中一块，同样会丢上下文。标题保存进 metadata 是个回查入口，还要看后续检索和 prompt 有没有把它带给模型，不能在入库时保存了就算一路保留。

```text
Markdown → 切块 → 同一批 chunk
                    ├→ 向量与 payload → Qdrant
                    └→ chunks.jsonl → 本地 BM25
```

图数据另走 `ingest_graph.py` 和 `export_youtu_graph.py`，先把节点、关系写到 Neo4j。这时还没有一份覆盖完整的医学知识图谱。图侧与文本侧的内容也不完全相同，后面比较召回时，需要把资料覆盖一起考虑。

这个演示采用整批重建。当前脚本发现 collection 已存在会先删除，再按首个 embedding 的维度创建并导入，所以它会覆盖旧数据。换模型后不能把新旧向量直接混在一起，即使维度恰好相同也一样。[Qdrant collection 的向量配置](https://qdrant.tech/documentation/concepts/collections/)只约束了其中一部分条件。重新导入之前，我会先检查切块输出；那条 `---` 没清掉，重跑多少次都会原样再来。
