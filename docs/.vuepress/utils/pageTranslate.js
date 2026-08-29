/**
 * 运行时整页翻译：抓取页面里的中文文本节点 → 查静态词典 / 调 `/api/translate-page` → 原地替换。
 * 原文存在 WeakMap 里，切回中文时直接还原，不需要重新加载页面。
 *
 * 命中顺序：构建期词典 `/i18n/<lang>.json` → localStorage 逐句缓存 → /api/translate-page。
 * 静态词典由 `scripts/pretranslate.mjs` 在构建后生成，覆盖全站静态文案，所以正常情况下
 * 切语言只是一次 CDN 命中 + 查表，不会等模型出 token（实测模型 ≈28 字/秒，是唯一的瓶颈）。
 * 只有词典里没有的运行时文案（天气、相对时间等）才会真的打接口。
 */
import { ref } from 'vue'
import { withBase } from 'vuepress/client'
import {
  DEFAULT_TARGET_LANG,
  LANG_MODE_AUTO,
  SOURCE_LANG,
  TRANSLATE_LANG_EVENT,
  readLangMode,
  readLangPref,
  resolveLang,
  writeLangMode,
  writeLangPref,
} from './translatePref.js'

const DEFAULT_API_URL = '/api/translate-page'

/**
 * `npm run dev` 起的是 VuePress 开发服务器，没有 Serverless 路由。
 * 本地想调通翻译，在控制台写 `localStorage.setItem('lk-translate-api', 'https://<线上域名>/api/translate-page')` 即可。
 */
function apiUrl() {
  if (typeof window === 'undefined') return DEFAULT_API_URL
  try {
    return window.localStorage.getItem('lk-translate-api') || DEFAULT_API_URL
  } catch {
    return DEFAULT_API_URL
  }
}

/** 这些子树要么没有可读文本，要么翻了会坏（代码、公式、图标按钮）。 */
const SKIP_SELECTOR = [
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
  '[contenteditable]',
  '[data-lk-no-translate]',
  '.lk-no-translate',
  '.katex',
  '.lk-particles-nav-item',
  '#live2d-widget',
  // 打字机逐字重写自己的文本，翻了会被立刻盖掉，还会让增量扫描停不下来。
  '.home-typewriter-tagline',
].join(',')

const HAS_CJK = /[一-鿿]/
const CACHE_KEY_PREFIX = 'lk-translate-cache-'
const CACHE_MAX_ENTRIES = 2000
const MAX_TEXTS_PER_BATCH = 18
const MAX_CHARS_PER_BATCH = 1400
const MAX_ONE_CHARS = 1200
const MAX_STRINGS_PER_PASS = 600
const BATCH_CONCURRENCY = 5

export const pageLang = ref(SOURCE_LANG)
/** `auto` / `zh` / `en`，给设置面板显示当前是哪种选择。 */
export const langMode = ref(LANG_MODE_AUTO)
export const translating = ref(false)
export const translateError = ref('')
/*
 * 「翻译服务整个打不通」和「某一批偶尔抽风」得分开：
 * 长页面几十批里挂一两批很正常，不该把按钮整个标红；一批都没成功才是真的坏了
 * （本地 `npm run dev` 打不到 /api/translate-page 时就是这种情况）。
 */
export const translateBroken = ref(false)
export const translateProgress = ref(0)

/** node -> 原始 nodeValue，只在第一次替换时写入。 */
const originals = new WeakMap()
/** 已替换过的节点；切回中文时要遍历，所以用强引用集合。 */
const touched = new Set()
/*
 * 「译文 -> 原文」反查表，由首屏脚本内联进来（scripts/lib/i18n-boot.mjs）。
 *
 * 有两类节点只能靠它还原：
 * - **服务端就发英文的那一整页**。构建期 `localizeHtml()` 已经把 dist 里的中文换掉了，
 *   运行时没翻过任何东西，originals 是空的；切中文只能按译文反查。
 * - **照抄已经是英文的 DOM 建出来的节点** —— 主题的 TOC 就是这样从标题抄文本，
 *   它从来没带过中文，同样进不了 originals（实测正文标题回中文了，右侧 TOC 还留着英文）。
 * 只收构建期真正换过的那些串，范围够窄，不至于误伤本来就是英文的原文。
 */
