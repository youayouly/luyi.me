#!/usr/bin/env node
/**
 * 检测发布后的状态
 * 用于调试：检查 GitHub 上的文件是否正确创建
 */

import { execSync } from 'child_process'

console.log('=== 发布状态检测 ===\n')

// 1. 检查本地文件状态
console.log('📁 本地文章文件：')
const localFiles = execSync('ls -la docs/article/*.md 2>/dev/null || echo "无文件"', { encoding: 'utf-8' })
console.log(localFiles)

// 2. 检查本地 README.md 文章数量
console.log('📄 本地 README.md 文章数量：')
const localCount = execSync('grep -c "lk-blog__item" docs/article/README.md 2>/dev/null || echo "0"', { encoding: 'utf-8' })
console.log(`  ${localCount.trim()} 篇文章\n`)

// 3. 检查远程状态
console.log('🌐 同步远程状态...')
try {
  execSync('git fetch origin', { encoding: 'utf-8' })

  console.log('📁 远程文章文件：')
  const remoteFiles = execSync('git ls-tree -r origin/main --name-only | grep "docs/article/.*\\.md$"', { encoding: 'utf-8' })
  console.log(remoteFiles)

  console.log('📄 远程 README.md 文章数量：')
  const remoteCount = execSync('git show origin/main:docs/article/README.md 2>/dev/null | grep -c "lk-blog__item" || echo "0"', { encoding: 'utf-8' })
  console.log(`  ${remoteCount.trim()} 篇文章\n`)

  // 4. 比较本地和远程
  console.log('📊 本地 vs 远程：')
  const local = parseInt(localCount.trim()) || 0
  const remote = parseInt(remoteCount.trim()) || 0

  if (local < remote) {
    console.log(`  ⚠️ 本地落后远程 ${remote - local} 篇文章，需要 git pull`)
    console.log('  执行: git pull origin main')
  } else if (local > remote) {
    console.log(`  ⚠️ 本地领先远程 ${local - remote} 篇文章`)
  } else {
    console.log('  ✅ 本地与远程同步')
  }
} catch (e) {
  console.log('  ❌ 无法获取远程状态:', e.message)
}

console.log('\n=== 检测完成 ===')
