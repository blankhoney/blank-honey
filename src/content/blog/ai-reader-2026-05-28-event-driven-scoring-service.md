---
title: AI Reader 的 37 分是怎么来的
slug: ai-reader-2026-05-28-event-driven-scoring-service
description: 一次评分失败怎样写进数据库，又怎样被误当成正常的文章分数。
date: 2026-05-28
category: engineering
tags:
  - AI Reader
draft: false
places: []
---

文章的技术价值、商业价值、时效性等维度全部相同，看着很不对劲。比如总分 37，每一项也都是 37，这很难让人相信模型真的分别判断过。回看 5 月 14 日那版评分代码，原因就清楚了：这些数字可以来自长度兜底，根本没有经过正常的模型评分。

当模型请求或 JSON 解析抛异常，程序会进入 `_baseline_payload()`。它把标题和正文合起来，按每 50 个字符一分计算，再把同一个值复制给七个维度。下面保留这段计算的主要内容：

```python
combined = (title + " " + content).strip()
raw_score = min(100, len(combined) // 50)
dimension_scores = {key: raw_score for key in dimension_keys}
```

所以 37 不是写死的默认值，合并文本长度在 1850 到 1899 个字符时才会得到它。别的长度会有别的分数，但各维度仍然相同。

更麻烦的地方在后面。payload 里其实有 `model_provider="baseline"`、`scoring_status="error"` 和错误信息，可主流程还是把它交给 `upsert_score()`，返回 `ok: true`。从接口看，请求处理完成了；从数据库看，也确实有一行结果；但模型评分失败了。这几种成功被挤到了一起，前端如果只读取 score，就会把错误记录当普通成绩排进列表。

```text
模型返回无法解析
  → 生成长度兜底 payload，标记 error
  → 写入数据库
  → 请求返回 ok
  → 读取方若忽略状态，就显示兜底分
```

历史 `scoring.py`（`7df57e9` 版本）里，错误信息其实没有丢，丢的是展示时对状态的区分。这样再查问题，就不该先修改评分标准，应该先把哪些记录有资格参与排序写明白。

5 月 14 日后续版本已经加了 `<think>` 清理和 JSON 对象提取，读取正常评分的查询也要求 `scoring_status = 'success'`，并排除 `model_provider = 'baseline'`。本文回看五月中旬的事件评分版本，这些改动在同一阶段已经发生。清理返回格式可以减少解析错误，而查询条件保证仍然失败的记录不会混成普通分数，两处都需要。

5 月 14 日的版本已经使用内部 HTTP 服务，支持单篇强制重评、最近 N 篇和 Miniflux 新文章事件，没有后台轮询。事件更及时以后，这个状态区别反而更重要：收到 webhook，只能说明通知到达；任务写回了，也还要看模型结果是否成功。尤其 [Miniflux webhook](https://miniflux.app/docs/webhooks.html) 失败后不会自动重试，不能把有事件入口理解成每篇必定完成。

排查一篇没分数的文章时，可以按这个顺序看：有没有触发、调用是否失败、格式是否合格、数据库里是否有正常结果。临时兜底仍可帮助记录错误，但不该再用一个看起来平平无奇的 37 分，把失败藏进正常列表里。