const bootReverse = new Map()
/*
 * 上面那张表倒过来：「原文 -> 译文」，只覆盖本页构建期换过的串。
 *
 * 它的价值是**同步可用**。hydration 会把主题组件渲染的文本 patch 回中文（导航、站名、
 * 首页卡片，实测首页 26 处），而查静态词典要先 fetch `/i18n/en.json`（46KB，慢网 4.4s）——
 * 这中间就是肉眼可见的中文。这张表是内联在 HTML 里的，页面一解析就能查，
 * 所以放在词典之前当第一档。
 */
const bootForward = new Map()

/** VuePress 拼 document.title 用的分隔符：`页面标题 | 站点名`。 */
const TITLE_SEPARATOR = ' | '

let observer = null
let observerTimer = null
let titleObserver = null
/** 只在语言切换时自增，用来作废上一门语言还没跑完的批次。 */
let runToken = 0
let running = false
let rerunQueued = false
let started = false

/* ---------- 构建期静态词典 ---------- */

/*
 * `scripts/pretranslate.mjs` 在 build 之后扫 dist 里的 HTML 生成，键就是运行时的
 * `node.nodeValue.trim()`，可以直接查表命中。一个语言只 fetch 一次；拿不到就当空词典，
 * 全部回落到 /api/translate-page（本地 dev 没跑过预翻译时就是这种情况）。
 */
const staticDicts = new Map()
/*
 * 词典到手后再存一份同步可读的快照。查表本身不需要网络，能同步跑完就意味着
 * 可以塞进「DOM 更新完、浏览器还没绘制」那一格里，新页面直接以英文出现，不闪中文。
 */
const staticDictSnapshots = new Map()

