---
title: 回答里全是井号，先把 Markdown 显示出来
slug: ai-reader-2026-05-15-productization-and-cicd
description: 从 pre 到 AgentMarkdown，补上阅读页真正用得到的排版。
date: 2026-05-15
category: engineering
tags:
  - AI Reader
draft: false
places: []
---

模型回答里写着 `## 重点`，页面也原样显示 `## 重点`。列表前的横杠和加粗星号都在，答案已经生成，读起来还是像在看一段待处理的文本。检查组件，原因只有一行：回答直接放进了 `<pre>`。

5 月 15 日，`ArticleReader.tsx` 的 `1425c9d` 版本把它交给一个单独的展示组件：

```tsx
<AgentMarkdown text={answer} />
```

`AgentMarkdown` 先辨认块，再处理块里的行内格式。一至三级标题、普通段落、有序与无序列表、引用是第一批支持的内容；行内可以显示代码、加粗和 http(s) 链接。这样回答中的重点可以成为真正的标题，代码名也能和正文区分。

我没有把它写成完整 Markdown 解析器。这个版本还不支持表格和围栏代码块，复杂回答不能指望全部正确排版。至少常见的几种输出先看得下去，后面需要扩展时，也有一个明确的位置可改。同次提交的 `AgentMarkdown.tsx` 保留了这批支持范围。

原始 HTML 不直接执行，模型给出的文本仍由 React 转义。链接也只认 http(s)；测试里把 `javascript:` 这样的内容留作普通文本。这里不想因为一段回答用了 HTML，就顺手让它变成可执行的页面。

阅读布局也继续收拾：正文给更宽的位置，评分和操作按钮收一些，Agent 放进底部抽屉，需要时再打开。抽屉关闭时若直接卸载，退出动画根本来不及播放，于是用 [AnimatePresence](https://motion.dev/docs/react-animate-presence) 留住那一小段生命周期，再把重复的面板动画与外部点击关闭整理出来。这些细节不改变答案，却会决定我愿不愿意接着读。
