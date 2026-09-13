---
title: MediAC 的重复气泡，要清的是哪份状态
slug: medi-ac-2026-04-28-bugs-and-teaching-ready
description: 流式临时文本与正式消息的交接，也适合拿来讲一次前后端流程。
date: 2026-04-28
category: engineering
tags:
  - MediAC
draft: false
places: []
---

一条回复显示两次，先别急着按文字去重。流式页面里本来就可能同时有两份文本：正在接收的临时回复，以及完成后进入消息列表的正式回复。如果两份都画出来，即使后端只生成了一次，页面也会多一个气泡。

九月整理 `frontend/src/App.tsx`，正常完成路径把消息加入列表后，紧接着清理 `streamConsult`。这里清理的是临时状态：

```text
token 到来 → 追加 streamConsult → 显示正在生成的气泡
正常完成 → 完整回答进入 messages
          → streamConsult 置空
```

渲染临时气泡的条件是 `loading && streamConsult`。正式消息已经进列表时，即使后面仍在轮询报告、loading 尚未结束，临时内容清空也会让它退出。只在整个请求 finally 里把 loading 关掉，并不能表达这个更早的交接时点。

我觉得这个问题比“把一样的文字删一份”更适合拿来讲状态。用户完全可能连续收到两句相同回复，文本相等不表示它们是同一条消息。要清理的是这次生成的占位内容，判断依据应该来自流程完成，而不是比较字符串。[React 状态快照](https://react.dev/learn/state-as-a-snapshot)可以帮助理解为什么页面会同时反映两份状态。

当前这段代码能说明正常完成怎样处理，没有历史 diff 可以逐行还原四月修复前的现场。断流、没有 done 或保存后出错，还得分别检查，不能把这一处清空写成所有异常路径都解决了。

如果用这个 demo 做 90 分钟讲解，我会留一段时间给重复气泡。先看到页面上两份回复，再找 messages 和 streamConsult，最后沿 token、保存、done 回到后端。听的人已经认识一次正常请求，再看状态什么时候交接，比先把所有技术名词讲一遍容易跟上。
