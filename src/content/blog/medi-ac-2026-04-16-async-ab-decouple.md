---
title: MediAC 的报告有了版本，它读的是哪一轮
slug: medi-ac-2026-04-16-async-ab-decouple
description: 报告任务独立以后，继续检查输入快照的读取时间和前端等待。
date: 2026-04-16
category: engineering
tags:
  - MediAC
draft: false
places: []
---

报告改成后台任务以后，接口先交回 job id，页面可以查询状态，再读生成结果。上一份报告还在，新任务继续跑，这比每次把整份回答堵在聊天请求里好处理。不过用户接着补充信息时，一个新问题就出现了：这份报告到底包括哪一轮？

`ReportJob` 记录任务是否完成，`ReportVersion` 保存产出，`SessionIntake` 则随着对话继续更新。三份记录有关联，保存时点却不同。九月对照现存的 `backend/main.py` 与 `backend/db.py`，调度时没有把输入全部冻结下来。

```text
schedule：记录任务、触发方式和 scheduled_from_turn
执行任务：先标 running，再读取消息与当前 intake
生成完成：保存 report、query_snapshot、intake_snapshot
```

假设第三轮后调度，第四轮信息在任务读取前已经写入，执行时就可能读到新 intake；如果任务先读完，它又不会包含后来的更新。`scheduled_from_turn` 留了触发轮次，但当前消息查询没有按这个字段截断。版本号本身不能回答“是否包含第四轮”。

消息查询还有一个容易被变量名掩盖的细节：名叫 `recent_user_messages`，实际按时间升序再 LIMIT。会话长了，取到的是最早的有限条用户消息，而不是最新几条。保存出来的 snapshot 可以帮助回查实际选了什么，却不能把选择过程自动变成一致的调度时快照。

![报告任务与版本的生成关系](/content-diagrams/medi-report-async.svg)

自行整理的后端职责图，不表示每一版前端都已解除等待，也不表示输入在调度时冻结。

## 后台任务之外，还有一处等待

当前任务由 `asyncio.create_task` 在 API 进程内启动，字典追踪正在运行的任务。数据库有 queued/running 状态，不等于已经具备独立 worker 或进程重启后的自动恢复。相同会话已有 queued/running job 时，调度会返回现有任务，不是每触发一次都另开一份。

前端也还没完全放开。现存 `App.tsx` 的发送流程在拿到报告 job 后会 `await pollJob(...)`，直到轮询返回才在 finally 里把 loading 设回 false；发送按钮又受 loading 控制。后端任务可以独立跑，这个页面的正常发送路径仍然会等待报告轮询。这是九月整理看到的未完成处，不能写成整条交互已经完全解耦。

后续要继续改，我会把两件事分开：先定义报告应覆盖哪一刻的输入，再让前端聊天的 loading 只对应聊天请求。手动生成、轮数触发和红旗触发仍是教学流程的调度规则，不说明医学判断可靠。查一份旧报告时，先找对应 job，再看实际保存的输入快照，才能知道当时有哪些资料进入了生成。