function loadStaticDict(lang) {
  if (staticDicts.has(lang)) return staticDicts.get(lang)

  const task = fetch(withBase(`/i18n/${lang}.json`), { cache: 'force-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && typeof data.entries === 'object' && data.entries ? data.entries : {}))
    .catch(() => ({}))
    .then((entries) => {
      staticDictSnapshots.set(lang, entries)
      return entries
    })

  staticDicts.set(lang, task)
  return task
}

/**
 * 一次查表的三档顺序：内联反查表（同步、零请求） -> 构建期词典 -> localStorage 缓存。
 * 返回一个闭包而不是每次都查三个容器，是因为同步那条路每帧都要跑。
 */
function makeLookup(target) {
  const dict = staticDictSnapshots.get(target) || null
  const cache = readCache(target)
  const forward = target === DEFAULT_TARGET_LANG ? bootForward : null
  return (key) => (forward && forward.get(key)) || (dict && dict[key]) || cache[key] || ''
}

/*
 * 只查表、不发请求的一遍。同步返回，所以路由切换时可以在 post-flush 里直接调用。
 * 词典还没到、内联表也没有（比如本地 dev 没跑过预翻译）就什么都不做，异步那条路会兜住。
 */
function applyDictionarySync(root, target) {
  const hasInline = target === DEFAULT_TARGET_LANG && bootForward.size > 0
  if (!staticDictSnapshots.has(target) && !hasInline) return 0

  const lookup = makeLookup(target)
  let hits = 0
  for (const node of collectTextNodes(root)) {
    const key = node.nodeValue.trim()
    if (!key) continue
    const value = lookup(key)
    if (!value) continue
    applyToNode(node, value)
    hits += 1
  }
  applyTitle(target, lookup)
  return hits
}

/*
 * MutationObserver 的回调跑在微任务检查点上 —— DOM 已经改完、浏览器还没绘制。
 * 所以查表必须在这里同步做完；之前挂在 requestAnimationFrame 上会晚一帧，
 * 那一帧就是用户看到的中文闪烁。实测一趟全 body 遍历 0.73ms，够便宜。
 */
function runDictionaryPass() {
  // 已经把 DOM 让给浏览器翻译了就不再插手（见下方 standDown）。
  if (stoodDown) return
  if (pageLang.value === SOURCE_LANG) return
  applyDictionarySync(document.body, pageLang.value)
}

/* ---------- 缓存 ---------- */

function cacheKey(lang) {
  return `${CACHE_KEY_PREFIX}${lang}`
}

/* 解析结果留在内存里：同步查表那条路每帧都要读，不能每次都 JSON.parse 一遍。 */
const cacheSnapshots = new Map()

function readCache(lang) {
  if (typeof window === 'undefined') return {}
  if (cacheSnapshots.has(lang)) return cacheSnapshots.get(lang)

  let parsed = {}
  try {
    const raw = window.localStorage.getItem(cacheKey(lang))
    const fromStorage = raw ? JSON.parse(raw) : null
    if (fromStorage && typeof fromStorage === 'object') parsed = fromStorage
  } catch {
    /* 读不出来就当空缓存 */
  }
  cacheSnapshots.set(lang, parsed)
  return parsed
}

function writeCache(lang, cache) {
  if (typeof window === 'undefined') return
  try {
    let next = cache
    const keys = Object.keys(cache)
    if (keys.length > CACHE_MAX_ENTRIES) {
      // 对象保持插入顺序，丢掉更早的一半即可，不用额外的 LRU 结构。
      next = {}
      for (const key of keys.slice(keys.length - Math.floor(CACHE_MAX_ENTRIES / 2))) {
        next[key] = cache[key]
      }
    }
    cacheSnapshots.set(lang, next)
    window.localStorage.setItem(cacheKey(lang), JSON.stringify(next))
  } catch {
    /* 配额满了就当没有缓存，不影响本次翻译 */
  }
}

/* ---------- 收集 ---------- */

function shouldSkipElement(el) {
  if (!(el instanceof Element)) return false
  try {
    return el.matches(SKIP_SELECTOR)
  } catch {
    return false
  }
}

function collectTextNodes(root) {
  if (typeof document === 'undefined') return []

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return shouldSkipElement(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
      }
      const value = node.nodeValue
      if (!value || !HAS_CJK.test(value)) return NodeFilter.FILTER_REJECT
      if (value.trim().length > MAX_ONE_CHARS) return NodeFilter.FILTER_REJECT
      /*
       * 已经翻过的节点通常没有中文，上面那条就挡掉了。还带着中文说明它被「刷回原文」了：
       * Vue patch 文本是原地改 nodeValue，节点对象不变，hydration 和组件重渲染都会这样
       * 把译文冲掉。这时必须当新节点重翻，否则 touched 会把它永久锁在中文。
       */
      if (touched.has(node) && value.trim() !== String(originals.get(node) ?? '').trim()) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current)
    current = walker.nextNode()
  }
  return nodes
}

/* ---------- 替换 / 还原 ---------- */

function applyToNode(node, translated) {
  const raw = node.nodeValue
  if (!raw) return
  const leading = raw.match(/^\s*/)[0]
  const trailing = raw.match(/\s*$/)[0]
  if (!originals.has(node)) originals.set(node, raw)
  node.nodeValue = `${leading}${translated}${trailing}`
  touched.add(node)
}

/*
 * 标题单独走一条路：`<title>` 不在 body 里，上面那趟 walk 扫不到，而它是标签页上
 * 唯一一直露在外面的文案。构建期已经把 HTML 里的 <title> 换成英文了，但 VuePress 的
 * useUpdateHead 会在 hydration 和每次路由切换时按 pageData 重写 document.title，
 * 又变回中文 —— 所以运行时必须跟着换一遍。
 *
 * 切分逻辑和 `scripts/lib/html-text-nodes.mjs#translateTitleText` 是同一套（那边跑在
 * 构建期，这边跑在浏览器里，没法共用一个模块），两边改要一起改。
 */
function translateTitleText(title, lookup) {
  const whole = lookup(title)
  if (whole) return whole

  const parts = title.split(TITLE_SEPARATOR).map((part) => part.trim())
  if (parts.length < 2) return ''

  let hit = false
  const out = parts.map((part) => {
    const value = lookup(part)
    if (value) hit = true
    return value || part
  })
  return hit ? out.join(TITLE_SEPARATOR) : ''
}

