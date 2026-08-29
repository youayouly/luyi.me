#!/usr/bin/env node
/**
 * 密钥格式扫描。默认扫**暂存区**，供 pre-commit hook 用。
 *
 * 为什么需要它：public 仓库 `youayouly/luyi.me` 现在是正式站的部署源，
 * 提交即公开，没有中间环节可以拦。此前那道闸在 `sync-public-mirror.mjs`
 * 的发布前扫描里，切成单仓库后就没有了，用这个 hook 顶上。
 *
 * 这不是空想的风险：`.claude/settings.local.json` 里的明文 Dify key 曾经
 * 跟着 414 个提交进过公开仓库，2026-08-29 才吊销。
 *
 * 用法：
 *   node scripts/scan-secrets.mjs            # 扫暂存区（hook 用这个）
 *   node scripts/scan-secrets.mjs --all      # 扫整个工作区已跟踪文件
 *   node scripts/scan-secrets.mjs --install  # 安装成 .git/hooks/pre-commit
 *
 * 命中即以非零码退出，pre-commit 会因此中止提交。
 * 确认是误报时用 `git commit --no-verify` 跳过。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')

// GitHub 细粒度 token 前缀写成字符类，否则这个文件会在自己身上命中，
// 每次提交都误报 —— 写 sync-public-mirror.mjs 时踩过一次。
const PATTERNS = [
  [/sk-[A-Za-z0-9]{20,}/, 'OpenAI / SiliconFlow 风格 key'],
  [/ghp_[A-Za-z0-9]{20,}/, 'GitHub personal access token'],
  [/githu[b]_pat_[A-Za-z0-9_]{20,}/, 'GitHub 细粒度 token'],
  [/app-[A-Za-z0-9]{20,}/, 'Dify 应用 key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私钥'],
  // 形如 LK_SITE_PASS=真值 的赋值；空值放过，占位值由下面的 PLACEHOLDER 兜
  [/^(?!#)\s*(LK_SITE_PASS|DIFY_API_KEY|GITHUB_TOKEN|KV_REST_API_TOKEN)\s*=\s*\S{6,}/m, '环境变量里写死了真值'],
]

/**
 * 占位串豁免。必须对**整行**判断而不是值的开头：
 * `.env.example` 里写的是 `GITHUB_TOKEN=ghp_your-github-token-here`，
 * 占位标记在中间，只看开头会把模板文件全判成泄露。
 */
const PLACEHOLDER = /your[-_]|<[a-z-]+>|xxx+|here\b|example|placeholder|replace[-_ ]?with|\*{4,}|change[-_ ]?me/i

const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.zip', '.lnk', '.woff', '.woff2', '.ttf', '.mp4', '.pdf',
])
/** 词典是机器生成的大文件，且只含译文 */
const SKIP_FILES = new Set(['package-lock.json', 'docs/.vuepress/public/i18n/en.json'])

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function targets() {
  if (process.argv.includes('--all')) {
    return git(['ls-files']).split('\n').filter(Boolean)
  }
  // 只看新增/修改，删除的没必要扫
  return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean)
}

function install() {
  const hookDir = path.join(REPO, '.git', 'hooks')
  if (!fs.existsSync(hookDir)) {
    console.error('[scan] 找不到 .git/hooks，当前目录不是 git 仓库？')
    process.exit(1)
  }
  const hook = path.join(hookDir, 'pre-commit')
  fs.writeFileSync(
    hook,
    '#!/bin/sh\n# 由 scripts/scan-secrets.mjs --install 生成\nexec node scripts/scan-secrets.mjs\n',
    { mode: 0o755 },
  )
  console.log(`[scan] 已安装 ${path.relative(REPO, hook)}`)
}

function main() {
  if (process.argv.includes('--install')) return install()

  const files = targets()
  if (!files.length) {
    console.log('[scan] 暂存区没有要扫的文件')
    return
  }

  const hits = []
  for (const rel of files) {
    if (SKIP_FILES.has(rel)) continue
    if (SKIP_EXT.has(path.extname(rel).toLowerCase())) continue
    const full = path.join(REPO, rel)
    if (!fs.existsSync(full)) continue
    if (fs.statSync(full).size > 4 * 1024 * 1024) continue

    const lines = fs.readFileSync(full, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (PLACEHOLDER.test(line)) return
      for (const [re, label] of PATTERNS) {
        const m = line.match(re)
        if (!m) continue
        // 输出时截断命中片段，别把密钥完整打进终端历史
        const shown = m[0].length > 12 ? m[0].slice(0, 8) + '…' : m[0]
        hits.push(`${rel}:${i + 1}  ${label}  (${shown})`)
        break
      }
    })
  }

  if (!hits.length) {
    console.log(`[scan] ✓ ${files.length} 个文件，未发现密钥`)
    return
  }

  console.error(`\n[scan] ✗ 发现 ${hits.length} 处疑似密钥，已中止提交：\n`)
  for (const h of hits) console.error('  ' + h)
  console.error(`
这个仓库的提交会直接公开（public 是正式站的部署源）。
把值挪进 .env.local（已被 .gitignore 忽略），或确认是误报后用：

  git commit --no-verify
`)
  process.exit(1)
}

main()
