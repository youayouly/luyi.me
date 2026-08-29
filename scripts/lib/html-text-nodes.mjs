/**
 * 从 VuePress SSR 出来的 HTML 里抽「文本节点」，键必须和运行时
 * `docs/.vuepress/utils/pageTranslate.js` 里 `node.nodeValue.trim()` 完全一致，
 * 否则构建期预翻的词典在页面上一条都命中不了。
 *
 * 两条对齐规则：
 * 1. 跳过的子树和运行时 SKIP_SELECTOR 一一对应；
 * 2. 任何标签、注释都切断一次文本 —— Vue SSR 会插 `<!--[-->` 这类锚点注释，
 *    在 DOM 里它们同样会把相邻文本切成两个 text node。
 *
 * 除了「抽出来」，本模块还负责「换回去」：`localizeHtml()` 用同一套切分把 dist 里的
 * 中文原地换成英文，让服务器发出去的 HTML 本身就是英文（见 i18n-boot.mjs 的注释）。
 * 抽取和替换必须共用一个游标，任何一边单独改都会让两边的切分错位。
 */

/** 与 pageTranslate.js 的 SKIP_SELECTOR 对应的标签名部分。 */
const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'code',
  'pre',
  'kbd',
  'samp',
  'svg',
  'canvas',
  'iframe',
  'textarea',
])

/** 对应 SKIP_SELECTOR 里的 class 选择器。 */
const SKIP_CLASSES = [
  'lk-no-translate',
  'katex',
  'lk-particles-nav-item',
  'home-typewriter-tagline',
]

/** 内容是纯文本、要一路跳到闭合标签的元素。 */
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'noscript'])

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

const HAS_CJK = /[一-鿿]/
/** 和运行时 / API 的单条上限保持一致。 */
export const MAX_ONE_CHARS = 1200
/** VuePress 拼 `<title>` 用的分隔符：`页面标题 | 站点名`。 */
const TITLE_SEPARATOR = ' | '

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', middot: '·', times: '×', copy: '©',
}

function decodeEntities(text) {
  if (!text.includes('&')) return text
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match
    }
    const named = NAMED_ENTITIES[body]
    return named === undefined ? match : named
  })
}

