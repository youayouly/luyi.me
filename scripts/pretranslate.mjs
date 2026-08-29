#!/usr/bin/env node
/**
 * 构建期预翻译：扫 `docs/.vuepress/dist/**\/*.html`，把全站中文一次性翻好，
 * 产出静态词典 `/i18n/en.json`。
 *
 * 为什么要这么做：翻译接口的耗时几乎完全由模型输出 token 数决定（实测 ≈28 字/秒），
 * 批次调大、并发调高都只是小修小补。唯一能让「切英文」变成瞬时的办法，就是运行时
 * 根本不调模型 —— 前端 fetch 一次这个 CDN 缓存的 JSON，查表替换即可。
 * 词典里没有的（天气、相对时间这类运行时才生成的文案）才回落到 /api/translate-page。
 *
 * 增量：已有译文直接复用，每次构建只翻新增字符串，所以只有第一次是全量。
 * 没有 API key 时不报错、不翻译，只把已有词典同步进 dist —— 这样 Vercel 上的
 * 构建永远不烧额度，词典是本地翻好后提交进仓库的。
 *
 *   node scripts/pretranslate.mjs [--target=en] [--force] [--dry-run] [--prune]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import { extractTranslatableStrings, localizeHtml } from './lib/html-text-nodes.mjs'
import { BOOT_SCRIPT_RE, LOCALIZED_ATTR, renderBootScript } from './lib/i18n-boot.mjs'
import { RUNTIME_STRINGS } from './lib/runtime-strings.mjs'

const require = createRequire(import.meta.url)
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { resolveProvider, translateBatch } = require(
  path.join(projectRoot, 'scripts', 'lib', 'translate-core.cjs'),
)

const DIST_DIR = path.join(projectRoot, 'docs', '.vuepress', 'dist')
const PUBLIC_I18N_DIR = path.join(projectRoot, 'docs', '.vuepress', 'public', 'i18n')

/* 留足余量：接口上限是 60 条 / 8000 字。 */
const MAX_TEXTS_PER_BATCH = 40
const MAX_CHARS_PER_BATCH = 3200
const CONCURRENCY = 6
const RETRY_PER_BATCH = 1

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, fallback) => {
  const hit = args.find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const target = opt('target', 'en')
const force = flag('force')
const dryRun = flag('dry-run')
const prune = flag('prune')

const dictFile = path.join(PUBLIC_I18N_DIR, `${target}.json`)
const distDictFile = path.join(DIST_DIR, 'i18n', `${target}.json`)

function log(...parts) {
  console.log('[pretranslate]', ...parts)
}

function readDict() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dictFile, 'utf8'))
    if (parsed && typeof parsed.entries === 'object' && parsed.entries) return parsed.entries
  } catch {
    /* 首次运行 / 文件损坏：当空词典重来一遍即可 */
  }
  return {}
}

function writeDict(entries, model) {
  const sorted = {}
  for (const key of Object.keys(entries).sort()) sorted[key] = entries[key]

  const payload = {
    target,
    model: model || resolveProvider().model,
    generatedAt: new Date().toISOString(),
    count: Object.keys(sorted).length,
    entries: sorted,
  }
  const json = `${JSON.stringify(payload, null, 0)}\n`

  fs.mkdirSync(PUBLIC_I18N_DIR, { recursive: true })
  fs.writeFileSync(dictFile, json, 'utf8')

  // public/ 是在 vuepress build 期间拷进 dist 的，而本脚本跑在 build 之后，
  // 所以这一版还得手动落一份到 dist，否则要等下次构建才生效。
  if (fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(path.dirname(distDictFile), { recursive: true })
    fs.writeFileSync(distDictFile, json, 'utf8')
  }
  return payload.count
}

function collectHtmlFiles(dir) {
  const files = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'assets') continue // 构建产物，没有可读文案
      files.push(...collectHtmlFiles(full))
    } else if (entry.name.endsWith('.html')) {
      files.push(full)
    }
  }
  return files
}