/*
 * VuePress 的 `takeOverHeadElements()` 用 `isEqualNode` 去认领 SSR 发出来的 head 标签，
 * 认领到的才会在路由切换时被换掉。我们发的 `<title>` 是英文，它算出来的是中文，
 * 认不上 —— 于是它不删旧的，只往 head 里 **再 append 一个**，而 `document.title`
 * 取的是文档里第一个 `<title>`，也就是上一页那个。实测：/article/ 点到 /tech/，
 * 正文换了，标签页还写着 Articles。
 *
 * 所以每次 head 变动都收一次口：多于一个就只留最后一个（那个才是 VuePress 正在管的）。
 */
function dedupeTitleElements() {
  if (typeof document === 'undefined' || !document.head) return
  const titles = document.head.querySelectorAll('title')
  for (let i = 0; i < titles.length - 1; i += 1) titles[i].remove()
}

function applyTitle(target, lookup) {
  if (typeof document === 'undefined') return
  // <title> 也是浏览器翻译的目标，让路之后这里必须闭嘴（见 standDown）。
  if (stoodDown) return
  dedupeTitleElements()
  const current = document.title
  if (!current || !HAS_CJK.test(current)) return

  const next = translateTitleText(current, lookup || makeLookup(target))
  if (!next || next === current) return
  // 记进反查表，切回中文时靠它还原（document.title 没有节点可以放 originals）。
  bootReverse.set(next, current)
  document.title = next
}

function restoreTitle() {
  if (typeof document === 'undefined') return
  const current = document.title
  if (!current) return

  const whole = bootReverse.get(current)
  if (whole) {
    document.title = whole
    return
  }

  const parts = current.split(TITLE_SEPARATOR).map((part) => part.trim())
  if (parts.length < 2) return
  let hit = false
  const out = parts.map((part) => {
    const value = bootReverse.get(part)
    if (value) hit = true
    return value || part
  })
  if (hit) document.title = out.join(TITLE_SEPARATOR)
}

/*
 * VuePress 每次路由切换都会重写 document.title，时机不跟我们的 post-flush 对齐，
 * 所以盯着 <head>：childList 覆盖「换了个 title 节点」，characterData 覆盖
 * 「原地改文本」（`document.title = x` 走的是后者）。
 * 我们自己写回去的是英文，查表查不到，不会自己触发自己。
 */
function startTitleObserver() {
  if (titleObserver || typeof document === 'undefined' || !document.head) return
  titleObserver = new MutationObserver(() => {
    if (stoodDown) return
    /*
     * Edge 把 <title> 译成中文，而中文正是词典的 key，我们写回英文它再译 ——
     * 这条链整个只在 <head> 里，页面主体一个 mutation 都不会有。
     *
     * 熔断必须排在检测前面：<title> 不是渲染出来的元素，浏览器翻译很可能先动它、
     * 而此时正文一个 _msttexthash 都还没落地，externalTranslatorActive() 会返回
     * false —— 那就成了「每轮做一次全文 querySelector」的死循环，比不检测还糟。
     * 计数是 O(1)，先花它。
     */
    if (noteObserverBurst('页面标题')) return
    if (externalTranslatorActive()) {
      standDown('浏览器翻译改写了页面标题')
      return
    }
    if (pageLang.value !== SOURCE_LANG) applyTitle(pageLang.value)
  })
  titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true })
}

function stopTitleObserver() {
  titleObserver?.disconnect()
  titleObserver = null
}

function restoreAll() {
  restoreTitle()
  for (const node of touched) {
    const raw = originals.get(node)
    if (raw !== undefined && node.nodeValue !== raw) node.nodeValue = raw
  }
  touched.clear()

  // 收尾：把「照抄英文 DOM」建出来的节点也换回中文，它们没有 originals 可查。
  if (!bootReverse.size || typeof document === 'undefined') return
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue
    if (!value || originals.has(node)) continue
    const source = bootReverse.get(value.trim())
    if (source === undefined) continue
    node.nodeValue = `${value.match(/^\s*/)[0]}${source}${value.match(/\s*$/)[0]}`
  }
}

