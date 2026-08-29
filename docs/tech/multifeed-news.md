---
title: MultiFeed 多媒体资讯台
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# MultiFeed 多媒体资讯台

MultiFeed 是一个面向「多源刷资讯 + 看视频」场景的本机聚合台：把 B 站、YouTube 与 RSS 等外部源收进同一套界面，用代理层解决浏览器直连的 CORS 限制，并在列表侧控制翻译成本。

访客在本页看到的是产品叙事与架构说明；本机启动命令、端口与环境变量写在文末 **搭建速查**，仅站点登录后显示。

## 1. 要解决什么问题

日常刷资讯时，内容散落在各平台：视频在 B 站 / YouTube，文字在 RSS 与资讯站。

浏览器里直接 `fetch` 这些外站 API 会撞 CORS，页面无法自己拼出统一的「热榜 + 视频墙」。

另外，若对每条资讯都做全文翻译，token 成本会失控。

所以需要：

1. 在本机做一层聚合与代理，把多源数据收成统一 JSON。
2. 播放仍走各平台官方 iframe，不碰版权与风控红线。
3. 翻译策略要可分级：列表轻量、详情再深译。

## 2. 功能与体验

| 模块 | 作用 |
| --- | --- |
| 视频墙 | 聚合 B 站、YouTube 等源，卡片式浏览 |
| 资讯热榜 | 基于真实 RSS 订阅，展示标题与摘要入口 |
| 标题翻译 | 列表侧批量译标题，控制调用次数 |
| 详情再译 | 进入条目后再译摘要，避免列表阶段浪费 token |
| 订阅预览 | 展开 `<details>` 时局部更新，避免整表重绘导致展开态丢失 |

公网暂无整站 Demo：对外以本页说明与截图为主，不嵌入作者本机服务。

## 3. 架构与原理

```text
外站 API / RSS
    ↓
本机 auth-server（聚合 + 鉴权代理）
    ↓
静态 app.js 页面（列表、热榜、详情）
    ↓
播放：B 站 / YouTube 官方 iframe
```

**代理层**：由本机服务转发请求，浏览器只访问同源接口，从而绕过 CORS。

**数据真实性**：热榜来自实际订阅源，而不是手写假数据。

**翻译路径**：标题走 DeepSeek 批量接口；摘要延迟到详情页，减少无效调用。

**可选 RSSHub**：需要时可在本机再起 RSSHub 实例，把部分源转成统一 RSS。

## 4. 产品取舍

- **列表只译标题**：招聘方 / 访客先扫一眼结构，不被长摘要拖慢。
- **不重绘整表**：订阅预览展开后保持 DOM 状态，避免 UX 抖动。
- **不对外暴露本机地址**：访客看不到 `127.0.0.1` 与 env 表；需要时作者登录后看文末搭建区。
- **不做公网托管**：项目偏个人工作流，展示以 case 叙事 + 截图为主。

## 5. 截图

（待补充：首页视频墙、资讯热榜、后台系统状态截图，路径如 `/gallery/...`）

<!-- sync-setup-start -->

<div class="lk-project-setup-private" data-lk-auth-only>

## 搭建速查

**源码**：[GitHub 仓库](https://github.com/youayouly/news)

**访问（作者本机）**：`http://127.0.0.1:4318/`（访客无法直接打开）

| 项 | 说明 |
| --- | --- |
| 启动 | `npm start` |
| 访问 | http://127.0.0.1:4318/ |
| 端口 | 4318、1200 |
| 环境变量 | HTTPS_PROXY / HTTP_PROXY；TWITTER_AUTH_TOKEN；GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET；YOUTUBE_DATA_API_KEY；BILIBILI_COOKIE；DeepSeek（见 auth-server 配置） |
| 备注 | 勿用 file:// 打开 index.html；可选本机 RSSHub（1200）。仅 B 站/RSS 可用 start-auth-bilibili.ps1。 |

_本节由 `npm run sync:projects` 根据外部仓库 `blog-project.json` 自动更新；仅登录后可见。_

</div>

<!-- sync-setup-end -->
