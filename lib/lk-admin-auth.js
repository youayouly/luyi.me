/**
 * 后台身份校验。放 `lib/` 的原因见 lk-kv.js 顶部注释。
 *
 * 两条认证路径，写接口两条都认：
 *
 * 1. **会话 cookie**（新）：`/api/login` 校验 LK_SITE_USER/LK_SITE_PASS 之后，
 *    在 Redis 里写 **`lk:admin:session` 这一个 key**，并下发 HttpOnly cookie。
 *    单 key 就是「同时只允许一个管理会话」的全部实现——再有人登录成功，
 *    这个 key 被覆盖，上一份 token 立刻失效。
 * 2. **请求体里的账号密码**（旧）：PublishFab 等老调用方还在用。保留兼容，
 *    但前端不再硬编码密码，所以这条路径只有手动带凭据时才会走到。
 *
 * 没有配 KV 时会话路径不可用（无处存 token），此时只剩路径 2。
 */

const crypto = require('crypto')
const { kvReady, kvCmd, kvPipeline } = require('./lk-kv.js')
const { parseUa } = require('./lk-ua.js')

const SESSION_KEY = 'lk:admin:session'
/** 后台登录流水（成功和失败都记），定长列表。 */
const LOGIN_LOG_KEY = 'lk:admin:logins'
const LOGIN_LOG_MAX = 50
/** 每个 IP 15 分钟内允许的失败次数，超了先冷却。 */
const FAIL_WINDOW_SEC = 15 * 60
const FAIL_MAX = 10
const SESSION_COOKIE = 'lk_admin'
/** 非 HttpOnly 的「我可能有会话」标记，见 sessionCookies() 注释。 */
const HINT_COOKIE = 'lk_admin_hint'
/**
 * 7 天，而且每次 `GET /api/login` 认出是本人就顺延（见 renewSession）。
 *
 * 原来是 12 小时：站长关掉浏览器第二天再进来必然已经过期，而前端的乐观标记又存在
 * sessionStorage 里、随标签页一起没了，于是每次都要重登一遍。滑动过期的效果是
 * 「只要一周内来过一次就一直是登录态」，而不是给一个永不失效的 token。
 */
const SESSION_TTL_SEC = 7 * 24 * 60 * 60

function readCookie(req, name) {
  const raw = req.headers ? req.headers.cookie : ''
  if (!raw) return ''
  for (const part of String(raw).split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      return part.slice(idx + 1).trim()
    }
  }
  return ''
}

/** 定长比较，避免用 `!==` 泄漏「前几位对了」这种时序信息。 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8')
  const bufB = Buffer.from(String(b || ''), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function credsMatch(user, pass) {
  const expectUser = process.env.LK_SITE_USER
  const expectPass = process.env.LK_SITE_PASS
  if (!expectUser || !expectPass) return false
  return safeEqual(user, expectUser) && safeEqual(pass, expectPass)
}

function buildCookie(name, value, maxAgeSec, httpOnly) {
  const parts = [`${name}=${value}`, 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSec}`]
  if (httpOnly) parts.push('HttpOnly')
  // 本地 http 开发时带 Secure 会让 cookie 直接被丢掉。
  if (process.env.VERCEL) parts.push('Secure')
  return parts.join('; ')
}

/**
 * 两个 cookie：
 * - `lk_admin`      HttpOnly，真 token，JS 读不到。
 * - `lk_admin_hint` 可读，只是个 '1'。
 *
 * hint 存在的唯一理由：LoginGate 在每个页面都会挂载，如果无脑去 `GET /api/login`
 * 校验会话，等于每个匿名访客都白白打一次 Serverless。JS 看不见 HttpOnly cookie，
 * 所以用这个不含任何机密的标记决定「值不值得去问服务端」。它本身不是凭据——
 * 伪造它只会换来一次 401。
 */
function sessionCookies(token, maxAgeSec) {
  return [
    buildCookie(SESSION_COOKIE, token, maxAgeSec, true),
    buildCookie(HINT_COOKIE, token ? '1' : '', maxAgeSec, false),
  ]
}

/** 登录成功后调用：顶掉上一个会话，写 cookie。 */
async function issueSession(res, meta) {
  const token = crypto.randomBytes(32).toString('hex')
  const record = {
    token,
    at: new Date().toISOString(),
    ip: meta && meta.ip ? meta.ip : '',
    ua: meta && meta.ua ? meta.ua : '',
  }
  await kvCmd('SET', SESSION_KEY, JSON.stringify(record), 'EX', SESSION_TTL_SEC)
  res.setHeader('Set-Cookie', sessionCookies(token, SESSION_TTL_SEC))
  return record
}

/**
 * 滑动过期：确认是本人之后把 Redis 的 TTL 和两个 cookie 一起往后推。
 *
 * 只在校验通过（token 对得上）之后调用 —— 伪造 hint 的人到不了这里。
 * 不换 token：换了会让另一个标签页手里的那份立刻失效，等于自己把自己顶下线。
 */
