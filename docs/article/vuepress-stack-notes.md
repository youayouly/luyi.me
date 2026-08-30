---
title: 用 VuePress 2 搭静态个人站
description: 短文记录本站选型与目录约定。
date: 2026-04-02
cover: /gallery/article-soft-vuepress-stack.png
tags: [VuePress, Frontend]
pageClass: page-article-post
comment: false
toc: true
---

# 用 VuePress 2 搭静态个人站

::: tip 摘要
与 [/tech/my-blog](/tech/my-blog.html) 互补：这里只保留「博客列表里一篇短文」该有的篇幅。
:::

## 为什么选 VuePress

- **Markdown 优先**：内容与组件混排足够用，构建快。  
- **vuepress-theme-hope**：导航、暗色模式、侧边栏开箱即用，减少自己造轮子。  
- **静态输出**：适合 Vercel / Pages 一类托管，CI 里一条 `npm run build` 结束。

## 目录习惯

| 路径 | 用途 |
|------|------|
| `docs/home.md` | 全屏 Hero 首页 |
| `docs/tech/` | 项目型长文 |
| `docs/article/` | 短文 / 随笔列表（本页所在分区） |

## 下一步可以写什么

- 主题里改动了哪些 SCSS、为什么要关掉部分 `backdrop-filter`  
- 某次部署踩坑（缓存、Base URL、环境变量）

---

*Last updated: 2026-04-02*