/** 写回文本位置时只需要挡住这三个字符，属性里的引号轮不到这里。 */
function encodeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseAttrs(rest) {
  const attrs = {}
  const re = /([:@a-zA-Z_][-.:@a-zA-Z0-9_]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g
  let m
  while ((m = re.exec(rest))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return attrs
}

function isSkippedElement(tag, attrs) {
  if (SKIP_TAGS.has(tag)) return true
  if ('data-lk-no-translate' in attrs) return true
  if ('contenteditable' in attrs) return true
  if (attrs.id === 'live2d-widget') return true
  const cls = attrs.class
  if (cls) {
    const list = cls.split(/\s+/)
    for (const name of SKIP_CLASSES) {
      if (list.includes(name)) return true
    }
  }
  return false
}

/** 只看 <body> 里的内容 —— 运行时也是从 document.body 开始 walk 的。 */
function bodyRangeOf(html) {
  const start = html.search(/<body\b[^>]*>/i)
  if (start < 0) return { from: 0, to: html.length }
  const open = html.slice(start).match(/<body\b[^>]*>/i)[0]
  const from = start + open.length
  const end = html.toLowerCase().lastIndexOf('</body>')
  return { from, to: end > from ? end : html.length }
}

/**
 * 切出所有文本节点，位置是相对整份 HTML 的绝对下标。
 * @returns {{start:number,end:number,raw:string}[]} raw 是未解码的原始切片
 */
export function extractTextRanges(html) {
  const { from: base, to } = bodyRangeOf(html)
  const source = html.slice(base, to)
  const out = []
  let skipDepth = 0
  /** 记录每一层 open tag 是否是「跳过」的起点，闭合时才知道要不要减 skipDepth。 */
  const stack = []
  let i = 0
  let textStart = 0

  const flush = (end) => {
    if (end > textStart && skipDepth === 0) {
      const raw = source.slice(textStart, end)
      if (raw.trim()) out.push({ start: base + textStart, end: base + end, raw })
    }
  }

  while (i < source.length) {
    const lt = source.indexOf('<', i)
    if (lt < 0) break

    // 注释 / CDATA / doctype：本身不是文本，但会切断相邻文本节点
    if (source.startsWith('<!--', lt)) {
      flush(lt)
      const close = source.indexOf('-->', lt + 4)
      i = close < 0 ? source.length : close + 3
      textStart = i
      continue
    }
    if (source.startsWith('<!', lt)) {
      flush(lt)
      const close = source.indexOf('>', lt)
      i = close < 0 ? source.length : close + 1
      textStart = i
      continue
    }

    const tagMatch = /^<(\/?)([a-zA-Z][-a-zA-Z0-9:]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/.exec(
      source.slice(lt),
    )
    if (!tagMatch) {
      // 孤立的 `<`，当普通文本
      i = lt + 1
      continue
    }

    flush(lt)

    const [full, closing, rawTag, rest, selfClose] = tagMatch
    const tag = rawTag.toLowerCase()
    i = lt + full.length
    textStart = i

    if (closing) {
      for (let d = stack.length - 1; d >= 0; d -= 1) {
        if (stack[d].tag === tag) {
          for (let k = stack.length - 1; k >= d; k -= 1) {
            if (stack[k].skipped) skipDepth -= 1
          }
          stack.length = d
          break
        }
      }
      continue
    }

    if (RAW_TEXT_TAGS.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
      const remainder = source.slice(i)
      const close = remainder.search(closeRe)
      i = close < 0 ? source.length : i + close + remainder.match(closeRe)[0].length
      textStart = i
      continue
    }

    if (selfClose || VOID_TAGS.has(tag)) continue

    const skipped = isSkippedElement(tag, parseAttrs(rest))
    if (skipped) skipDepth += 1
    stack.push({ tag, skipped })
  }

  flush(source.length)
  return out
}

/**
 * @returns {string[]} 出现顺序的文本节点内容（已解码，未 trim，未过滤）
 */
export function extractTextNodes(html) {
  return extractTextRanges(html).map((item) => decodeEntities(item.raw))
}

/**
 * `<head><title>` 的文本位置。它在 `<body>` 外面，所以上面那趟遍历扫不到 ——
 * 而它正是浏览器标签页上唯一一直露在外面的文案（`document.title`）。
 */
export function extractTitleRange(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (!m || !m[1].trim()) return null
  const start = m.index + m[0].length - m[1].length - '</title>'.length
  return { start, end: start + m[1].length, raw: m[1] }
}

/**
 * 标题的可翻译片段：整串优先，查不到再按 ` | ` 拆。
 * 拆出来的「页面名」「站点名」本来就各自出现在正文里，词典里通常已经有了，
 * 所以正常情况下翻标题一条模型调用都不用花。
 */
function titleSegments(title) {
  const parts = title.split(TITLE_SEPARATOR).map((part) => part.trim())
  return parts.length > 1 ? parts : [title]
}

/**
 * 查词典把整条标题译出来。整串没命中就逐段查，只要有一段命中就算数
 * （命不中的那段留中文，总比整条不翻强）。
 * @param {(key:string)=>string|undefined} lookup
 */
export function translateTitleText(title, lookup) {
  const whole = lookup(title)
  if (whole) return whole

  const parts = titleSegments(title)
  if (parts.length < 2) return ''

  let hit = false
  const out = parts.map((part) => {
    const value = lookup(part)
    if (value) hit = true
    return value || part
  })
  return hit ? out.join(TITLE_SEPARATOR) : ''
}

/** 抽出可翻译的唯一字符串（已 trim / 过滤，与运行时的入队条件一致）。 */
export function extractTranslatableStrings(html) {
  const seen = new Set()
  const add = (raw) => {
    const key = raw.trim()
    if (!key) return
    if (!HAS_CJK.test(key)) return
    if (key.length > MAX_ONE_CHARS) return
    seen.add(key)
  }

  for (const raw of extractTextNodes(html)) add(raw)

  const title = extractTitleRange(html)
  if (title) for (const part of titleSegments(decodeEntities(title.raw).trim())) add(part)

  return seen
}

/**
 * 把 HTML 里能查到译文的中文文本节点原地换成译文。
 *
 * 保留前后空白（和运行时 `applyToNode` 一样只换 trim 过的那一段），并按文本位置
 * 重新转义 `&<>` —— 译文里带 `>` 的情况是真实存在的（「阅读全文 >」）。
 *
 * @returns {{html:string, rev:Record<string,string>, count:number}}
 *   rev 是「译文 -> 原文」，交给首屏脚本和运行时把页面换回中文用。
 */
export function localizeHtml(html, dict) {
  const rev = {}
  let out = ''
  let cursor = 0
  let count = 0

  /*
   * 标题先处理：它在 <head> 里，位置一定排在 body 的文本节点前面，
   * 而下面那段是靠一个只往前走的游标拼字符串的。
   */
  const titleRange = extractTitleRange(html)
  if (titleRange) {
    const text = decodeEntities(titleRange.raw)
    const key = text.trim()
    const value =
      key && HAS_CJK.test(key) ? translateTitleText(key, (item) => dict[item]) : ''
    if (value && value !== key) {
      out += html.slice(cursor, titleRange.start)
      out += encodeText(text.replace(key, value))
      cursor = titleRange.end
      rev[value] = key
      count += 1
    }
  }

  const ranges = extractTextRanges(html)
  for (const range of ranges) {
    const text = decodeEntities(range.raw)
    const key = text.trim()
    if (!key || !HAS_CJK.test(key) || key.length > MAX_ONE_CHARS) continue
    const value = dict[key]
    if (!value) continue

    out += html.slice(cursor, range.start)
    out += encodeText(text.replace(key, value))
    cursor = range.end
    rev[value] = key
    count += 1
  }

  out += html.slice(cursor)
  return { html: out, rev, count }
}
