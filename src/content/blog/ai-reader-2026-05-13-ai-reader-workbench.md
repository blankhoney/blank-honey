---
title: 页面查自己的 API，也绕进了登录入口
slug: ai-reader-2026-05-13-ai-reader-workbench
description: 工作台空列表的一次排查，以及服务端取数为什么改成直接调用。
date: 2026-05-13
category: engineering
tags:
  - AI Reader
draft: false
places: []
---

工作台先搭成三栏：左边切模块，中间扫文章标题，右边读正文和问答。中栏希望多放几条标题，选中以后在旁边接着读，基本用法很明确。接到 staging 以后却有过空列表，页面框架都出来了，文章还没到。

原来的服务端页面会先根据请求里的 host 和 protocol 拼出公网地址，再请求自己的 `/api/articles`。这样复用了 API，路径也绕了一圈：服务端出去，经过公网入口，再回到服务端。用户打开页面时有登录状态，第二次由服务器发出的请求却不会自动继承那份认证。

```text
原取数路径：服务端页面 → 公网入口与认证 → /api/articles → 查询
修改以后：  服务端页面 → listArticlesForModule → 查询
```

5 月 13 日的 `41386c6` 版本在 `page.tsx` 删掉了那段 origin 拼接，页面直接调用服务端函数：

```ts
return listArticlesForModule(moduleResolution.moduleId, DEFAULT_ARTICLES_LIST_LIMIT, sort);
```

函数负责把 Miniflux 文章与本地评分合在一起，页面不必为了取同进程的数据重新走入口。[Next.js 的服务端取数说明](https://nextjs.org/docs/app/guides/backend-for-frontend)也解释了这次额外 HTTP 往返。这条 diff 明确留下了取数路径怎样改；直接调用以后，也就不再依赖第二次公网请求的认证。以后再遇到空列表，至少可以先从这个函数往下查。

另外一种状态问题是接口返回成功，刷新又像没操作过。Miniflux 的用户 id 和本地 reader state 使用的身份必须一致，`READER_MINIFLUX_USER_ID` 在两边配错，就可能写到一份记录、读另一份。200 只能说明那次请求完成了；还得用同一用户把状态读回来。我宁愿在这里多做一次读回，也不想等界面出问题时再猜到底写给了谁。

三栏页面终于有东西可读以后，再补交互才有着落。空白、loading 和状态回退，从屏幕上看都很相似；这次留下的两个检查点很具体：页面有没有绕出去重新认证，写入和读取是不是同一个用户。
