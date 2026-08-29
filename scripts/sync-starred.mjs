#!/usr/bin/env node
/**
 * 拉取 GitHub star 列表，生成 docs/.vuepress/data/starredRepos.generated.js。
 *
 * 为什么是构建期取数而不是运行时 fetch：
 * 1. 运行时插入的节点是 hydration 之后才出现的，`pretranslate.mjs` 扫不到，
 *    中英切换会漏；构建期写成静态数据则和其它卡片一样进翻译流水线。
 * 2. 匿名 GitHub API 限流 60 次/小时/IP，运行时每个访客都要花一次。
 * 3. 和 `sync-external-projects.mjs` 是同一套模式（拉远端 → 写 *.generated.js）。
 *
 * 用法：
 *   npm run sync:stars              # 默认读 site.config.js 里的 author.github
 *   npm run sync:stars -- --user x  # 指定用户
 *   npm run sync:stars -- --limit 12
 *
 * GITHUB_TOKEN 可选：不带也能拉公开 star，只是限流低。构建期只跑一次，通常够。
 *
 * ⚠️ 生成的文件会被整体覆盖，不要手改。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outPath = path.join(repoRoot, 'docs', '.vuepress', 'data', 'starredRepos.generated.js')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function readDefaultUser() {
  try {
    // Windows 上必须转成 file:// URL：裸盘符路径会被 import() 当成包名
    const mod = await import(
      pathToFileURL(path.join(repoRoot, 'docs', '.vuepress', 'site.config.js')).href
    )
    return mod.siteConfig?.author?.github || ''
  } catch {
    return ''
  }
}

/** GitHub 单页上限 100；要更多得翻页，这里一页足够卡片用 */
async function fetchStarred(user, perPage) {
  const url = `https://api.github.com/users/${encodeURIComponent(user)}/starred?per_page=${perPage}`
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'lk-sync-starred',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  } else {
    console.warn('[sync:stars] 无 GITHUB_TOKEN，走匿名请求（60 次/小时）')
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    throw new Error(
      `GET ${url} → ${res.status}${remaining === '0' ? '（已触发匿名限流，配置 GITHUB_TOKEN 或稍后重试）' : ''}`,
    )
  }
  return res.json()
}

function toCard(r) {
  return {
    id: r.full_name,
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    // description 可能是 null，也可能很长；卡片里截断，这里先留全文给翻译流水线
    desc: (r.description || '').trim(),
    language: r.language || '',
    stars: r.stargazers_count ?? 0,
    owner: r.owner?.login || '',
  }
}

function render(items, user) {
  const header = `/**
 * 由 \`npm run sync:stars\` 生成，请勿手改。
 * 来源：https://github.com/${user}?tab=stars
 * 生成时间：${new Date().toISOString()}
 */
export const starredRepos = `
  return header + JSON.stringify(items, null, 2) + '\n'
}

async function main() {
  const user = arg('user', await readDefaultUser())
  if (!user) {
    console.error('[sync:stars] 没有用户名：在 site.config.js 填 author.github，或用 --user 指定')
    process.exit(1)
  }
  const limit = Number(arg('limit', '10')) || 10

  let raw
  try {
    raw = await fetchStarred(user, Math.min(Math.max(limit, 1), 100))
  } catch (err) {
    // 取数失败不该阻断构建：保留上一次生成的文件，只报警
    console.error(`[sync:stars] ${err.message}`)
    if (fs.existsSync(outPath)) {
      console.error('[sync:stars] 保留上一次生成的结果，未改动')
      process.exit(0)
    }
    console.error('[sync:stars] 且本地没有旧结果，写入空列表')
    fs.writeFileSync(outPath, render([], user), 'utf8')
    process.exit(0)
  }

  const items = raw.slice(0, limit).map(toCard)
  fs.writeFileSync(outPath, render(items, user), 'utf8')
  console.log(`[sync:stars] ${user} → ${items.length} 条，写入 ${path.relative(repoRoot, outPath)}`)
}

main()
