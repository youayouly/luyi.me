#!/usr/bin/env node
/**
 * 文章索引生成器。
 *
 * `ArticleIndexList.vue`（/article/ 列表）和 `AboutMePage.vue`（"最近写过的"）
 * 以前各自手写一份文章数组，发新文章要记得改两个地方（外加 `data/aboutArticleFeed.js`
 * 的推荐卡，那个仍然手维，见下方"跳过 recommendedArticles"）。忘改就会出现文章已经
 * 发布、但两处列表都看不到的情况——跟 CLAUDE.md 里记录的「发布不进列表」是同一类坑，
 * 这个脚本把「文章列表从哪来」收回到 `docs/article/*.md` 自己的 frontmatter 里，
 * 别处只读生成结果，不再手抄。
 *
 * 用法：
 *   node scripts/sync-article-index.mjs          # 生成 + 打印 recommendedArticles 漂移警告
 *   node scripts/sync-article-index.mjs --check   # 只检查，不写文件；CI/发布前用
 *
 * 读取 docs/article/*.md（除 README.md）的 frontmatter：
 *   title (必填) / date (必填) / description (作为 excerpt，缺了警告，不挡生成)
 *   cover (缺省用 FALLBACK_COVER) / tags (缺省 []) / pinned (缺省 false)
 *
 * 写出 docs/.vuepress/data/articleIndex.generated.js，导出 `articles`。
 * `ArticleIndexList.vue` 和 `AboutMePage.vue` 都改成 import 这份数据，不再各自硬编码。
 *
 * 跳过 recommendedArticles：`data/aboutArticleFeed.js` 里首页推荐卡用的是专门生成的
 * `/gallery/home-rec-*.png` 系列封面和单独打磨过的摘要，跟文章列表的封面/摘要不是同一
 * 套素材，继续手维；这个脚本只做「引用的 slug 是否还存在、标题/日期是否跟文章本身对上」
 * 的漂移检查，对不上打印警告，不自动改这个文件——避免打磨过的文案被覆盖成通用摘要。
 *
 * 不在 docs/article/ 目录下的例外条目（比如挂在 /tech/ 下但也想出现在文章列表里的），
 * 走 EXTRA_ENTRIES 手工补一条，别为了这一条把扫描范围扩大到整个 docs/ 目录。
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const articleDir = path.join(root, 'docs/article')
const outFile = path.join(root, 'docs/.vuepress/data/articleIndex.generated.js')
const feedFile = path.join(root, 'docs/.vuepress/data/aboutArticleFeed.js')
/*
 * lib/ 里的这份 JSON 是给 docs/api/assistant.js 当 grounding 数据用的——那个文件是
 * CommonJS 的 Serverless Function，不能直接 import articleIndex.generated.js
 * （那是 `export const` 的 ESM 语法，Node 原生加载器在没有 "type":"module" 的
 * 情况下会把 .js 当 CommonJS 解析，直接 require/import 会炸）。JSON 没有这个问题，
 * 且只留 AI 助手 prompt 用得上的字段，体积比完整 articleIndex 小。
 */
const briefFile = path.join(root, 'lib/lk-article-brief.generated.json')

const FALLBACK_COVER = '/gallery/article-cover-1.png'
const CHECK_ONLY = process.argv.includes('--check')

/** 不在 docs/article/ 下、但也要出现在文章列表里的例外条目——目前只有这一条。 */
const EXTRA_ENTRIES = [
  {
    slug: 'my-blog',
    href: '/tech/my-blog.html',
    cover: '/gallery/article-soft-openclaw.png',
    date: '2026-03-20 18:30',
    title: 'Personal Blog：Projects 文档',
    excerpt: '本站技术栏与组件地图的完整说明，归类在 Projects 分区，列表里一并收录便于检索。',
    tags: ['Meta'],
    external: true,
  },
]

/**
 * 极简 frontmatter 解析：项目里没有 gray-matter 之类的依赖（api/ 那套零依赖习惯延续到
 * scripts/），这里的 frontmatter 也只有「一行一个 key: value」和一种数组写法
 * `key: [a, b, c]`，手写几行正则够用，不必为此新增依赖。
 */
/** 去掉一层包裹引号；双引号形式还原 \" 和 \\ 转义（发布接口用 yamlString() 写的就是这种）。 */
function unquote(s) {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1)
  }
  return s
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter(Boolean)
    } else if (value === 'true' || value === 'false') {
      data[key] = value === 'true'
    } else {
      data[key] = unquote(value)
    }
  }
  return data
}

