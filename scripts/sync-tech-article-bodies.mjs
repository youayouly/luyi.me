/**
 * 将 /article/ 正文合并进 /tech/ 包装页，并统一 pageClass: page-article-post。
 * 用法: node scripts/sync-tech-article-bodies.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const techDir = path.join(root, 'docs/tech')
const articleDir = path.join(root, 'docs/article')

/** @type {[string, string][]} techSlug -> article filename (no dir) */
const PAIRS = [
  ['git-release-map', 'git-release-map.md'],
  ['ai-key-router', 'ai-key-router-one-api-zcode-ccswitch.md'],
  ['pm-portfolio-prd', 'pm-portfolio-prd.md'],
  ['pm-projects-pagination', 'pm-projects-pagination-galaxy.md'],
  ['vuepress-stack-notes', 'vuepress-stack-notes.md'],
  ['ai-prompt-templates', 'ai模板.md'],
]

function parseMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.startsWith('---')) return { fm: {}, body: raw.trim() }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { fm: {}, body: raw.trim() }
  const fmBlock = raw.slice(4, end)
  const body = raw.slice(end + 4).replace(/^\s+/, '')
  const fm = {}
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/)
    if (m) fm[m[1]] = m[2].trim()
  }
  return { fm, body }
}

function buildTechFrontmatter(techFm, articleFm) {
  const lines = ['---']
  const title = techFm.title || articleFm.title || '项目'
  lines.push(`title: ${title}`)
  lines.push('pageClass: page-article-post')
  if (articleFm.description) lines.push(`description: ${articleFm.description}`)
  if (articleFm.date) lines.push(`date: ${articleFm.date}`)
  lines.push('comment: false')
  lines.push(`toc: ${articleFm.toc === 'false' ? 'false' : 'true'}`)
  lines.push('sidebar: true')
  lines.push('---')
  return lines.join('\n')
}

for (const [techSlug, articleFile] of PAIRS) {
  const techPath = path.join(techDir, `${techSlug}.md`)
  const articlePath = path.join(articleDir, articleFile)
  if (!fs.existsSync(techPath) || !fs.existsSync(articlePath)) {
    console.warn(`[skip] missing ${techSlug} or ${articleFile}`)
    continue
  }
  const tech = parseMarkdown(techPath)
  const article = parseMarkdown(articlePath)
  const out = `${buildTechFrontmatter(tech.fm, article.fm)}\n\n${article.body.trim()}\n`
  fs.writeFileSync(techPath, out, 'utf8')
  console.log(`[ok] ${techSlug} <- ${articleFile}`)
}

// 其余原生项目详情：仅统一 pageClass（保留正文）
const skip = new Set(['README', ...PAIRS.map(([s]) => s), 'article-index-hub'])
for (const name of fs.readdirSync(techDir)) {
  if (!name.endsWith('.md') || skip.has(name.replace(/\.md$/, ''))) continue
  const filePath = path.join(techDir, name)
  let text = fs.readFileSync(filePath, 'utf8')
  if (!text.includes('page-project-post')) continue
  text = text.replace(/^pageClass:\s*page-project-post\s*$/m, 'pageClass: page-article-post')
  fs.writeFileSync(filePath, text, 'utf8')
  console.log(`[fm] ${name}`)
}

// article-index-hub：项目视角说明 +  immutability 链到文章列表
const hubPath = path.join(techDir, 'article-index-hub.md')
fs.writeFileSync(
  hubPath,
  `---
title: 文章索引设计
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# 文章索引设计

项目卡片入口说明：文章区使用 \`ArticleIndexList\` 组件做列表、筛选与阅读路径，与项目 hub 的 \`ProjectCardsGrid\` 对称。

## 设计要点

- **分区**：\`/article/\` 为文章索引；\`/tech/\` 为项目索引，避免混在同一导航高亮下。
- **组件**：文章列表由 \`docs/.vuepress/components/ArticleIndexList\` 渲染，样式类 \`lk-article-three\` 仅在文章索引页使用。
- **发布**：文章 Markdown 在 \`docs/article/\`，经 VuePress 构建；项目长文在 \`docs/tech/\`。

## 打开文章列表

[前往文章列表 →](/article/)

`,
  'utf8',
)
console.log('[ok] article-index-hub')
