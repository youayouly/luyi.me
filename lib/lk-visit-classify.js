/*
 * 访客真人 / 机器判定。
 *
 * 为什么不看 IP：`clientIp()` 现在拿到的是访客真实 IP 了（`lib/lk-ua.js` 2026-08-31
 * 修了 CF 边缘节点误取的问题），但真实 IP 照样不稳定——手机在基站之间切换、
 * 家用宽带 DHCP 重新拨号，几分钟内就能换一个 IP。所以这里的会话归并和所有信号
 * 依旧只用 UA + 地区 + 路径 + 时间，不依赖 IP，判定结果不受这次修复影响。
 *
 * 输出的是倾向性分数，不是结论：0 最像机器，100 最像真人，50 是「没有任何信号」。
 */

const HUMAN_MIN = 65
const BOT_MAX = 35

/* 会话窗口：同一 UA + 同一地区、间隔 10 分钟以内的访问算一段浏览。 */
const SESSION_GAP_MS = 10 * 60 * 1000

/*
 * 扫描器指纹路径。这些不是站点里存在的地址，人不会手打，
 * 命中即视为探测（日志里出现过 /x 和 /__probe__）。
 */
const PROBE_PATH =
  /(^\/(x|__probe__|admin|wp-|wordpress|xmlrpc|phpmyadmin|\.env|\.git|config|shell|vendor|cgi-bin))|(\.(php|asp|aspx|jsp|env|sql|bak|yml|ini)$)/i

/* 详情页：/tech/<slug>.html、/article/<slug>.html，而不是各自的索引页。 */
const LEAF_PATH = /^\/(tech|article)\/[^/]+\.html$/i

function toTime(t) {
  const ms = Date.parse(t)
  return Number.isFinite(ms) ? ms : 0
}

function isUnknownUa(row) {
  const unknown = (v) => !v || v === 'Unknown' || v === '未知'
  return unknown(row.browser) && unknown(row.os)
}

/* 从 "Chrome 152" 这类字段里取主版本号。 */
function majorVersion(browser) {
  const m = /(\d+)/.exec(String(browser || ''))
  return m ? Number(m[1]) : 0
}

/*
 * 基线版本从日志自己算，而不是写死一个数字——写死的版本号三个月后就会
 * 把所有正常访客判成机器。取同名浏览器出现过的最高主版本作为「当前版本」。
 */
function buildVersionBaseline(rows) {
  const max = new Map()
  for (const row of rows) {
    const name = String(row.browser || '').replace(/\s*\d+.*$/, '').trim()
    const v = majorVersion(row.browser)
    if (!name || !v) continue
    max.set(name, Math.max(max.get(name) || 0, v))
  }
  return max
}

function sessionKey(row) {
  return [row.ua || row.browser || '', row.country || '', row.city || ''].join('|')
}

/*
 * 把流水行按 UA+地区聚成会话，用来拿到「这段浏览走了几个页面、跨了多长时间」。
 * 这两个是最难伪造也最能分辨的信号：扫描器打一枪就走，人会翻页。
 */
function buildSessions(rows) {
  const byKey = new Map()
  rows.forEach((row, index) => {
    const key = sessionKey(row)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push({ row, index, at: toTime(row.t) })
  })

  const stats = new Map()
  for (const entries of byKey.values()) {
    entries.sort((a, b) => a.at - b.at)
    let group = []
    const flush = () => {
      if (!group.length) return
      const paths = new Set(group.map((e) => String(e.row.path || '')))
      const span = group[group.length - 1].at - group[0].at
      const info = {
        pages: paths.size,
        spanMs: span,
        leaf: [...paths].some((p) => LEAF_PATH.test(p)),
      }
      for (const e of group) stats.set(e.index, info)
      group = []
    }
    for (const entry of entries) {
      if (group.length && entry.at - group[group.length - 1].at > SESSION_GAP_MS) flush()
      group.push(entry)
    }
    flush()
  }
  return stats
}

