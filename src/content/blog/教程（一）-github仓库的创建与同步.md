---
title: '教程（一） github仓库的创建与同步'
slug: 教程（一）-github仓库的创建与同步
description: 2022 年个人博客与 Hexo 搭建旧文，保留早期表达；工具和平台说明以当时版本为背景。
date: 2022-06-28
category: tutorials
tags:
  - 博客
draft: false
places: []
---
## 安装使用git

### 1. git是什么以及git的安装

git 是版本控制软件，目前最先进最流行的

github 是一个网站，用于广大开发者开源自己的代码，也提供私有仓库的付费功能，而它采用的版本控制软件就是git

要完成博客的搭建我们需要用到git的帮助，所以我们需要安装git，安装过程参考下述链接：

[git安装教程](https://www.runoob.com/git/git-install-setup.html)

在安装完成git后我们可以熟悉git的基本操作，在上述菜鸟教程的安装教程后也有基本的操作教程。

### 2. 使用github创建仓库并且使用git同步仓库

我们要用git上传文件到GitHub首先得利用SSH登录远程主机，而登录方式有两种：一种是口令登录；另一种是公钥登录。口令登录每次都要输入密码十分麻烦，而公钥登录就省去了输入密码的步骤，所以我们选择公钥授权。

1.

如何获取ssh key

[获得ssh key](https://www.runoob.com/w3cnote/view-ssh-public-key.html)

2.

如何使用ssh key添加到github

[使用ssh连接到Github](https://www.huangziheng.com/docs/git/connecting-to-github-with-ssh/)

3.

如何使用git同步github仓库

[github使用git教程](https://www.runoob.com/w3cnote/git-guide.html)

### 3. 创建一个用于博客的仓库

经过上面的多个教程的学习（甚至不用学习，我们只需要按教程走一遍流程），我们对于github的使用以及git的使用都有了一定的经验，创建用于托管静态网页的仓库与创建普通仓库没有什特殊的操作，唯一的区别是我们需要输入特殊的仓库名称：

![image-20220628215011336](../../assets/legacy/教程（一）-github仓库的创建与同步/image-20220628215011336.png)

需要注意的有两点：

1.

仓库名称需要为：用户名.github.io

如果我们不租凭域名，该名称就是我们后续登入博客的连接。

2.

在同步时需要注意，最近github已将主分支更名为main，并不是之前的master，使用git以及后续填写信息时需要注意。

创建成功后我们会得到如下仓库：

![image-20220628220529838](../../assets/legacy/教程（一）-github仓库的创建与同步/image-20220628220529838.png)

记录下HTTPS链接，接下来的hexo框架配置过程会用到。

接下来的教程是hexo的部署配置以及托管，配置完成后你就拥有自己的博客了：

[hexo的部署配置以及托管](/blog/教程（二）hexo框架的搭建及部署/)