/**
 * 首屏脚本要插在 <head> 里最靠前的位置，但必须排在 <meta charset> 后面：
 * 脚本里带中文（反查表），把 charset 挤出前 1024 字节会让浏览器猜错编码。
 * 也不能挪到样式表后面 —— 内联脚本会等前面的 CSS 下载完才执行。
 */
function insertIntoHead(html, snippet) {
  const head = /<head\b[^>]*>/i.exec(html)
  if (!head) return null

  const at = head.index + head[0].length
  const charset = /<meta[^>]+charset=[^>]*>/i.exec(html.slice(at, at + 400))
  const pos = charset ? at + charset.index + charset[0].length : at
  return `${html.slice(0, pos)}${snippet}${html.slice(pos)}`
}

/** <html lang="zh-CN"> -> lang="en"，并打上「这份产物已经是英文」的标记。 */
function markHtmlTag(html, lang) {
  return html.replace(/<html\b([^>]*)>/i, (full, attrs) => {
    const cleaned = attrs
      .replace(/\s+lang="[^"]*"/i, '')
      .replace(new RegExp(`\\s+${LOCALIZED_ATTR}="[^"]*"`, 'i'), '')
    return `<html${cleaned} lang="${lang}" ${LOCALIZED_ATTR}="${lang}">`
  })
}

/*
 * 把 dist 里的中文原地换成译文：服务器发出去的 HTML 本身就是英文，首屏一帧中文都没有。
 * 词典缺的词条留在原地，运行时照旧回落到 /api/translate-page。
 * 同时把「译文 -> 原文」的反查表内联进去，明确选了中文的访客靠它在解析期换回中文，
 * 运行时的 restoreAll() 也靠它把整页还原（见 scripts/lib/i18n-boot.mjs 的注释）。
 */
function localizePages(files, dict) {
  let localized = 0
  let swapped = 0
  let skipped = 0

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    // 已经翻过的产物不能再翻一遍：反查表会被自己的输出污染。
    if (source.includes(`${LOCALIZED_ATTR}="${target}"`)) {
      skipped += 1
      continue
    }

    const stripped = source.replace(BOOT_SCRIPT_RE, '')
    const { html, rev, count } = localizeHtml(stripped, dict)
    const next = insertIntoHead(markHtmlTag(html, target), renderBootScript(rev, target))
    if (!next) continue

    fs.writeFileSync(file, next, 'utf8')
    localized += 1
    swapped += count
  }

  return { localized, swapped, skipped }
}

function logLocalize({ localized, swapped, skipped }) {
  log(`已把 ${localized} 个页面的 ${swapped} 处中文换成英文，浏览器拿到的第一帧就是英文。`)
  if (skipped) log(`（${skipped} 个页面已经是英文产物，跳过）`)
}

function chunk(texts) {
  const batches = []
  let current = []
  let chars = 0
  for (const text of texts) {
    if (current.length >= MAX_TEXTS_PER_BATCH || chars + text.length > MAX_CHARS_PER_BATCH) {
      if (current.length) batches.push(current)
      current = []
      chars = 0
    }
    current.push(text)
    chars += text.length
  }
  if (current.length) batches.push(current)
  return batches
}

