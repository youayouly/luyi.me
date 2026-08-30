#!/usr/bin/env node
/**
 * 文章管理工具
 *
 * 用法:
 *   node scripts/article.mjs new <slug> [title]   # 创建新文章
 *   node scripts/article.mjs list                  # 列出所有文章（本地+未推送）
 *   node scripts/article.mjs push [message]        # 推送所有未提交的文章
 *   node scripts/article.mjs status                # 查看状态
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const articleDir = path.join(root, 'docs/article')
const generatedIndexPath = path.join(root, 'docs/.vuepress/data/articleIndex.generated.js')

// 颜色输出
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(color, msg) {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

// 获取所有本地文章
function getLocalArticles() {
  const files = fs.readdirSync(articleDir)
  return files
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .map(f => f.replace('.md', ''))
    .sort()
}

// 获取已提交到git的文章
function getGitTrackedArticles() {
  try {
    const output = execSync('git ls-files docs/article/*.md', {
      encoding: 'utf-8',
      cwd: root
    })
    return output
      .split('\n')
      .filter(f => f && !f.endsWith('README.md'))
      .map(f => path.basename(f, '.md'))
  } catch {
    return []
  }
}

// 获取已生成进文章索引的文章——那份数据从 frontmatter 生成，见
// scripts/sync-article-index.mjs；这里不再读 README（它已经不含文章列表了）。
function getListedArticles() {
  if (!fs.existsSync(generatedIndexPath)) return []
  const content = fs.readFileSync(generatedIndexPath, 'utf-8')
  const matches = content.matchAll(/slug: "([^"]+)"/g)
  return [...new Set([...matches].map(m => m[1]))]
}

// 创建新文章
function createArticle(slug, title) {
  const filePath = path.join(articleDir, `${slug}.md`)

  if (fs.existsSync(filePath)) {
    log('red', `错误: 文章 ${slug} 已存在`)
    process.exit(1)
  }

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 16).replace('T', ' ')

  // description/cover/tags 留了占位——scripts/sync-article-index.mjs 靠这几项
  // 生成 /article/ 列表、首页推荐和关于我页「最近写过的」，写之前记得填一下，
  // 尤其是 description（缺了那边只会警告，excerpt 就是空的，不会挡生成）。
  const content = `---
title: ${title || slug}
description: TODO 一句话摘要
date: ${dateStr}
cover: /gallery/article-cover-1.png
tags: [TODO]
pageClass: page-article-post
comment: false
toc: true
---

# ${title || slug}

<!-- 在这里编写文章内容 -->
`

  fs.writeFileSync(filePath, content, 'utf-8')
  log('green', `✓ 创建文章: ${filePath}`)

  // 文章列表不再是手改 README，而是从 frontmatter 生成——见
  // scripts/sync-article-index.mjs。这里跑一次让本地预览立刻看到新文章，
  // 'npm run dev' / 'npm run build' 也会各自跑一次，不追加跑这次也不会漏。
  try {
    execSync('node scripts/sync-article-index.mjs', { cwd: root, stdio: 'inherit' })
  } catch {
    log('yellow', '  文章索引生成失败，运行 npm run sync:articles 手动补一次')
  }

  log('blue', `\n提示: 记得把 frontmatter 里的 description/cover/tags 填好，再运行 'npm run dev' 预览，满意后运行 'node scripts/article.mjs push' 推送`)
}

// 显示状态
function showStatus() {
  const local = getLocalArticles()
  const tracked = getGitTrackedArticles()
  const listed = getListedArticles()

  const untracked = local.filter(a => !tracked.includes(a))
  const unlisted = local.filter(a => !listed.includes(a))

  console.log('\n=== 文章状态 ===\n')

  if (untracked.length > 0) {
    log('yellow', `📝 未推送到Git (${untracked.length}):`)
    untracked.forEach(a => console.log(`   - ${a}`))
    console.log()
  }

  if (unlisted.length > 0) {
    log('yellow', `📋 未加入列表 (${unlisted.length}):`)
    unlisted.forEach(a => console.log(`   - ${a}`))
    console.log()
  }

  log('green', `✓ 已同步文章 (${tracked.length}):`)
  tracked.forEach(a => console.log(`   - ${a}`))

  console.log()
}

// 列出所有文章
function listArticles() {
  const local = getLocalArticles()
  const tracked = getGitTrackedArticles()

  console.log('\n=== 本地文章 ===\n')

  local.forEach(slug => {
    const isTracked = tracked.includes(slug)
    const status = isTracked ? `${colors.green}[已推送]${colors.reset}` : `${colors.yellow}[待推送]${colors.reset}`
    console.log(`  ${slug} ${status}`)
  })

  console.log()
}

// 推送文章
function pushArticles(message) {
  const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: root })

  if (!status.trim()) {
    log('yellow', '没有需要提交的更改')
    process.exit(0)
  }

  console.log('\n=== 待提交更改 ===\n')
  console.log(status)

  // 显示未追踪的新文章
  const lines = status.split('\n').filter(l => l.trim())
  const newArticles = lines
    .filter(l => l.startsWith('??') && l.includes('docs/article/') && l.endsWith('.md') && !l.includes('README'))
    .map(l => path.basename(l.split(' ')[1], '.md'))

  const modifiedFiles = lines.filter(l => !l.startsWith('??')).length

  if (newArticles.length > 0) {
    log('blue', `\n新文章 (${newArticles.length}):`)
    newArticles.forEach(a => console.log(`  - ${a}`))
  }

  const commitMsg = message || `更新文章: ${newArticles.join(', ') || `${modifiedFiles}个文件修改`}`

  console.log(`\n提交信息: ${commitMsg}`)
  console.log()

  // 执行git操作
  const cmds = [
    'git add docs/article/*.md docs/.vuepress/config.js',
    `git commit -m "${commitMsg}"`,
    'git pull --rebase origin main',
    'git push origin main'
  ]

  for (const cmd of cmds) {
    try {
      console.log(`> ${cmd}`)
      execSync(cmd, { encoding: 'utf-8', stdio: 'inherit', cwd: root })
    } catch (e) {
      if (cmd.includes('pull --rebase')) {
        // rebase冲突时先stash
        log('yellow', '检测到未暂存文件，先暂存...')
        execSync('git stash', { encoding: 'utf-8', cwd: root })
        execSync('git pull --rebase origin main', { encoding: 'utf-8', stdio: 'inherit', cwd: root })
        execSync('git stash pop', { encoding: 'utf-8', cwd: root })
      } else if (!cmd.includes('push')) {
        throw e
      }
    }
  }

  log('green', '\n✓ 推送成功！Vercel将自动部署')
}

// 主入口
const [,, cmd, ...args] = process.argv

switch (cmd) {
  case 'new':
    if (!args[0]) {
      log('red', '用法: node scripts/article.mjs new <slug> [title]')
      process.exit(1)
    }
    createArticle(args[0], args[1])
    break

  case 'list':
    listArticles()
    break

  case 'status':
    showStatus()
    break

  case 'push':
    pushArticles(args[0])
    break

  default:
    console.log(`
文章管理工具

用法:
  node scripts/article.mjs new <slug> [title]   创建新文章
  node scripts/article.mjs list                  列出所有文章
  node scripts/article.mjs status                查看状态
  node scripts/article.mjs push [message]        推送所有更改

示例:
  node scripts/article.mjs new my-article "我的文章"
  node scripts/article.mjs push "添加新文章"
`)
}
