/**
 * Vercel Serverless Function: 记录一次访问
 *
 * 公开接口，前端每次路由变化 beacon 一条。写四样东西：
 * - `lk:visits`        LIST，最近 N 条明细（LPUSH + LTRIM 定长）
 * - `lk:pv`            总浏览量计数器
 * - `lk:uv:<日期>`     当天来过的访客 id 集合，留 45 天
 * - `lk:visitors`      HASH，vid -> 这个人的画像（首次/最近/次数/IP/设备）
 *
 * 站长自己走另一条路：`lk:owner` / `lk:owner:hits`，每台设备一行、原地覆盖，
 * 不进明细也不算 PV/UV —— 统计是用来看「别人来了没有」的。
 *
 * 访客 id = sha256(IP + UA) 前 16 位。同一台设备同一个网络下稳定，
 * 既能算「用户个体」，又不用往访客浏览器里塞追踪 cookie。
 *
 * 地理信息直接用 Vercel 边缘注入的 x-vercel-ip-* 头，不额外调第三方。
 *
 * ## 这个接口是公开的，所以有三道闸门
 *
 * 1. **来源校验**：只认同源（或 LK_VISIT_ALLOWED_ORIGINS 里显式列出）的请求。
 *    浏览器对 POST 必发 Origin（Fetch 规范），sendBeacon 也一样，所以这条
 *    不会误伤真访客，但能把 `curl` 直接挡在门外——一条 Redis 命令都不花。
 * 2. **每 IP 限速**：固定窗口计数，超了就当作记过一样静默返回。
 *    **故意不回 429**：回 429 等于告诉刷的人「你被挡住了，换个 IP 吧」。
 * 3. **爬虫不计**：Googlebot 这类 UA 只累加一个总数，不进 PV / UV / 明细。
 *
 * 还有一道是容量闸门：`lk:visitors` 三兄弟是 HASH，既没有 LTRIM 也没有 TTL，
 * 而 vid 由 IP+UA 算出来 —— 伪造 UA 轮换就能造出无限个字段。所以新访客的
 * 画像只在基数低于 VISITOR_MAX 时才建，老访客照常更新。
 *
 * 真正扛量的一层不在这里，而是 Vercel Firewall 的限速规则：那一层在函数
 * 之前就把请求拦掉，既不算函数调用也不产生 Upstash 命令。这里这几道是兜底。
 */

const crypto = require('crypto')
/*
 * 注意 require 路径：`../lib/...` 是相对**生成后**的 `api/visit.js` 写的
 * （`scripts/copy-api.mjs` 把这个文件拍到根目录 api/）。在 docs/api/ 原地
 * 是解析不到的——这个目录只是源，从来不会被执行。
 */
const { kvReady, kvCmd, kvPipeline } = require('../lib/lk-kv.js')
const { clientIp, parseUa } = require('../lib/lk-ua.js')

/** 明细保留条数。Upstash 免费档按命令计费，定长列表让占用可预期。 */
const LOG_MAX = 800
/** UV 集合保留天数，够画一个月的趋势。 */
const UV_TTL_SEC = 45 * 24 * 60 * 60
/** 同一个人同一个页面 30 秒内只算一次，挡住刷新和来回横跳。 */
const DEDUPE_TTL_SEC = 30
/**
 * 单 IP 每分钟上限。定得比「人快速翻页」高一截（正常浏览撑死二三十条），
 * 因为学校 / 公司 / 运营商 CGNAT 会让很多人共用一个出口 IP，
 * 宁可放过也不要把一整栋楼的人一起挡了。
 */
const RATE_MAX = 120
const RATE_WINDOW_SEC = 60
/**
 * 「用户个体」画像的基数上限。5000 个字段大约 1MB 出头，
 * 对一个个人博客来说远超真实访客量，到顶基本只可能是被刷。
 */
const VISITOR_MAX = 5000
/**
 * 站长自己的设备上限。自己的访问不进明细、不算 PV/UV（见下面的 owner 分支），
 * 只在这个 HASH 里留「每台设备一行、原地更新」，所以手机 + 电脑撑死两三行。
 */
const OWNER_MAX = 6

function header(req, name) {
  const raw = req.headers[name]
  if (!raw) return ''
  try {
    return decodeURIComponent(String(raw))
  } catch {
    return String(raw)
  }
}

