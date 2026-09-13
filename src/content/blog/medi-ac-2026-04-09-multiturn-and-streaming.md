---
title: MediAC 流式回复：看见文字以后，还发生了什么
slug: medi-ac-2026-04-09-multiturn-and-streaming
description: POST 请求读取 SSE，随后保存完整消息，再发出 done。
date: 2026-04-09
category: engineering
tags:
  - MediAC
draft: false
places: []
---

用户补了一句“疼了两天”，希望得到下一句追问。同步 `/v1/dual` 会连着报告一起等，于是这一阶段给 A 线单独做多轮与流式接口。聊天可以先输出文字，B 线调度继续在后面处理。

接口分别留了提交、恢复会话和读流的入口：

```http
POST /v1/chat
GET /v1/sessions/{id}/messages
POST /v1/consult/stream
```

“疼了两天”单独拿来没有完整含义，需要和历史消息放在一起。后端按 `session_id` 找到会话，把历史与当前输入组织进追问 prompt；浏览器保存 id，刷新后再从服务端读消息。

SSE 适合这段从服务端不断推送文本的过程，但这个接口用 POST，前端不能只 new 一个原生 EventSource。它没有设置 POST 请求体的选项，所以这里用 fetch 发请求，再读 response body。[EventSource 构造参数](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)

网络返回的一块字节也不一定就是一条事件。前端需要先累积文本，按空行分出完整 SSE block，再解析 event 和 data；半条事件留在缓冲区等后续数据。[SSE 格式说明](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)值得对着读，不能假设一次 read 刚好对应一次 token 通知。

九月整理 `backend/main.py`，当前正常完成顺序如下：

```text
读取历史与 intake
→ 准备召回与 prompt
→ 逐段发送 token，后台同时累积完整文本
→ 提交用户消息与 assistant 消息到数据库
→ 更新 intake，检查是否调度报告
→ 发送 done，携带完整回答及报告任务状态
```

所以最后一段文字已经显示，不代表客户端已经拿到 done。数据库提交之后还会更新 intake 和检查调度；若这段失败，消息可能已经保存，但客户端没有收到正常完成事件。连接断开本身也不能代替成功确认。

前端收到 token 时先显示临时文本，正常完成后再放入正式消息列表。下一次问答读取历史，依赖的是已保存的消息，不能依赖浏览器刚才画过哪个气泡。后面处理重复显示时，也得从这两份状态的交接入手。

旧同步接口仍保留，便于一次看完整 A/B。流式接口先解决 A 线什么时候开始出字；报告任务和发送按钮什么时候互不等待，还要接着检查后面的调度与前端状态。