/* ---------- 请求 ---------- */

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

async function requestBatch(texts, target) {
  const res = await fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok || !Array.isArray(data.translations)) {
    throw new Error(data?.error || `翻译服务返回 ${res.status}`)
  }
  return data.translations
}

/* ---------- 主流程 ---------- */

async function translateRoot(root, target, token) {
  const nodes = collectTextNodes(root)
  if (!nodes.length) return

  // 构建期词典覆盖全站静态文案，绝大多数节点在这一步就翻完了，一个请求都不用发。
  await loadStaticDict(target)
  if (token !== runToken) return

  const cache = readCache(target)
  const lookup = makeLookup(target)
  applyTitle(target, lookup)
  const pending = new Map() // 原文 -> 等待替换的节点
  const order = []

  for (const node of nodes) {
    const key = node.nodeValue.trim()
    if (!key) continue

    const hit = lookup(key)
    if (hit) {
      applyToNode(node, hit)
      continue
    }

    if (!pending.has(key)) {
      if (order.length >= MAX_STRINGS_PER_PASS) break
      pending.set(key, [])
      order.push(key)
    }
    pending.get(key).push(node)
  }

  if (!order.length) return

  const batches = chunk(order)
  let done = 0
  let cursor = 0
  let okBatches = 0
  let failedBatches = 0
  let cacheDirty = false
  translateProgress.value = 0
  // 只有真要发请求才算"翻译中"；空转的增量重扫不该让按钮一直转圈。
  translating.value = true

  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++]
      if (token !== runToken) return

      let translations
      try {
        translations = await requestBatch(batch, target)
      } catch (error) {
        translateError.value = error.message || '翻译失败'
        failedBatches += 1
        done += 1
        translateProgress.value = done / batches.length
        continue
      }
      if (token !== runToken) return
      okBatches += 1

      batch.forEach((key, index) => {
        const value = translations[index]
        if (!value) return
        cache[key] = value
        cacheDirty = true
        for (const node of pending.get(key) || []) {
          // 节点可能已被 Vue 重新渲染掉，内容对不上就别再动它。
          if (node.nodeValue && node.nodeValue.trim() === key) applyToNode(node, value)
        }
      })

      // 每批都落盘：中途被打断也不会白翻。
      if (cacheDirty) {
        writeCache(target, cache)
        cacheDirty = false
      }

      done += 1
      translateProgress.value = done / batches.length
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, batches.length) }, worker))
  if (cacheDirty) writeCache(target, cache)

  if (token !== runToken) return
  translateBroken.value = failedBatches > 0 && okBatches === 0
  if (okBatches > 0 && failedBatches === 0) translateError.value = ''
}

/**
 * 翻译当前文档；已替换过的节点会被跳过，所以可以重复调用。
 * 重入时只排队一次重扫，绝不打断正在跑的批次 —— 否则页面上任何动画都能让翻译永远跑不完。
 */
export async function translatePage() {
  if (typeof document === 'undefined') return
  // 让路之后不再写 DOM：这条路是异步的，可能在 standDown 之前就已经在途了。
  if (stoodDown) return
  if (pageLang.value === SOURCE_LANG) return

  if (running) {
    rerunQueued = true
    return
  }

  running = true
  translateError.value = ''
  translateBroken.value = false
  const token = runToken

  try {
    do {
      rerunQueued = false
      await translateRoot(document.body, pageLang.value, token)
    } while (rerunQueued && token === runToken && pageLang.value !== SOURCE_LANG)
  } finally {
    running = false
    const staleRerun = rerunQueued
    rerunQueued = false
    if (token === runToken) {
      translating.value = false
      translateProgress.value = 0
    } else if (staleRerun && pageLang.value !== SOURCE_LANG) {
      // 跑批途中被切了语言：这一轮作废，用新语言立刻重开一轮。
      translatePage()
    }
  }
}

