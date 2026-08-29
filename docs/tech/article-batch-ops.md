---
title: 文章批量操作
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# 文章批量操作

项目卡片入口说明：登录后在文章列表侧栏使用批量选择与「标记待删除」，减少一篇篇点开的重复劳动；真正删除在推送时与 [博客发布工作流](/tech/git-release-map.html) 一并生效。

## 1. 是什么

- **入口**：`/article/` 文章索引（及文章子路径）右侧栏「批量操作」卡片。
- **能力**：进入批量模式后为列表项注入勾选框，支持全选、清空、将多篇标记为待删除；预览文会提示从待推送列表处理。
- **权限**：需登录；未登录时不显示侧栏批量 UI。

## 2. 与发布的关系

批量删除不会立刻改仓库文件，而是写入待删除队列，由发布浮层在推送时一次性提交。这与发布地图里「批量发布当作一个事务」的思路一致：先本地选清、再统一推送，避免半成品状态上线。

更完整的阶段划分（暂存、构建、Vercel）见 [Git 发布流水线](/tech/git-release-map.html)。

## 3. 实现要点

- **组件**：`docs/.vuepress/components/ArticleBatchOps.vue`，经 `ArticleBatchOpsClient` 全局注册。
- **列表项**：`ArticleIndexList` 渲染的 `.lk-blog__item[data-slug]` 供勾选与计数。
- **事件**：推送完成后监听 `publish-push-finished`，刷新待删除计数与提示。

## 4. 打开文章列表

[前往文章列表 →](/article/)
