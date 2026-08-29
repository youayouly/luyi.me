#!/usr/bin/env node
/**
 * 将本地 docs/article/README.md 通过 GitHub Contents API 写回仓库。
 * 用于：本地 vercel dev 已改好列表，但访问 api.github.com 失败时补推，以便 Vercel 重建 luyi.me。
 *
 * 环境变量（与 api/delete 一致）：GITHUB_TOKEN、GITHUB_REPO；可选 GITHUB_BRANCH（默认 main）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadDotEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const fp = path.join(root, name)
    if (!fs.existsSync(fp)) continue
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function githubFetch(url, init = {}) {
  const attempts = 4
  const baseMs = 400
  const timeout =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(25000)
      : undefined
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const nextInit = { ...init }
      if (timeout && !nextInit.signal) nextInit.signal = timeout
      return await fetch(url, nextInit)
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await delay(baseMs * 2 ** i)
    }
  }
  throw lastErr
}

loadDotEnvFiles()

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPO
const branch = process.env.GITHUB_BRANCH || 'main'
const listPath = 'docs/article/README.md'

if (!token || !repo) {
  console.error('缺少 GITHUB_TOKEN 或 GITHUB_REPO，请检查 .env / .env.local')
  process.exit(1)
}

const localFile = path.join(root, listPath)
if (!fs.existsSync(localFile)) {
  console.error('找不到本地文件:', localFile)
  process.exit(1)
}

const content = fs.readFileSync(localFile, 'utf8')
const b64 = Buffer.from(content, 'utf8').toString('base64')
const BASE = 'https://api.github.com'
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'VuePress-sync-readme/1.0',
}

const shaUrl = `${BASE}/repos/${repo}/contents/${listPath}?ref=${branch}`
const shaRes = await githubFetch(shaUrl, { headers })
if (!shaRes.ok) {
  console.error('获取 README sha 失败', shaRes.status, await shaRes.text())
  process.exit(1)
}
const { sha } = await shaRes.json()

const putRes = await githubFetch(`${BASE}/repos/${repo}/contents/${listPath}`, {
  method: 'PUT',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'chore: sync article index README from local',
    content: b64,
    sha,
    branch,
  }),
})

if (!putRes.ok) {
  console.error('PUT README 失败', putRes.status, await putRes.text())
  process.exit(1)
}

console.log('已更新 GitHub:', repo, listPath, '分支:', branch)