/* ---------- 与外部翻译器共处 ---------- */

/*
 * 下面这个 observer 只监听 childList，理由是「我们自己改的是 characterData，不会被自己触发」。
 * 这个假设对本站代码成立，对**浏览器内置翻译**不成立：Edge / Chrome 的翻译器不改
 * characterData，而是替换、包裹文字节点 —— 那正是 childList 变更。
 *
 * 于是两边锁死：它翻一次 -> 我们同步查表改回去 -> 它发现文字变了再翻 -> ...
 * 每一轮都带一次同步的全 body 遍历，且跑在微任务检查点上（DOM 改完、浏览器还没绘制），
 * 中间没有任何一帧留给渲染，表现就是整个标签页卡死。
 *
 * 处理原则是**让路**：本站自带中/英切换，浏览器翻译一旦接管就没必要再抢。
 */
let stoodDown = false

/* 熔断窗口。做成与翻译器无关的兜底，翻译类扩展引起同类循环也能拦住。
 *
 * 正文 observer 和 <title> observer 共用一份预算：正常一次路由切换两边加起来也就
 * 个位数（多个 mutation 会被合并成一次回调），一秒 40 次只可能是有人在跟我们对着改。
 * 共用还有一个好处 —— 谁先撞上阈值都会让两边一起收手。 */
const BURST_WINDOW_MS = 1000
const BURST_MAX = 40
let burstStamps = []

/** 记一次 observer 回调；判定为改写循环就让路并返回 true。 */
function noteObserverBurst(where) {
  const now = Date.now()
  burstStamps.push(now)
  while (burstStamps.length && now - burstStamps[0] > BURST_WINDOW_MS) burstStamps.shift()
  if (burstStamps.length <= BURST_MAX) return false
  standDown(`${where} 在 ${BURST_WINDOW_MS}ms 内触发 ${burstStamps.length} 次，判定为改写循环`)
  return true
}

/* Microsoft Translator（Edge 右键翻译）给翻过的元素打这两个属性之一 */
const MS_TRANSLATOR_ATTRS = ['_msttexthash', '_msthash']
const EXTERNAL_TRANSLATOR_SELECTOR = `[${MS_TRANSLATOR_ATTRS.join('],[')}],.skiptranslate`

function externalTranslatorActive() {
  if (typeof document === 'undefined') return false
  if (stoodDown) return true
  const html = document.documentElement
  // 先看 <html> 的类名：这是纯字符串比较，比全文 querySelector 便宜一个量级。
  // Google 翻译整页时给 <html> 加方向类。
  if (html.classList.contains('translated-ltr') || html.classList.contains('translated-rtl')) {
    return true
  }
  return Boolean(document.querySelector(EXTERNAL_TRANSLATOR_SELECTOR))
}

/*
 * Edge 的翻译主要改 characterData —— 主 observer 只看 childList，压根不会被叫醒，
 * 于是「谁先发现」这件事只能靠 <title> 那条链或首屏脚本，太靠运气。
 * 这里单挂一个属性哨兵：attributeFilter 交给浏览器过滤，非目标属性连记录都不生成，
 * 代价接近零，而第一个 _msttexthash 一落地就能立刻让路。
 */
let translatorSentinel = null

function startTranslatorSentinel() {
  if (translatorSentinel || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }
  translatorSentinel = new MutationObserver(() => {
    standDown('检测到浏览器翻译写入的标记属性')
  })
  translatorSentinel.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: MS_TRANSLATOR_ATTRS,
  })
}

function stopTranslatorSentinel() {
  translatorSentinel?.disconnect()
  translatorSentinel = null
}

/** 交出 DOM：停掉全部四个 observer（正文 / 标题 / 属性哨兵 / 首屏脚本），并让后续查表全部变成空操作。 */
function standDown(why) {
  if (stoodDown) return
  stoodDown = true
  stopObserver()
  // <title> 那条链是独立的一根，不停掉照样能把标签页转死。
  stopTitleObserver()
  stopTranslatorSentinel()
  // 首屏脚本那个 observer 也在往回改节点，不停掉等于换个对手继续打。
  stopBootObserver()
  if (typeof console !== 'undefined') {
    console.info(`[lk-i18n] 检测到外部翻译，本站翻译已让出 DOM：${why}`)
  }
}

