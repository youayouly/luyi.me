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
const readmePath = path.join(articleDir, 'README.md')

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

// 获取README中已列出的文章
function getListedArticles() {
  if (!fs.existsSync(readmePath)) return []
  const content = fs.readFileSync(readmePath, 'utf-8')
  const matches = content.matchAll(/href="\/article\/([a-z0-9-]+)\.html"/g)
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

  const content = `---
title: ${title || slug}
date: ${dateStr}
---

# ${title || slug}

<!-- 在这里编写文章内容 -->
`

  fs.writeFileSync(filePath, content, 'utf-8')
  log('green', `✓ 创建文章: ${filePath}`)

  // 更新README列表
  updateReadmeList(slug, title || slug, dateStr)

  log('green', `✓ 已更新文章列表`)
  log('blue', `\n提示: 运行 'npm run dev' 预览，满意后运行 'node scripts/article.mjs push' 推送`)
}

// 更新README列表 - 在第一个li之前插入（时间倒序）
function updateReadmeList(slug, title, dateStr) {
  let content = fs.readFileSync(readmePath, 'utf-8')

  // 检查是否已存在
  if (content.includes(`href="/article/${slug}.html"`)) {
    log('yellow', `  文章 ${slug} 已在列表中`)
    return
  }

  // 新文章HTML - 注意：不能有空行，否则VuePress会错误解析
  const newItem = `<li class="lk-blog__item">
      <a class="lk-blog__card" href="/article/${slug}.html">
        <img class="lk-blog__cover" src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80" alt="" />
        <div class="lk-blog__text">
          <time class="lk-blog__date" datetime="${dateStr.slice(0, 10)}">${dateStr}</time>
          <h3 class="lk-blog__post-title">${title}</h3>
          <p class="lk-blog__excerpt">${title}</p>
          <div class="lk-blog__meta">
            <span class="lk-blog__read" aria-hidden="true">Read →</span>
          </div>
        </div>
      </a>
    </li>`

  // 在 <ol class="lk-blog__list"> 后面插入，紧贴第一个 <li>
  const listStart = content.indexOf('<ol class="lk-blog__list">')
  if (listStart === -1) {
    log('red', '错误: 找不到文章列表位置')
    process.exit(1)
  }

  // 找到 </li> 后直接插入，确保没有空行
  const firstLiEnd = content.indexOf('</li>', listStart)
  if (firstLiEnd === -1) {
    // 如果没有现有文章，在 <ol> 后直接插入
    const insertPos = content.indexOf('>', listStart) + 1
    content = content.slice(0, insertPos) + '\n    ' + newItem + content.slice(insertPos)
  } else {
    // 在第一个 </li> 后插入，紧跟其后
    const insertPos = firstLiEnd + 5  // </li> 长度为5
    content = content.slice(0, insertPos) + newItem + content.slice(insertPos)
  }

  fs.writeFileSync(readmePath, content, 'utf-8')
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