async function renewSession(res, token) {
  if (!token) return
  await kvCmd('EXPIRE', SESSION_KEY, SESSION_TTL_SEC).catch(() => {})
  res.setHeader('Set-Cookie', sessionCookies(token, SESSION_TTL_SEC))
}

async function revokeSession(res) {
  await kvCmd('DEL', SESSION_KEY).catch(() => {})
  res.setHeader('Set-Cookie', sessionCookies('', 0))
}

/** 读当前生效的会话（不校验请求方），后台「当前登录设备」那一行要用。 */
async function readSession() {
  if (!kvReady()) return null
  const raw = await kvCmd('GET', SESSION_KEY).catch(() => null)
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

/**
 * 记一条登录流水。**永远不记密码**，只记尝试的用户名。
 * 失败的那些才是重点：密码是公开过的字符串，所以「有人在试」是必须看得见的信号。
 */
async function recordLoginAttempt(meta) {
  if (!kvReady()) return
  const { os, browser, device, model } = parseUa(meta.ua)
  const entry = {
    t: new Date().toISOString(),
    ok: Boolean(meta.ok),
    ip: meta.ip || '',
    user: String(meta.user || '').slice(0, 60),
    device,
    /* 拿得到型号就记型号，后台显示时优先用它（见 lk-ua.js 顶部关于命中率的说明）。 */
    model,
    os,
    browser,
    ua: String(meta.ua || '').slice(0, 300),
    /* 成功登录时顶掉的那个会话的 IP，用来回答「谁把我挤下去了」。 */
    kicked: meta.kicked || '',
  }
  await kvPipeline([
    ['LPUSH', LOGIN_LOG_KEY, JSON.stringify(entry)],
    ['LTRIM', LOGIN_LOG_KEY, 0, LOGIN_LOG_MAX - 1],
  ]).catch(() => {})
}

/** 读登录流水，给后台「登录会话」面板用。 */
async function readLoginLog(limit = LOGIN_LOG_MAX) {
  if (!kvReady()) return []
  const raw = await kvCmd('LRANGE', LOGIN_LOG_KEY, 0, Math.max(0, limit - 1)).catch(() => [])
  return (raw || [])
    .map((item) => {
      try {
        return typeof item === 'string' ? JSON.parse(item) : item
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/**
 * 失败次数节流。密码在旧 bundle 里公开过，没有这层的话别人可以无限次撞。
 * 只按 IP 计数、15 分钟自动过期，正确的密码不受影响，锁不死你自己。
 * @returns {Promise<{ blocked: boolean, retryAfter: number }>}
 */
async function checkLoginThrottle(ip) {
  if (!kvReady() || !ip) return { blocked: false, retryAfter: 0 }
  const count = Number(await kvCmd('GET', `lk:admin:fail:${ip}`).catch(() => 0)) || 0
  if (count < FAIL_MAX) return { blocked: false, retryAfter: 0 }
  const ttl = Number(await kvCmd('TTL', `lk:admin:fail:${ip}`).catch(() => 0)) || FAIL_WINDOW_SEC
  return { blocked: true, retryAfter: Math.max(1, ttl) }
}

/** 登录失败后加一次计数；窗口从第一次失败起算。 */
async function bumpLoginFailure(ip) {
  if (!kvReady() || !ip) return
  const key = `lk:admin:fail:${ip}`
  const [count] = await kvPipeline([['INCR', key]]).catch(() => [0])
  if (Number(count) === 1) await kvCmd('EXPIRE', key, FAIL_WINDOW_SEC).catch(() => {})
}

/** 登录成功后清掉该 IP 的失败计数。 */
async function clearLoginFailures(ip) {
  if (!kvReady() || !ip) return
  await kvCmd('DEL', `lk:admin:fail:${ip}`).catch(() => {})
}

/**
 * 判断这个请求是不是管理员。
 * @returns {Promise<{ ok: boolean, via: 'session'|'creds'|'', session: object|null }>}
 */
async function verifyAdmin(req, body) {
  const token = readCookie(req, SESSION_COOKIE)
  if (token) {
    const session = await readSession()
    if (session && session.token && safeEqual(token, session.token)) {
      return { ok: true, via: 'session', session }
    }
  }

  const src = body || req.body || {}
  const user = src.username || src.user || req.headers['x-lk-user'] || ''
  const pass = src.password || src.pass || req.headers['x-lk-pass'] || ''
  if (user && pass && credsMatch(user, pass)) {
    return { ok: true, via: 'creds', session: null }
  }

  return { ok: false, via: '', session: null }
}

module.exports = {
  FAIL_MAX,
  HINT_COOKIE,
  LOGIN_LOG_KEY,
  SESSION_COOKIE,
  SESSION_KEY,
  SESSION_TTL_SEC,
  bumpLoginFailure,
  checkLoginThrottle,
  clearLoginFailures,
  credsMatch,
  issueSession,
  readCookie,
  readLoginLog,
  readSession,
  recordLoginAttempt,
  renewSession,
  revokeSession,
  safeEqual,
  verifyAdmin,
}
