#!/usr/bin/env node
/**
 * 把本仓库同步到公开镜像 `youayouly/luyi.me`。
 *
 * 为什么是「镜像」而不是直接把本仓库转公开：这个仓库的 414 个提交里几乎
 * 每一个都带着 `.claude/settings.local.json` 中的明文 Dify key（该 key 已
 * 吊销，但历史洗不掉）。`git filter-repo` 会重写全部 SHA，而 Vercel 正跟着
 * 本仓库的分支部署，代价远大于收益。所以公开仓库是一次 orphan 提交起家的
 * 独立仓库，**没有历史**，本仓库退居生产 + 存档。
 *
 * 用法：
 *   node scripts/sync-public-mirror.mjs            # 只同步文件并报告差异，不提交
 *   node scripts/sync-public-mirror.mjs --commit -m "说明"   # 提交
 *   node scripts/sync-public-mirror.mjs --commit --push -m "说明"
 *   node scripts/sync-public-mirror.mjs --dir <路径>  # 换工作目录
 *
 * 依赖已登录的 `gh` 或可用的 git 凭证。首次运行会 clone 公开仓库。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '..')
const REMOTE = 'https://github.com/youayouly/luyi.me.git'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback
}
const has = (name) => process.argv.includes(`--${name}`)

const OUT = arg('dir', path.join(os.tmpdir(), 'lk-public-mirror'))

/**
 * 不同步到公开仓库的东西。
 * 前半段是「私人内容」，后半段是「绝不能外流」的兜底——即使某天 .gitignore
 * 漏了，这里也拦得住。
 */
const DROP = [
  /^workspace\//, //                       私人笔记、daily 总结、checkpoint
  /^\.claude\/workflows\//, //             引用的脚本早已不存在，会误导人
  /^\.cursor\/(agents|plans|skills)\//, // Cursor 专用，不描述本仓库
  /^\.cursor\/rules\/luke-ai-orchestrator\.mdc$/,
  /^CC Switch\.lnk$/,
  /^(ERROR-FIX-REPORT|TASK-ASSIGNMENT)\.md$/, // 过时的一次性报告
  /^docs\/superpowers\//, //               笔记，却会被当成真页面构建出去
  // ↓ 安全兜底
  /(^|\/)\.env(\..*)?\.local$/,
  /(^|\/)debug-.*\.log$/,
  /^\.claude\/settings\.local\.json$/,
  /^\.vercel\//,
  /^\.playwright-mcp\//,
]

/** -z 输出，避免非 ASCII 路径被 git 加引号 */
function gitZ(args, cwd = SRC) {
  return execFileSync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
}
function git(args, cwd, opts = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', ...opts })
}

function ensureClone() {
  if (fs.existsSync(path.join(OUT, '.git'))) {
    git(['fetch', 'origin', '--quiet'], OUT)
    git(['reset', '--hard', 'origin/main', '--quiet'], OUT)
    return
  }
  fs.rmSync(OUT, { recursive: true, force: true })
  console.log(`[mirror] clone ${REMOTE} → ${OUT}`)
  git(['clone', '--quiet', REMOTE, OUT], process.cwd())
}

function syncFiles() {
  const tracked = gitZ(['ls-files', '-z'])
  const untracked = gitZ(['ls-files', '-z', '--others', '--exclude-standard'])
  const all = [...new Set([...tracked, ...untracked])]

  const keep = all.filter((f) => !DROP.some((re) => re.test(f)))
  const dropped = all.length - keep.length

  // 清空但保留 .git，否则会丢掉远端关联
  for (const entry of fs.readdirSync(OUT)) {
    if (entry === '.git') continue
    fs.rmSync(path.join(OUT, entry), { recursive: true, force: true })
  }

  let copied = 0
  let bytes = 0
  for (const rel of keep) {
    const src = path.join(SRC, rel)
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue
    const dst = path.join(OUT, rel)
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
    bytes += fs.statSync(src).size
    copied++
  }
  return { copied, dropped, mb: (bytes / 1048576).toFixed(1) }
}

/** 最后一道闸：公开之前扫一遍密钥格式，命中就中止 */
function scanSecrets() {
  // 下面 GitHub 细粒度 token 前缀故意拆成字符类写法：写成完整字面量的话，
  // 这个扫描器会在自己的源码里命中自己，每次同步都误报中止。
  const PATTERNS =
    /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|githu[b]_pat_|app-[A-Za-z0-9]{20,}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/
  const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.zip', '.lnk', '.woff', '.woff2'])
  const hits = []

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue
      if (fs.statSync(full).size > 4 * 1024 * 1024) continue
      const text = fs.readFileSync(full, 'utf8')
      if (PATTERNS.test(text)) hits.push(path.relative(OUT, full))
    }
  }
  walk(OUT)
  return hits
}

function main() {
  ensureClone()
  const { copied, dropped, mb } = syncFiles()
  console.log(`[mirror] 同步 ${copied} 个文件 / ${mb} MB，排除 ${dropped} 个`)

  const hits = scanSecrets()
  if (hits.length) {
    console.error('[mirror] ✗ 密钥扫描命中，已中止：')
    for (const h of hits) console.error(`         ${h}`)
    process.exit(1)
  }
  console.log('[mirror] ✓ 密钥扫描干净')

  const status = git(['status', '--porcelain'], OUT)
  if (!status.trim()) {
    console.log('[mirror] 与公开仓库无差异，无需提交')
    return
  }
  git(['add', '-A'], OUT)
  console.log('\n' + git(['diff', '--cached', '--stat'], OUT).trimEnd())

  if (!has('commit')) {
    console.log(`\n[mirror] 未提交（加 --commit -m "说明" 才提交）`)
    console.log(`[mirror] 工作目录：${OUT}`)
    return
  }

  // `-m` 和 `--message` 都收；只写 `--m` 反而不像 git，别人一定会踩
  const mi = process.argv.findIndex((a) => a === '-m' || a === '--message')
  const msg = mi !== -1 ? process.argv[mi + 1] : null
  if (!msg) {
    console.error('[mirror] --commit 需要配 -m "说明"')
    process.exit(1)
  }
  git(['commit', '--quiet', '-m', msg], OUT)
  console.log(`[mirror] 已提交：${msg}`)

  if (has('push')) {
    git(['push', '--quiet', 'origin', 'main'], OUT)
    console.log('[mirror] 已推送到 origin/main')
  } else {
    console.log('[mirror] 未推送（加 --push）')
  }
}

main()