/*
 * 站长自己的设备指纹。登录状态下的访问根本不进明细（走 lk:owner），
 * 所以留在流水里的都是「没登录时自己点的」——那才是要认出来的部分。
 * vid 认不了：vid = sha256(IP+UA)，而 IP 会变（换基站、断线重连），同一台设备算出来
 * 的 vid 不稳定。能稳定对上的只有设备四元组。
 */
function deviceKey(row) {
  return [row.device || '', row.model || '', row.os || '', row.browser || ''].join('|')
}

function buildOwnerKeys(ownerRows) {
  const keys = new Set()
  for (const row of Array.isArray(ownerRows) ? ownerRows : []) {
    const key = deviceKey(row)
    if (key.replace(/\|/g, '')) keys.add(key)
  }
  return keys
}

function classifyOne(row, session, baseline) {
  let score = 50
  const reasons = []
  const add = (delta, why) => {
    score += delta
    reasons.push(`${delta > 0 ? '+' : ''}${delta} ${why}`)
  }

  const path = String(row.path || '')

  /* --- 机器信号 --- */

  if (isUnknownUa(row)) add(-45, 'UA 无法识别，不是常见浏览器')
  if (PROBE_PATH.test(path)) add(-45, `探测不存在的路径 ${path}`)

  const name = String(row.browser || '').replace(/\s*\d+.*$/, '').trim()
  const v = majorVersion(row.browser)
  const newest = baseline.get(name) || 0
  if (v && newest && newest - v >= 6) {
    add(-20, `${name} ${v} 比日志里最新的 ${newest} 落后 ${newest - v} 个大版本`)
  }

  if (row.device === 'Desktop' && /linux/i.test(String(row.os || '')) && /chrome/i.test(name)) {
    add(-15, 'Linux 桌面 + Chrome，常见于无头浏览器农场')
  }

  if (row.country && !row.city) add(-10, '只解析出国家、没有城市')

  /* --- 真人信号 --- */

  if (row.model && /iphone|ipad|android|pixel|galaxy/i.test(String(row.model + row.device))) {
    add(15, '真实移动设备型号')
  }

  if (v && newest && v >= newest) add(10, '浏览器是当前版本')

  if (session) {
    if (session.pages >= 3) add(20, `同一会话翻了 ${session.pages} 个页面`)
    else if (session.pages === 2) add(8, '同一会话翻了 2 个页面')

    if (session.leaf) add(20, '点进了具体详情页，不只是索引页')

    if (session.spanMs > 20000) add(10, '会话跨度超过 20 秒，不是一瞬间打完')
  }

  score = Math.max(0, Math.min(100, score))
  const verdict = score >= HUMAN_MIN ? 'human' : score <= BOT_MAX ? 'bot' : 'suspect'
  return { verdict, score, reasons }
}

/**
 * 给一批访问流水打上判定标签。返回新数组，不改原对象。
 *
 * @param rows       lk:visits 里的流水
 * @param ownerRows  lk:owner 里的站长设备，用来把「我自己」单独摘出来
 */
function classifyVisits(rows, ownerRows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return []
  const baseline = buildVersionBaseline(list)
  const sessions = buildSessions(list)
  const ownerKeys = buildOwnerKeys(ownerRows)

  return list.map((row, index) => {
    /*
     * 站长优先于其余判定：这一档是「谁」，不是「像不像人」，
     * 混进真人里会让「有没有别人来过」这个唯一想知道的问题失真。
     */
    if (ownerKeys.has(deviceKey(row))) {
      return Object.assign({}, row, {
        verdict: 'owner',
        score: null,
        reasons: ['设备与「我的设备」里登记过的一台一致'],
      })
    }
    return Object.assign({}, row, classifyOne(row, sessions.get(index), baseline))
  })
}

module.exports = { classifyVisits, HUMAN_MIN, BOT_MAX }
