---
title: AI 基础设施笔记
description: Agent、MCP、Dify/Coze 与外部工具——把大模型从「能聊天」推到「能干活」时需要哪些零件。
date: 2026-04-22T04:01:01.517Z
cover: /gallery/article-soft-agent-workflow.png
tags: [Agent, Infra]
pageClass: page-article-post
comment: false
toc: true
---

# AI 基础设施笔记

::: tip 摘要
这篇不是某一家产品的教程，而是我在搭 AI 工作流时用的**分层地图**：模型在上，Agent 编排在中，MCP / 低代码平台 / 外部工具在下。
:::

## 1. 大模型层

- **职责**：理解意图、生成文本/代码、做规划草案。
- **实践**：Key 不要散落在每个客户端；优先走 [One API 统一网关](/article/ai-key-router-one-api-zcode-ccswitch.html)。

## 2. 客户端编排（LangChain 等）

LangChain 一类框架解决的是「怎么把模型嵌进程序」：

| 能力 | 说明 |
| --- | --- |
| **Agent** | 决定何时查资料、何时写代码、何时交给人工 |
| **Memory** | 跨轮对话保留上下文（窗口、摘要、向量库） |
| **Chains** | 固定流水线：翻译 → 检索 → 总结 |

早期 Chain 每一步都要人写死；现在更常见的是 **由模型根据工具描述自己选动作**，Chain 退化成兜底流程。

## 3. 低代码 / 可视化平台

### Dify

适合快速搭 RAG、工作流、对外 API。优点是上线快；缺点是复杂分支和版本管理要自律。

### Coze

偏 Bot 形态和渠道分发。适合验证对话产品，不一定适合深度定制工程。

## 4. MCP：统一的「工具说明书」

**MCP Server** 对外暴露 JSON 形态的能力描述；**Host** 负责翻译成各模型喜欢的格式（OpenAI tools、Claude XML 等）。

好处：

- 同一套工具，换模型不用重写集成层。
- Skill 可以组合：检索、文件、浏览器、内部 API 各成一个 Server。

## 5. 外部工具

典型外挂：

- **Midjourney** — 生图
- **Figma / 墨刀** — 原型与视觉稿

Agent 的价值在于：**知道什么时候该调用哪一类工具**，而不是把所有能力塞进一个 prompt。

## 6. AI Agent 小结

> 规划（Planning）+ 记忆（Memory）+ 工具使用（Tools / Skills）

若某个 Skill 能按 cron 稳定执行，就不必每回都靠人类对话触发——这也是从 Demo 走向「小自动化」的分水岭。

## 7. 和本站其他文章的关系

- 本地先把环境跑通 → [OpenClaw 本地搭建](/article/openclaw.html)
- Key 与网关 → [AI Key 路由](/article/ai-key-router-one-api-zcode-ccswitch.html)
- 跟 AI 协作时的提问结构 → [AI 提示词模板](/article/ai模板.html)

---

*Last updated: 2026-04-22*
