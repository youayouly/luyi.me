---
title: OpenClaw 本地搭建
description: 在本地用 Python 虚拟环境 + LangChain 跑通第一条大模型调用，方便后续接 Agent 和 MCP。
date: 2026-04-22T04:00:59.216Z
cover: /gallery/article-soft-openclaw.png
tags: [AI, Local]
pageClass: page-article-post
comment: false
toc: true
---

# OpenClaw 本地搭建

::: tip 摘要
OpenClaw 是我给「本地 AI 实验环境」起的名字：先把 Python 依赖、API Key 和最小调用链跑通，再往上叠 Agent、MCP 和自动化脚本。
:::

如果你要在本机玩转大模型，最稳的起步方式仍然是：**独立虚拟环境 → 安装 LangChain → 用 `.env` 管理 Key → 写一条可重复的 smoke test**。

## 1. 创建虚拟环境

避免和系统 Python 或其他项目抢依赖：

```bash
python -m venv venv
# macOS / Linux
source venv/bin/activate
# Windows
venv\Scripts\activate
```

激活后，`which python`（或 `where python`）应指向 `venv` 目录。

## 2. 安装核心库

```bash
pip install -U pip
pip install langchain langchain-openai python-dotenv
```

若后续要接国产模型，可按供应商文档追加对应 SDK；OpenClaw 阶段只要求 **能发一条 Chat Completion 并拿到回复**。

## 3. 配置 API Key

在项目根目录创建 `.env`（不要提交到 Git）：

```env
OPENAI_API_KEY=你的密钥
# 若走 One API / 自建网关，可同时设：
# OPENAI_API_BASE=https://your-gateway/v1
```

`.gitignore` 里应已有 `.env`；若没有，务必补上。

## 4. 最小 smoke test

新建 `scripts/openclaw-smoke.py` 或在 REPL 里跑：

```python
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
print(llm.invoke("用一句话介绍 OpenClaw 本地环境是做什么的").content)
```

能打印出合理回复，说明 **Key、网络、依赖** 三件事都 OK。

## 5. 下一步往哪走

| 阶段 | 目标 | 延伸阅读 |
| --- | --- | --- |
| 路由统一 | 多供应商 Key 进 One API | [AI Key 路由](/article/ai-key-router-one-api-zcode-ccswitch.html) |
| Agent 编排 | Memory / Tool / Chain | [AI 基础设施笔记](/article/langchain.html) |
| 提示词协作 | 可复用模板 | [AI 提示词模板](/article/ai模板.html) |

---

*Last updated: 2026-04-22*
