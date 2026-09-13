---
title: 教程（二）：安装 Hexo 并部署到 GitHub Pages
slug: 教程（二）hexo框架的搭建及部署
description: 从早期 Hexo 文章重建，整理 Node.js、npm、Hexo 初始化、本地预览和 GitHub Pages 部署。
date: 2022-06-28
category: tutorials
tags:
  - Hexo
  - GitHub Pages
  - Node.js
  - Legacy
  - 教程
draft: false
places: []
---

上一篇文章把 GitHub Pages 仓库准备好了。这一步继续往下走：在本地安装 Hexo，把博客跑起来，再把生成后的静态页面部署到 GitHub Pages。

原文写于 2022 年，当时我把很多前端概念揉在一起讲，尤其是把 webpack 放进了 Hexo 前置步骤里。现在回头看，这一步并不必要。搭建 Hexo 的核心依赖只有 Node.js、npm、Git 和 Hexo CLI；webpack 是打包工具，不是创建 Hexo 博客必须先安装的东西。

## 准备 Node.js 和 npm

Hexo 是基于 Node.js 的静态博客框架。可以把 Node.js 理解成一个能在浏览器之外运行 JavaScript 的环境，Hexo 则借它完成依赖安装、主题处理、静态页面生成等工作。

安装 Node.js 后，npm 通常会一起安装。先在终端里确认环境是否可用：

```bash
node --version
npm --version
git --version
```

如果这些命令都能输出版本号，说明基础环境已经准备好。早期文章里引用过菜鸟教程的 Node.js 安装说明，它依然可以作为入门参考；但实际安装时更建议使用 Node.js 官网安装包，或者用 `nvm` 这类版本管理工具，避免以后遇到版本切换问题。

## 安装 Hexo CLI

Hexo 的命令行工具可以全局安装：

```bash
npm install -g hexo-cli
```

安装完成后检查：

```bash
hexo version
```

这里不需要先执行 `npm install webpack -g`。如果某个主题或插件后来需要 webpack，它会在自己的依赖里声明；博客初始化阶段不用提前把它装成全局工具。

## 初始化博客目录

找一个你希望存放博客源码的目录，创建并初始化 Hexo 项目。比如目录名叫 `blog`：

```bash
hexo init blog
cd blog
npm install
```

初始化完成后，目录里会出现 `_config.yml`、`package.json`、`source`、`themes` 等文件和文件夹。原文中的截图展示了初始化后的目录状态，里面还多了一个 Butterfly 主题配置文件；这个文件不是 Hexo 默认生成的，而是后续配置主题时才会出现。

![初始化后的 Hexo 项目文件结构](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628232853869.png)

*初始化后，目录中应能看到 Hexo 的基础配置与源码结构；主题配置文件是否存在取决于你是否已经安装主题。*

## 本地生成和预览

进入 Hexo 项目根目录后，先生成静态文件：

```bash
hexo generate
```

也可以使用缩写：

```bash
hexo g
```

然后启动本地服务器：

```bash
hexo server
```

或者：

```bash
hexo s
```

启动成功后，终端会提示本地访问地址，默认通常是 `http://localhost:4000/`。

![Hexo 本地服务器启动成功提示](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628233324039.png)

*看到本地服务器地址，说明 Hexo 已经把博客临时跑起来了。*

在浏览器打开：

```text
http://localhost:4000/
```

如果能看到默认博客页面，说明本地预览已经成功。

![Hexo 默认博客首页](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628233525630.png)

*默认首页能打开，就先不要急着改主题；先确认生成和预览链路是通的。*

## 配置 GitHub Pages 部署

本地能跑之后，再配置发布。Hexo 的主配置文件是项目根目录下的 `_config.yml`：

![Hexo 项目中的 _config.yml 文件](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628233840874.png)

*部署配置写在 Hexo 项目根目录的 `_config.yml` 底部。*

在文件底部补充 deploy 配置。仓库地址换成你自己的 GitHub Pages 仓库：

```yaml
deploy:
  type: git
  repository: https://github.com/username/username.github.io.git
  branch: main
```

早期很多教程还写 `master`，现在新建仓库默认分支通常是 `main`。实际应该以你 GitHub 仓库里显示的默认分支为准，不要机械照抄。

仓库地址可以从 GitHub 仓库的 Code 按钮里复制：

![从 GitHub 仓库复制地址](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628234205144.png)

*复制 HTTPS 或 SSH 地址都可以，但要和你本机的 Git 认证方式匹配。*

## 安装部署插件并发布

Hexo 通过 Git 发布到仓库时，需要安装部署插件：

```bash
npm install hexo-deployer-git --save
```

安装完成后，在 Hexo 项目根目录执行：

```bash
hexo clean
hexo generate
hexo deploy
```

缩写写法也可以：

```bash
hexo clean
hexo g
hexo d
```

这三步分别对应：清理旧的生成文件、重新生成静态页面、把结果推送到配置好的 GitHub 仓库。

如果命令没有报错，稍等 GitHub Pages 完成发布后，就可以访问：

```text
https://username.github.io/
```

原文用当时的博客截图作为部署成功后的效果图。需要注意的是，截图里已经配置过 Butterfly 主题；如果你刚初始化 Hexo，线上看到的仍然会是默认主题页面，这并不代表部署失败。

![部署后的博客页面示例](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628234636295.png)

*这是配置主题后的博客效果；刚完成基础部署时，页面样式可能更接近默认首页。*

![Hexo 默认页面也可以作为部署成功的判断](../../assets/legacy/教程（二）hexo框架的搭建及部署/image-20220628233525630.png)

*默认页面在线上能打开，也说明 GitHub Pages 已经跑通。*

## 收尾检查

这篇教程真正要确认的不是主题好不好看，而是链路是否闭合：

- Node.js、npm、Git 能正常使用；
- `hexo init` 能初始化项目；
- `hexo s` 能在本地打开博客；
- `_config.yml` 里的 deploy 仓库和分支正确；
- `hexo-deployer-git` 已安装；
- `hexo d` 能把静态页面推送到 GitHub Pages 仓库；
- `https://username.github.io/` 能访问到页面。

这些都完成后，再去折腾主题、美化、评论、搜索和图片路径，会更容易定位问题。Butterfly 主题的官方文档可以作为下一步参考：

[Butterfly 官方文档](https://butterfly.js.org/posts/21cfbf15/)