function today() {
  // 站点面向国内，按东八区切天，跟不蒜子的直觉一致。
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

function cleanPath(input) {
  const raw = String(input || '/')
  if (!raw.startsWith('/')) return '/'
  return raw.split('#')[0].split('?')[0].slice(0, 200)
}

function hostOf(url) {
  try {
    return new URL(String(url)).host
  } catch {
    return ''
  }
}

/**
 * 只放行本站发起的请求。写法和 translate-page.js 的 isAllowedOrigin 一脉相承，
 * 区别是这里**不**给「没有 Origin」放行：那条豁免是留给脚本调用的，
 * 而这个接口只该被浏览器打，放行等于整道闸门形同虚设。
 */
function isSameSite(req) {
  const allowList = String(process.env.LK_VISIT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const origin = req.headers.origin
  if (origin) {
    if (allowList.includes(String(origin))) return true
    return hostOf(origin) === req.headers.host
  }
  /* 个别隐私设置会剥掉 Origin，退一步用 Referer 认。 */
  const referer = req.headers.referer
  if (referer) return hostOf(referer) === req.headers.host
  return false
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  // 没接 Redis 时静默成功：本地开发和未配置的部署都不该因为统计报错。
  if (!kvReady()) return res.status(200).json({ ok: true, skipped: 'no-kv' })

  /* 来源不对就到此为止，一条 Redis 命令都不花。 */
  if (!isSameSite(req)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' })
  }

  /*
   * dev 和线上给的 req.body 不是一种东西：Vercel 会帮你解析成对象，
   * config.js 的 lk-dev-api 插件给的是原始字符串。translate-page.js / git-push.js
   * 早就用这个写法兜住了，这里跟着用同一套。
   */
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const ip = clientIp(req)
  const ua = String(req.headers['user-agent'] || '').slice(0, 400)
  const { os, browser, device, model, bot } = parseUa(ua)

  try {
    /*
     * 爬虫最先挡：它们量大且没有分析价值，混进 PV 只会让数字失真。
     * 但完全丢掉就看不到「搜索引擎到底来没来」，所以留一个总数，一条命令。
     */
    if (bot) {
      await kvCmd('INCR', 'lk:bots')
      return res.status(200).json({ ok: true })
    }

    /*
     * 固定窗口限速。key 里带分钟数，所以每次都重设 TTL 也不会把窗口拖长，
     * 省掉 `EXPIRE ... NX`（Upstash 对这些 flag 的支持不好赌）。
     */
    const minute = Math.floor(Date.now() / (RATE_WINDOW_SEC * 1000))
    const rateKey = `lk:rate:${ip}:${minute}`
    const [hits] = await kvPipeline([
      ['INCR', rateKey],
      ['EXPIRE', rateKey, RATE_WINDOW_SEC + 30],
    ])
    /* 超限就当作正常记过一次返回，不给对方任何「被挡住了」的信号。 */
    if (Number(hits) > RATE_MAX) return res.status(200).json({ ok: true })

    const vid = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}`)
      .digest('hex')
      .slice(0, 16)

    const path = cleanPath(body.path)
    const day = today()
    const nowIso = new Date().toISOString()

    const place = {
      ip,
      country: header(req, 'x-vercel-ip-country'),
      region: header(req, 'x-vercel-ip-country-region'),
      city: header(req, 'x-vercel-ip-city'),
      device,
      model,
      os,
      browser,
    }

    /*
     * 站长自己的访问：**不进明细、不算 PV / UV / 用户个体**。
     *
     * 自己开着后台来回点，一天就能把 800 条的明细刷掉一半，PV 也全是自己的。
     * 所以这里换一种记法 —— 每台设备在 `lk:owner` 里占一行，原地覆盖：
     * 后台看到的永远是「我的手机刚才在 /article/」这一两行实时状态，而不是流水账。
     * 也因此这里**故意不走 30 秒去重锁**，否则「实时」就要等半分钟。
     *
     * owner 是前端自报的（reportVisit 里读登录态），不参与任何鉴权：
     * 伪造它唯一的效果是把自己从统计里抹掉，没有便宜可占。
     */
    if (body.owner === true) {
      const [exists, ownerCount] = await kvPipeline([
        ['HEXISTS', 'lk:owner', vid],
        ['HLEN', 'lk:owner'],
      ])
      if (Number(exists) !== 1 && Number(ownerCount) >= OWNER_MAX) {
        return res.status(200).json({ ok: true, owner: true, skipped: 'owner-max' })
      }
      await kvPipeline([
        ['HSET', 'lk:owner', vid, JSON.stringify({ t: nowIso, path, ...place })],
        ['HINCRBY', 'lk:owner:hits', vid, 1],
      ])
      return res.status(200).json({ ok: true, owner: true })
    }

    // 先抢去重锁：NX 没抢到说明 30 秒内已经记过同一个人同一个页面。
    // 顺带把画像基数读回来，省一次往返。
    const [locked, visitorCount] = await kvPipeline([
      ['SET', `lk:seen:${vid}:${path}`, '1', 'NX', 'EX', DEDUPE_TTL_SEC],
      ['HLEN', 'lk:visitors'],
    ])
    if (!locked) return res.status(200).json({ ok: true, deduped: true })

    /*
     * 基数到顶之后只更新老访客，不再收新 vid。多花的这条 HEXISTS 只在
     * 到顶之后才会发生，正常情况下这一路是不走的。
     */
    let writeProfile = Number(visitorCount) < VISITOR_MAX
    if (!writeProfile) {
      writeProfile = Number(await kvCmd('HEXISTS', 'lk:visitors', vid)) === 1
    }

    const entry = {
      t: nowIso,
      vid,
      path,
      ...place,
      ua,
      ref: String(body.ref || '').slice(0, 300),
      screen: String(body.screen || '').slice(0, 20),
    }

    const profileField = JSON.stringify({
      last: nowIso,
      ip,
      city: place.city,
      country: place.country,
      device,
      model,
      os,
      browser,
    })

    await kvPipeline([
      ['LPUSH', 'lk:visits', JSON.stringify(entry)],
      ['LTRIM', 'lk:visits', 0, LOG_MAX - 1],
      ['INCR', 'lk:pv'],
      ['SADD', `lk:uv:${day}`, vid],
      ['EXPIRE', `lk:uv:${day}`, UV_TTL_SEC],
      ...(writeProfile
        ? [
            ['HSET', 'lk:visitors', vid, profileField],
            // 首访时间单独放一个 hash，HSETNX 保证只写一次。
            ['HSETNX', 'lk:visitors:first', vid, nowIso],
            ['HINCRBY', 'lk:visitors:hits', vid, 1],
          ]
        : []),
    ])
  } catch (err) {
    // 统计挂了不能影响访客浏览，吞掉并回 200。
    return res.status(200).json({ ok: true, skipped: 'kv-error' })
  }

  return res.status(200).json({ ok: true })
}