async function main() {
  const files = collectHtmlFiles(DIST_DIR)
  if (!files.length) {
    log(`dist 里没有 HTML（${path.relative(projectRoot, DIST_DIR)}），先跑 vuepress build。跳过。`)
    return
  }

  const present = new Set()
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8')
    /*
     * 已经换成英文的产物要跳过。正常构建流程里 dist 每次都是新的（中文），扫不到这一支；
     * 但单跑 `npm run pretranslate` 两次会扫到上一轮的输出，把「译文」当成新的原文收进
     * 词典 —— 尤其是模型偶尔漏翻一两个词的那种中英混排句子。
     */
    if (html.includes(`${LOCALIZED_ATTR}="${target}"`)) continue
    for (const key of extractTranslatableStrings(html)) present.add(key)
  }
  // JS 运行时才建出来的节点，HTML 里扫不到，但同样需要进词典，否则只能走接口。
  for (const key of RUNTIME_STRINGS) present.add(key)

  const dict = force ? {} : readDict()
  const known = new Set(Object.keys(dict))
  const missing = [...present].filter((key) => !dict[key])

  log(`${files.length} 个页面，${present.size} 条唯一中文；词典已有 ${known.size} 条，缺 ${missing.length} 条`)

  if (prune) {
    let dropped = 0
    for (const key of known) {
      if (!present.has(key)) {
        delete dict[key]
        dropped += 1
      }
    }
    if (dropped) log(`--prune：丢掉 ${dropped} 条页面上已经不存在的旧译文`)
  }

  if (!missing.length) {
    if (dryRun) return log('没有需要新翻的字符串。')
    const total = writeDict(dict)
    log(`没有需要新翻的字符串；词典已同步到 dist（${total} 条）。`)
    return logLocalize(localizePages(files, dict))
  }

  if (dryRun) {
    const chars = missing.reduce((sum, item) => sum + item.length, 0)
    log(`--dry-run：需要翻 ${missing.length} 条 / ${chars} 字，约 ${chunk(missing).length} 批`)
    return
  }

  const { key } = resolveProvider()
  if (!key) {
    // 构建不该因为缺 key 就挂掉：词典是本地翻好提交的，线上构建只负责发出去。
    log(`没有 TRANSLATE_API_KEY / SILICONFLOW_API_KEY，跳过翻译（${missing.length} 条会在运行时回落到 /api/translate-page）`)
    if (!Object.keys(dict).length) return
    writeDict(dict)
    // 已有词典照样要内联：Vercel 上就是这条路径。
    return logLocalize(localizePages(files, dict))
  }

  const batches = chunk(missing)
  const chars = missing.reduce((sum, item) => sum + item.length, 0)
  log(`开始翻译：${missing.length} 条 / ${chars} 字 / ${batches.length} 批，并发 ${CONCURRENCY}`)

  const started = Date.now()
  let cursor = 0
  let done = 0
  let failed = 0
  let model = ''

  /*
   * 一批里只要模型少还 / 多还一条，整批就废了（parseTranslations 要求条数严格相等）。
   * 40 条一批时这种情况不算罕见，所以失败后对半拆开重试，最坏拆到单条 —— 
   * 40 条全丢和只丢 1 条，差别很大。
   */
  async function translateWithSplit(batch) {
    for (let attempt = 0; attempt <= RETRY_PER_BATCH; attempt += 1) {
      try {
        const res = await translateBatch(batch, target)
        model = res.model
        batch.forEach((source, index) => {
          const value = res.translations[index]
          if (value) dict[source] = value
        })
        return
      } catch (error) {
        if (attempt < RETRY_PER_BATCH) continue
        if (batch.length === 1) {
          failed += 1
          console.warn(`[pretranslate] 单条翻译失败（运行时回落到 API）：${error.message}`)
          return
        }
        const mid = Math.ceil(batch.length / 2)
        await translateWithSplit(batch.slice(0, mid))
        await translateWithSplit(batch.slice(mid))
        return
      }
    }
  }

  async function worker() {
    while (cursor < batches.length) {
      await translateWithSplit(batches[cursor++])
      done += 1
      log(`${done}/${batches.length} 批完成（${Math.round((Date.now() - started) / 1000)}s）`)
      // 每批都落盘：中途 Ctrl-C 也不会白翻。
      writeDict(dict, model)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))

  const total = writeDict(dict, model)
  const seconds = Math.round((Date.now() - started) / 1000)
  log(`完成：词典 ${total} 条，用时 ${seconds}s${failed ? `，${failed} 条失败` : ''}`)
  log(`→ ${path.relative(projectRoot, dictFile)}`)
  logLocalize(localizePages(files, dict))
}

main().catch((error) => {
  // 预翻译失败不该拖垮构建：运行时还有 /api/translate-page 兜底。
  console.error('[pretranslate] 失败：', error.message)
  process.exitCode = 0
})
