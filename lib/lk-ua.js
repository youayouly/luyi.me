/**
 * 够用就好的 UA 解析。放 `lib/` 的原因见 lk-kv.js 顶部注释。
 *
 * 装 ua-parser-js 要为几十行正则拖进一个包，而这里只回答四个问题：
 * 什么设备（尽量到型号）、什么系统、什么浏览器、是不是爬虫。
 * 访客日志和后台登录日志共用这一份。
 *
 * 关于「精确到型号」能做到什么程度，先说清楚，免得以后又来一遍：
 * - **iOS 永远拿不到型号**。Safari 冻结了 UA，只报 iPhone / iPad + 系统版本；
 *   iPadOS 还会伪装成 Mac。想区分具体机型只能靠屏幕尺寸猜「代」，这里不做。
 * - **Chrome ≥ 110 的 Android 也拿不到**。UA reduction 把型号统一写成 `Android 10; K`，
 *   真型号只在 UA-CH（navigator.userAgentData 的 high entropy 字段）里，那要改前端上报。
 * - 国产浏览器（微信 / QQ / UC）和多数厂商自带浏览器仍然带完整 `型号 Build/...`，
 *   所以 model 在国内流量里命中率并不低。
 * - 型号代码 → 商品名（PJD110 → 一加 Ace 2 Pro）需要一张按月更新的映射表，不做。
 *   厂商能从 UA 里的关键字认出来，就拼成「厂商 型号代码」，认不出来就只给型号代码。
 */

/** 认得出来的厂商关键字。故意只覆盖常见的，认不出就不猜。 */
const VENDORS = [
  [/HUAWEI|HarmonyOS/i, '华为'],
  [/HONOR/i, '荣耀'],
  [/Redmi/i, '红米'],
  [/Xiaomi|POCO|\bMI \d/i, '小米'],
  [/OnePlus/i, '一加'],
  [/OPPO|\bPE[A-Z]{2}M\d/i, 'OPPO'],
  [/vivo/i, 'vivo'],
  [/realme/i, 'realme'],
  [/Samsung|\bSM-[A-Z]/i, '三星'],
  [/Pixel/i, 'Google'],
  [/Meizu/i, '魅族'],
  [/nubia|\bZTE\b/i, '中兴'],
  [/Sony|\bXQ-[A-Z]/i, '索尼'],
]

/**
 * Android UA 里括号中间那段就是型号：`(Linux; Android 14; PJD110 Build/UKQ1...)`。
 * 有的没有 ` Build/` 后缀：`(Linux; Android 13; SM-S9110)`。
 */
const ANDROID_MODEL_RE = /Android [\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\s*[;)]/

/**
 * 型号串里已经写明厂商的（`HUAWEI P40`、`Redmi K60`），就别再拼一次厂商名；
 * 只有 `SM-S9110`、`XQ-BC72` 这种纯代码才需要把厂商补到前面。
 */
const BRAND_WORDS = /HUAWEI|HONOR|Redmi|Xiaomi|POCO|OnePlus|OPPO|vivo|realme|Samsung|Pixel|Meizu|nubia|ZTE|Sony/i

/** UA reduction 之后的占位值，以及 WebView 标记，都不算型号。 */
const USELESS_MODEL = /^(k|android|wv|generic|unknown|[a-z]{0,2})$/i

function detectVendor(s) {
  for (const [re, name] of VENDORS) {
    if (re.test(s)) return name
  }
  return ''
}

function androidModel(s) {
  const raw = (s.match(ANDROID_MODEL_RE)?.[1] || '').trim()
  if (!raw || USELESS_MODEL.test(raw)) return ''
  const model = raw.slice(0, 40)
  if (BRAND_WORDS.test(model)) return model
  const vendor = detectVendor(model) || detectVendor(s)
  return vendor ? `${vendor} ${model}` : model
}

