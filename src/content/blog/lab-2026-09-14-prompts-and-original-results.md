---
title: 实验区怎么玩：先看场景，再拿原题自己试
slug: lab-2026-09-14-prompts-and-original-results
description: 从体素场景到航海和太空游戏，查看题目来源、模型条件与可下载的原始工程。
date: 2026-09-14
category: tutorials
tags:
  - 生成实验
draft: false
places: []
---

[实验区](https://blog.blankhoney.xyz/lab/)里的首批实验是三道题的不同结果：中国古典建筑群、体素山与瀑布、黑洞。打开以后可以转视角，也可以拿走题目和文件，换个模型再做一次。我想把这两种用法放在一起，省得看完一个漂亮场景，却不知道当初究竟要求了什么。

题目来自无机酸-_- / Atmeplz 的 [0903 公开题包](https://github.com/Atmeplz/ai-test-prompt/blob/1abf1817a670a1568ca1a861dc46f395d8aeac81/assets/prompts/prompts-0903.zip)。九份结果分三组并列保留：Sol / max、Astra / max、最早的 Astra / high。这三组旧版都继续保留。每份详情分别记模型、思考强度和执行条件。

## 新来的航海和太空游戏

这次又加了两道游戏题，每道分别用 Astra / max 和 Sol / max 生成，共四份结果。Sunwake 可以看 [Astra 版](https://blog.blankhoney.xyz/lab/sunwake-astra-max/)和 [Sol 版](https://blog.blankhoney.xyz/lab/sunwake-sol-max/)；Void Explorer 也有 [Astra 版](https://blog.blankhoney.xyz/lab/void-explorer-astra-max/)和 [Sol 版](https://blog.blankhoney.xyz/lab/void-explorer-sol-max/)。原项目都来自 Thomas Ricouard 在 OpenAI 的展示：[Sunwake 的构建过程](https://developers.openai.com/showcase/sunwake)围绕海浪、船只和灯塔展开；[Void Explorer 的构建过程](https://developers.openai.com/showcase/void-explorer)则从飞船航行延伸到降落、步行和重新登船。

官方页面把多轮工作整理成了可展开的步骤，也注明提示词经过编辑。这里保留这些公开文字和参考图链接，合并成一个独立任务重新生成，并在详情中另列执行说明。Void Explorer 多加了一句“背景不要那么暗”。重跑时，两部分都要看；只复制概念图那一步，会漏掉后面的游戏要求。

同一道游戏题的两份输入相同，适合并排看实现的取舍。每个组合目前只有一次生成，操作是否完整、画面是否喜欢，还是要打开实际试。原来的九份结果仍在，详情页继续提供模型、强度、完整题面和工程下载。

## 从建筑群这道题开始

可以先打开 [Sol / max 建筑群](https://blog.blankhoney.xyz/lab/chinese-architecture-sol-max/)，点“查看原始效果”。转一下视角，看看道路怎样把山门、院落和主殿连起来。再回到详情的[完整题面](https://blog.blankhoney.xyz/lab/chinese-architecture-sol-max/#prompt)，会发现题目还要求至少五座建筑、中轴布局、具体屋顶形制，以及旋转时稳定达到 30 FPS。

几座中式屋顶好看，只回答了其中一部分要求。想比较版本，就拿同一份题面逐项看，再到旧 [Astra / high 建筑群](https://blog.blankhoney.xyz/lab/chinese-architecture/)里比较。帧率受设备、窗口和负载影响，详情里的某次短采样也不能代表长期表现，最好别拿两台机器的数字直接排高低。

题面有复制按钮，不能自动复制时可以直接选中文字。标题是方便找作品用的，重新提交要拿完整题面，里面的技术与交付要求也一起保留。运行记录另外说明用了什么工具、有没有自检、还有哪些检查没做。

## 下载前看一眼文件说明

首批 high 的入口分别是 `qingque.html`、`standalone.html` 和 `index.html`，工程 ZIP 也保留了。后来版本未必都是双击一个 HTML 就能跑，例如 Sol 三份在线展示采用标准 dist 构建，需要通过 HTTP 访问。

Sol 交付的离线单 HTML 有 JavaScript 语法错误，这些原文件仍留作下载，但没有拿来当在线入口。建筑群与黑洞的 source.zip 由博客集成时按清单打包，山景 ZIP 则是模型原交付，详情里各自写明。下载“原始工程”时，这个差别值得看一下。

| 文件 | 怎么用 |
| --- | --- |
| 在线入口与运行资源 | 先在浏览器查看本次效果 |
| source.zip | 下载工程，按其中说明安装、运行或继续修改 |
| prompt.txt | 保存这次完整题面 |
| generation.json | 查生成条件与集成观察 |

Astra / max 黑洞后来补的是实际预览图和观察记录，场景 HTML 与工程 ZIP 没改。预览图、模型交付、博客整理是不同材料，有改动就放在对应记录里，不把补拍截图写成模型又生成了一次。

## 留下实际追加过的话

这些作品是在独立任务中生成的，平台工具和系统指令仍然存在。模型会写代码、运行检查、自己修改；一次用户任务不等于只调用一次模型。Sol / max 从开始就限制浏览器使用；Astra / max 在生成期间或交付后收到停止测试、清理资源的指令，具体时点各份运行记录分别保留。

自己重跑时，我会把追加要求也存下来。比如第一版少了宝塔，后来补了一句，最终工程就对应两次用户输入，别只留最初那张题目。构建成功、短时能操作、物理数值测试分别说明不同的事情，黑洞画面能转动，也还得看实现采用哪种物理近似。

想先玩可以直接打开场景，想研究就往下读题面与原文件。选一题、保留一次完整交付就够开始，不必急着给所有模型排总名次。看完把独立场景页关掉，几个 3D 页面一起挂着确实会占不少资源。
