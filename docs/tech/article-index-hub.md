---
title: 文章索引设计
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# 文章索引设计

项目卡片入口说明：文章区使用 `ArticleIndexList` 组件做列表、筛选与阅读路径，与项目 hub 的 `ProjectCardsGrid` 对称。

## 1. 设计要点

- **分区**：`/article/` 为文章索引；`/tech/` 为项目索引，避免混在同一导航高亮下。
- **组件**：文章列表由 `docs/.vuepress/components/ArticleIndexList` 渲染，样式类 `lk-article-three` 仅在文章索引页使用。
- **发布**：文章 Markdown 在 `docs/article/`，经 VuePress 构建；项目长文在 `docs/tech/`。

## 2. 打开文章列表

[前往文章列表 →](/article/)

