/**
 * Vercel Serverless Function: 后台读访客日志
 *
 * 只给管理员看：会话 cookie 或者请求头里的账号密码，两条路径都认（见 lk-admin-auth.js）。
 *
 * - `GET  /api/visitor-log?limit=100` -> 明细 + 汇总
 * - `POST /api/visitor-log` { action: 'clear' } -> 清空全部统计
 */

/*
 * 注意 require 路径：`../lib/...` 是相对**生成后**的 `api/visitor-log.js` 写的
 * （`scripts/copy-api.mjs` 把这个文件拍到根目录 api/）。在 docs/api/ 原地
 * 是解析不到的——这个目录只是源，从来不会被执行。
 */
const { kvReady, kvCmd, kvPipeline } = require('../lib/lk-kv.js')
const { verifyAdmin } = require('../lib/lk-admin-auth.js')
const { classifyVisits } = require('../lib/lk-visit-classify.js')

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function dayKeys(count) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000 - i * 86400000)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function parseJson(raw) {
  if (!raw) return null
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Upstash 的 HGETALL 走 REST 时回的是扁平数组，转成对象。 */
function toObject(flat) {
  if (!Array.isArray(flat)) return flat && typeof flat === 'object' ? flat : {}
  const out = {}
  for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1]
  return out
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (!kvReady()) {
    return res
      .status(503)
      .json({ ok: false, error: 'Visitor log store unavailable', needsKv: true })
  }

  /*
   * dev 和线上给的 req.body 不是一种东西：Vercel 会帮你解析成对象，
   * config.js 的 lk-dev-api 插件给的是原始字符串。translate-page.js / git-push.js
   * 早就用这个写法兜住了，这里跟着用同一套。
   */
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  const auth = await verifyAdmin(req, body)
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: 'Authentication failed' })
  }

  if (req.method === 'POST') {
    if (body.action !== 'clear') {
      return res.status(400).json({ ok: false, error: 'Unknown action' })
    }
    const days = dayKeys(45).map((d) => ['DEL', `lk:uv:${d}`])
    await kvPipeline([
      ['DEL', 'lk:visits'],
      ['DEL', 'lk:pv'],
      ['DEL', 'lk:visitors'],
      ['DEL', 'lk:visitors:first'],
      ['DEL', 'lk:visitors:hits'],
      ['DEL', 'lk:bots'],
      /* 站长自己的那一两行也一起清，否则「清空」之后后台还留着我自己的记录。 */
      ['DEL', 'lk:owner'],
      ['DEL', 'lk:owner:hits'],
      ...days,
    ])
    return res.status(200).json({ ok: true, cleared: true })
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number((req.query && req.query.limit) || DEFAULT_LIMIT) || DEFAULT_LIMIT),
  )
  const days = dayKeys(7)

  const [rawVisits, pv, uniqueTotal, botHits, ...uvCounts] = await kvPipeline([
    ['LRANGE', 'lk:visits', 0, limit - 1],
    ['GET', 'lk:pv'],
    ['HLEN', 'lk:visitors'],
    /* 爬虫不进 PV / UV / 明细（见 visit.js），只有这一个总数能证明它们来过。 */
    ['GET', 'lk:bots'],
    ...days.map((d) => ['SCARD', `lk:uv:${d}`]),
  ])

  /*
   * 老数据里可能还留着 owner:true 的行（那时候站长的访问也进明细）。
   * 现在这类访问根本不写进来了，这里顺手把历史遗留的滤掉，列表就只剩别人。
   */
  const rows = (rawVisits || []).map(parseJson).filter((row) => row && !row.owner)

  const hits = toObject(await kvCmd('HGETALL', 'lk:visitors:hits').catch(() => ({})))
  const first = toObject(await kvCmd('HGETALL', 'lk:visitors:first').catch(() => ({})))
  const profiles = toObject(await kvCmd('HGETALL', 'lk:visitors').catch(() => ({})))

  /* 「用户个体」列表：按访问次数排，只回前 50 个，够后台一屏。 */
  const visitors = Object.keys(profiles)
    .map((vid) => ({
      vid,
      hits: Number(hits[vid] || 0),
      first: first[vid] || '',
      ...(parseJson(profiles[vid]) || {}),
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 50)

  /* 站长自己的设备：每台一行，实时覆盖，最多 OWNER_MAX 行（见 visit.js）。 */
  const ownerRaw = toObject(await kvCmd('HGETALL', 'lk:owner').catch(() => ({})))
  const ownerHits = toObject(await kvCmd('HGETALL', 'lk:owner:hits').catch(() => ({})))
  const owner = Object.keys(ownerRaw)
    .map((vid) => ({ vid, hits: Number(ownerHits[vid] || 0), ...(parseJson(ownerRaw[vid]) || {}) }))
    .sort((a, b) => String(b.t || '').localeCompare(String(a.t || '')))

  /*
   * 判定在服务端做，因为它需要整批数据：会话归并要看同一 UA 在一段时间里翻了几页，
   * 版本落后与否要跟这批里出现过的最高版本比，站长那一档还要比对 lk:owner 的设备。
   * 单看一行是判不出来的，所以放在 owner 取回之后。
   */
  const recent = classifyVisits(rows, owner)

  return res.status(200).json({
    ok: true,
    owner,
    pv: Number(pv || 0),
    bots: Number(botHits || 0),
    uniqueTotal: Number(uniqueTotal || 0),
    uvToday: Number(uvCounts[0] || 0),
    daily: days.map((date, i) => ({ date, uv: Number(uvCounts[i] || 0) })),
    recent,
    visitors,
  })
}