/* ---------- 跟进 DOM 变化 ---------- */

function scheduleIncremental() {
  if (stoodDown) return
  if (externalTranslatorActive()) {
    standDown('页面正被浏览器翻译接管')
    return
  }

  // 打字机和页脚计时器走的是 characterData，压根不进这里，不会白占预算。
  if (noteObserverBurst('正文')) return

  // 查表是免费的，先把静态文案换掉；800ms 的防抖只用来护住真正要花钱的接口调用。
  runDictionaryPass()
  if (observerTimer) clearTimeout(observerTimer)
  observerTimer = setTimeout(() => {
    observerTimer = null
    if (pageLang.value !== SOURCE_LANG) translatePage()
  }, 800)
}

function startObserver() {
  if (observer || typeof document === 'undefined') return
  // 只看 childList：我们自己改的是 characterData，不会被自己触发。
  observer = new MutationObserver(scheduleIncremental)
  observer.observe(document.body, { childList: true, subtree: true })
}

function stopObserver() {
  observer?.disconnect()
  observer = null
  if (observerTimer) {
    clearTimeout(observerTimer)
    observerTimer = null
  }
}

function syncDocumentLang() {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.setAttribute('data-lk-lang', pageLang.value)
  el.lang = pageLang.value === SOURCE_LANG ? 'zh-CN' : pageLang.value
}

/** 只负责把页面切到目标语言，不碰 localStorage。 */
async function applyLang(next) {
  if (pageLang.value === next) return

  pageLang.value = next
  syncDocumentLang()

  if (next === SOURCE_LANG) {
    runToken += 1
    translating.value = false
    translateError.value = ''
    translateBroken.value = false
    stopObserver()
    stopTitleObserver()
    // 首屏脚本此刻可能还在盯着「中文 -> 英文」，不停掉会把刚还原的中文又换回去。
    stopBootObserver()
    restoreAll()
    return
  }

  startObserver()
  startTitleObserver()
  await translatePage()
}

/** 访客点了导航栏开关：记成明确选择，之后不再跟随浏览器语言。 */
export async function setPageLang(lang) {
  const next = lang === SOURCE_LANG ? SOURCE_LANG : DEFAULT_TARGET_LANG
  // 先切再写：写入会派发事件，pageLang 得已经是新值，监听里才不会又绕回来。
  const applied = applyLang(next)
  langMode.value = writeLangPref(next)
  await applied
}

/** 设置面板选「跟随浏览器 / 中文 / English」。 */
export async function setPageLangMode(mode) {
  const next = writeLangMode(mode)
  langMode.value = next
  await applyLang(resolveLang(next))
}

export function togglePageLang() {
  return setPageLang(pageLang.value === SOURCE_LANG ? DEFAULT_TARGET_LANG : SOURCE_LANG)
}

/** 清掉译文缓存，下次翻译重新请求。 */
export function clearTranslationCache() {
  if (typeof window === 'undefined') return
  cacheSnapshots.clear()
  for (const lang of [DEFAULT_TARGET_LANG, SOURCE_LANG]) {
    try {
      window.localStorage.removeItem(`${CACHE_KEY_PREFIX}${lang}`)
    } catch {
      /* ignore */
    }
  }
}

/*
 * 别在路由切换时清空 touched：导航栏、页脚这些节点会跨页面存活，
 * 清掉之后切回中文就还原不了它们了。这里只丢掉已经离开文档的节点。
 */
function pruneTouched() {
  if (touched.size < 3000) return
  for (const node of touched) {
    if (!node.isConnected) touched.delete(node)
  }
}

/**
 * 路由切换后调用：新页面的内容需要重新翻一遍。
 *
 * 这里必须同步查表 —— 以前只排一个 800ms 的防抖任务，而路由渲染期间的 DOM 变动
 * 还会不停把它往后推，实测新页面要 1.3s 才变英文，中间一直显示中文。
 * 调用方是 post-flush 的 watcher，此刻 DOM 已更新、浏览器还没绘制，
 * 在这一格里把词典命中的文本换掉，页面就是直接以英文出现的。
 */