function readArticles() {
  const files = fs
    .readdirSync(articleDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')

  const articles = []
  for (const file of files) {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(articleDir, file), 'utf-8')
    const fm = parseFrontmatter(raw)
    if (!fm || !fm.title || !fm.date) {
      console.warn(`[sync-article-index] 跳过 ${file}：frontmatter 缺 title 或 date`)
      continue
    }
    if (!fm.description) {
      console.warn(`[sync-article-index] ${file} 没有 description，excerpt 会是空字符串`)
    }
    articles.push({
      slug,
      href: `/article/${slug}.html`,
      cover: fm.cover || FALLBACK_COVER,
      date: fm.date,
      title: fm.title,
      excerpt: fm.description || '',
      tags: fm.tags || [],
      ...(fm.pinned ? { pinned: true } : {}),
    })
  }
  return [...articles, ...EXTRA_ENTRIES]
}

/** recommendedArticles 手维，这里只检查它引用的文章是否还在、标题/日期有没有漂移。 */
function checkRecommendedDrift(articles) {
  if (!fs.existsSync(feedFile)) return
  const raw = fs.readFileSync(feedFile, 'utf-8')
  const bySlugOrHref = new Map(articles.map((a) => [a.href, a]))

  const hrefRe = /href:\s*'([^']+)'/g
  const titleRe = /title:\s*'((?:[^'\\]|\\.)*)'/g
  const dateRe = /date:\s*'([^']+)'/g

  const hrefs = [...raw.matchAll(hrefRe)].map((m) => m[1])
  const titles = [...raw.matchAll(titleRe)].map((m) => m[1])
  const dates = [...raw.matchAll(dateRe)].map((m) => m[1])

  hrefs.forEach((href, i) => {
    // 只关心指向具体文章的条目；'/article/' 本身是指向列表页的链接，不是某一篇文章
    if (!href.startsWith('/article/') || href === '/article/') return
    const real = bySlugOrHref.get(href)
    if (!real) {
      console.warn(`[sync-article-index] recommendedArticles 引用了不存在的文章：${href}`)
      return
    }
    if (titles[i] && titles[i] !== real.title) {
      console.warn(
        `[sync-article-index] recommendedArticles 标题跟文章本身不一致：${href}\n` +
          `  推荐卡里是：${titles[i]}\n  文章本身是：${real.title}`,
      )
    }
    if (dates[i] && dates[i].slice(0, 10) !== String(real.date).slice(0, 10)) {
      console.warn(
        `[sync-article-index] recommendedArticles 日期跟文章本身不一致：${href}（${dates[i]} vs ${real.date}）`,
      )
    }
  })
}

function writeGenerated(articles) {
  const body = articles
    .map((a) => {
      const fields = [
        `    slug: ${JSON.stringify(a.slug)},`,
        `    href: ${JSON.stringify(a.href)},`,
        `    cover: ${JSON.stringify(a.cover)},`,
        `    date: ${JSON.stringify(a.date)},`,
        `    title: ${JSON.stringify(a.title)},`,
        `    excerpt: ${JSON.stringify(a.excerpt)},`,
        `    tags: ${JSON.stringify(a.tags)},`,
      ]
      if (a.pinned) fields.push('    pinned: true,')
      if (a.external) fields.push('    external: true,')
      return `  {\n${fields.join('\n')}\n  }`
    })
    .join(',\n')

  const content = `/**
 * 由 scripts/sync-article-index.mjs 生成，读的是 docs/article/*.md 的 frontmatter。
 * 别手改——改了下次跑脚本会被覆盖。想改内容去改对应文章的 frontmatter
 * （title / description / date / cover / tags / pinned），例外条目改脚本里的 EXTRA_ENTRIES。
 */
export const articles = [
${body},
]
`
  fs.writeFileSync(outFile, content, 'utf-8')
}

function writeAssistantBrief(articles) {
  const brief = articles.map((a) => ({
    title: a.title,
    excerpt: a.excerpt,
    tags: a.tags,
    href: a.href,
  }))
  fs.writeFileSync(briefFile, JSON.stringify(brief, null, 2) + '\n', 'utf-8')
}

const articles = readArticles()
checkRecommendedDrift(articles)

if (CHECK_ONLY) {
  console.log(`[sync-article-index] --check：读到 ${articles.length} 篇，未写文件`)
} else {
  writeGenerated(articles)
  writeAssistantBrief(articles)
  console.log(`[sync-article-index] 已生成 ${outFile}（${articles.length} 篇）`)
}
