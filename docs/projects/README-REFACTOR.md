---
title: Projects 改版说明
comment: false
toc: false
sidebar: false
---

# Projects 改版说明

当前方向是不再单独维护 `/pm/` 页面，而是把产品经理相关内容直接并入 `/tech/` 的主项目页。

主要文件：

- `docs/tech/README.md`
- `docs/.vuepress/components/ProductManagerCases.vue`
- `docs/.vuepress/client.js`

保留原则：

- `/tech/` 仍然是 Projects 主入口
- 原有项目列表继续保留
- PM 案例和项目列表保持统一的卡片语言
- 不新增独立的 `/pm/` 入口
