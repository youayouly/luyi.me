---
title: ApplyScribe 留学文书 RAG 工作台
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# ApplyScribe 留学文书 RAG 工作台

ApplyScribe 是一套面向留学申请文书的写作工作台。它把往届文书、学生原始材料和院校项目库分别建成可检索的索引，让模型在生成 PS、推荐信、CV 和 school-specific essay 时，每一段都能落回到具体来源。

它不做“把旧文书改几个词”这件事。目标是从归档样本里学结构、语气和证据组织方式，再基于当前学生的真实事实重新写一遍。

## 1. 要解决什么问题

文书这件事的难点不在于让模型写出通顺的英文，而在于**它太容易写出看起来漂亮但没有依据的句子**。

- 学生的 GPA、排名、论文、实习散落在几十份 PDF、DOCX 和表格里，人工整理一遍就要几小时。
- 模型不知道哪些是这个学生真实发生过的事，于是把常见模板句当成事实写进去。
- 顾问回头想核对某句话的出处时，没有任何线索可查。

所以这个项目的核心不是“生成”，而是**先把事实和参考材料变成可检索的东西，再让生成过程只能引用检索到的内容**。

## 2. 检索层：三套索引，各管一件事

`src/lib/rag/paths.ts` 里定义了三条独立的索引线，它们的来源和用途完全不同：

| 索引 | 来源目录 | 作用 |
| --- | --- | --- |
| reference | `data/rag-index` | 往届文书与范文，提供结构与语气参考 |
| material | `data/rag-index-materials` | 当前学生上传的材料，提供可引用的事实 |
| kb | `data/rag-index-kb` | 院校/项目知识库，提供 program 侧要求 |

分开的原因很直接：**事实和范文不能混在一个池子里检索**。一旦混了，模型会把范文里别人的经历当成本人的事实召回，这正是幻觉最集中的地方。

三套索引都走 `src/lib/rag/index.js` 的同一套构建逻辑，但各自有独立的 source root 和 output dir，互不污染。

## 3. 检索实现：自建，不依赖向量数据库

`src/lib/rag/index.js` 和 `search.ts` 里没有 embedding API，也没有 Chroma / Pinecone 这类外部依赖。做法是：

1. 分段切块（`chunkText`），保留 section、field 等结构元信息。
2. 对 token 做 SHA1 hash 映射到 512 维（`hashToken` / `buildVector`），得到归一化的稀疏投影向量。
3. 同时抽取 signature tokens 作为稀疏侧信号。
4. 查询时把两路加权合并（`search.ts:300`，向量项权重 `0.58`），再按分数排序。

**这是一个刻意的取舍。** 好处是索引可以完全离线构建、无 API 成本、构建速度只受磁盘限制；代价是语义泛化能力弱于真正的 dense embedding——同义改写召回不如 `text-embedding-3-large`。

对这个场景够用的原因在于：文书检索里查询词和源文本高度同域（专业名、学校名、经历关键词大量原样出现），词面重合本身就是强信号。

索引支持增量更新（`patchRagIndex`），新上传一份材料不需要整体重建；`index-cache.ts` 把解析结果常驻内存，避免每次请求都读盘。

## 4. 生成侧

检索结果不是直接塞进 prompt 就完事。`src/lib/` 下的生成链路拆成了几段独立可测的步骤：

- `extract-facts` — 先从材料里抽结构化事实，作为后续所有生成的唯一事实来源。
- `evidence-matrix.ts` — 把事实与目标 program 的要求对齐，暴露出「哪条要求没有证据支撑」。
- `generate-pack` / `manuscript-draft` — 先出提纲再出稿，草稿携带指回源 chunk 的引用。
- `polish` — 独立的自然度与语气打磨过程，不再接触事实层。
- `llm-stream.ts` — 流式输出，长文生成时前端不空等。

把「抽事实」和「写句子」拆开，是为了让幻觉有地方被拦住：写作步骤拿不到原始材料，只能用上一步已经核验过的事实。

## 5. 材料解析与导出

留学材料的格式是杂的，所以解析层堆了不少实际工作：`pdf-parse` 处理 PDF，`mammoth` 处理 DOCX，`tesseract.js` 兜底扫描件 OCR，`iconv-lite` 处理国内材料常见的 GBK 编码。

导出侧用 `docx` 和 `pdfkit` 直接生成可编辑的交付物，编辑器基于 TipTap。整站是 Next.js App Router，`src/app/api/` 下有 40+ 条 route。

## 6. 现状与边界

已经跑通的是完整链路：材料上传 → 解析入库 → 建索引 → 检索 → 抽事实 → 生成 → 打磨 → 导出 DOCX/PDF。此外还有 CV builder、CV review、JD 匹配、院校项目库爬取与校验等若干横向模块。

明确没做的：没有多租户和账号体系，是单人本地工作台；检索走的是自建 hash 向量而非语义 embedding，语义泛化有上限；院校库依赖外部数据源，URL 需要定期跑校验脚本。

<!-- sync-setup-start -->

<div class="lk-project-setup-private" data-lk-auth-only>

## 搭建速查

**源码**：私有仓库，暂不对外开放。

**访问（作者本机）**：`http://localhost:3100/`（访客无法直接打开）

| 项 | 说明 |
| --- | --- |
| 启动 | `npm run dev` |
| 访问 | http://localhost:3100/ |
| 端口 | 3100 |
| 环境变量 | OPENAI_API_KEY；LLM_MODEL / EMBEDDING_MODEL；DEEPSEEK_API_KEY（中译英，可选） |
| 备注 | 首次运行需先建索引：npm run rag:index / rag:index:kb；索引产物写在 data/rag-index*，不入库。 |

_本节由 `npm run sync:projects` 根据外部仓库 `blog-project.json` 自动更新；仅登录后可见。_

</div>

<!-- sync-setup-end -->