function parseUa(ua) {
  const s = String(ua || '')
  const has = (re) => re.test(s)
  const grab = (re) => (s.match(re) || [])[1] || ''

  /*
   * 爬虫要最先判。Googlebot 的 UA 里同时有 `Android` 和 `Chrome/`，
   * 放在后面判的话它会被当成一台安卓手机记进 PV —— 旧版就是这么漏的。
   */
  const bot = /bot\b|spider|crawler|slurp|bingpreview|facebookexternalhit|feedfetcher|headlesschrome|python-requests|curl\//i.test(s)

  let os = 'Unknown'
  if (has(/Windows NT 10\.0/)) os = 'Windows 10/11'
  else if (has(/Windows NT/)) os = 'Windows'
  else if (has(/iPhone|iPad|iPod/)) {
    const v = grab(/OS (\d+[._]\d+(?:[._]\d+)?) like Mac OS X/).replace(/_/g, '.')
    os = v ? `iOS ${v}` : 'iOS'
  } else if (has(/Android/)) {
    const v = grab(/Android (\d+(?:\.\d+)?)/)
    os = v ? `Android ${v}` : 'Android'
  } else if (has(/Mac OS X/)) {
    /* Safari 从 10_15_7 之后就冻在这个值上了，写出来只会误导，所以不带版本。 */
    os = 'macOS'
  } else if (has(/CrOS/)) os = 'ChromeOS'
  else if (has(/Linux/)) os = 'Linux'

  let browser = 'Unknown'
  if (bot) browser = '爬虫'
  else if (has(/Edg\//)) browser = `Edge ${grab(/Edg\/(\d+)/)}`.trim()
  else if (has(/OPR\/|Opera/)) browser = `Opera ${grab(/(?:OPR|Opera)[/ ](\d+)/)}`.trim()
  else if (has(/MicroMessenger/)) browser = `微信内置 ${grab(/MicroMessenger\/(\d+\.\d+)/)}`.trim()
  else if (has(/QQBrowser/)) browser = `QQ 浏览器 ${grab(/QQBrowser\/(\d+)/)}`.trim()
  else if (has(/Firefox\//)) browser = `Firefox ${grab(/Firefox\/(\d+)/)}`.trim()
  else if (has(/Chrome\//)) browser = `Chrome ${grab(/Chrome\/(\d+)/)}`.trim()
  else if (has(/Safari\//)) browser = `Safari ${grab(/Version\/(\d+(?:\.\d+)?)/)}`.trim()

  let device = '桌面'
  if (bot) device = '爬虫'
  else if (has(/iPad|Tablet/)) device = '平板'
  else if (has(/Mobi|iPhone|Android.*Mobile/)) device = '手机'

  /*
   * model 是「尽量」拿到的那一段，拿不到就是空字符串，
   * 后台显示时回落到 device（手机 / 平板 / 桌面），不留空。
   */
  let model = ''
  if (!bot) {
    if (has(/iPhone/)) model = 'iPhone'
    else if (has(/iPad/)) model = 'iPad'
    else if (has(/Android/)) model = androidModel(s)
  }

  return { os, browser, device, model, bot }
}

/**
 * 取真实客户端 IP。站点挂在 Cloudflare 后面，CF→Vercel 这一跳会把 `x-forwarded-for`
 * 第一段填成 CF 边缘节点、不是访客真实 IP（真实 IP 在 CF 单独转发的 `cf-connecting-ip`
 * 里），所以要优先取它；`x-real-ip` 其次；两者都没有（没走 CF，比如本地开发）才退到
 * `x-forwarded-for`。
 */
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip']
  if (cf) return String(cf).split(',')[0].trim()
  const real = req.headers['x-real-ip']
  if (real) return String(real).split(',')[0].trim()
  const fwd = req.headers['x-forwarded-for']
  return fwd ? String(fwd).split(',')[0].trim() : ''
}

module.exports = { clientIp, parseUa }