export function onRouteChanged() {
  if (pageLang.value === SOURCE_LANG) return
  pruneTouched()
  applyDictionarySync(document.body, pageLang.value)
  scheduleIncremental()
}

/* 事件只是「偏好已经变了」的通知，这里只负责跟着切页面，别再写一次 localStorage。 */
function onLangEvent(event) {
  const next = event?.detail?.lang
  if (event?.detail?.mode) langMode.value = event.detail.mode
  if (next && next !== pageLang.value) applyLang(next)
}

/*
 * 认领首屏脚本（scripts/lib/i18n-boot.mjs）带来的「译文 -> 原文」反查表。
 *
 * 构建期 `localizeHtml()` 已经把 dist 里的中文换成了英文，服务器发出去的就是英文页，
 * 运行时这边没有任何节点被「翻译过」，originals / touched 里自然是空的。
 * 切回中文全靠 `restoreAll()` 末尾那趟按译文查原文的遍历，所以这张表必须收进来 ——
 * 不收的话切中文只会把 SPA 途中翻过的零星节点换回去，服务端发的那一整页留在英文。
 */
function adoptBootReverse() {
  const boot = window.__LK_I18N_BOOT__
  const rev = boot && boot.rev
  if (!rev || typeof rev !== 'object') return
  for (const key of Object.keys(rev)) {
    bootReverse.set(key, rev[key])
    // 同一份数据倒过来存一份，就是不用等 /i18n/en.json 的那一档（见 bootForward 注释）。
    bootForward.set(rev[key], key)
  }
}

/**
 * 让首屏脚本收手，由这里接管。
 *
 * 它一直开着一个「原文 -> 译文」的 observer 兜 hydration，接管之后就重复了；
 * 更要紧的是切回中文时它会跟 `restoreAll()` 打架 —— 一个换回中文，另一个立刻换成英文。
 */
function stopBootObserver() {
  const boot = typeof window === 'undefined' ? null : window.__LK_I18N_BOOT__
  if (boot && typeof boot.stop === 'function') boot.stop()
}

/** 首次挂载：没存过就默认英文，存过就按访客的明确选择。 */
export function startPageTranslate() {
  if (started || typeof window === 'undefined') return
  started = true
  langMode.value = readLangMode()
  pageLang.value = readLangPref()
  syncDocumentLang()
  adoptBootReverse()

  window.addEventListener(TRANSLATE_LANG_EVENT, onLangEvent)
  // 中文访客同样要挂：首屏脚本这时正把英文 HTML 换回中文，撞上浏览器翻译一样会打起来。
  startTranslatorSentinel()

  if (pageLang.value !== SOURCE_LANG) {
    startObserver()
    startTitleObserver()
    /*
     * 这里跑在 onMounted 里，也就是 hydration 刚把一部分文本 patch 回中文的那一格。
     * 内联反查表让这趟查表不用等 /i18n/en.json，所以能在同一个任务里换回英文，
     * 浏览器根本没机会把中文画出来。首屏脚本的 observer 继续留着兜后续的组件重渲染。
     */
    applyDictionarySync(document.body, pageLang.value)
    translatePage()
  }
}

/*
 * 存的偏好不是中文时，模块一加载就开始拉词典，让这个请求和 hydration 并行。
 * 等到组件 onMounted 再发，首屏就会先闪一下中文。
 */
if (typeof window !== 'undefined') {
  try {
    const preferred = readLangPref()
    if (preferred !== SOURCE_LANG) loadStaticDict(preferred)
  } catch {
    /* localStorage 不可用就算了，正常流程照走 */
  }
}

export function stopPageTranslate() {
  stopObserver()
  stopTitleObserver()
  stopTranslatorSentinel()
  if (typeof window !== 'undefined') window.removeEventListener(TRANSLATE_LANG_EVENT, onLangEvent)
  started = false
}
