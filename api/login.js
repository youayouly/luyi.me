/**
 * Vercel Serverless Function: 后台登录 / 登出 / 会话状态
 *
 * 密码只存在服务端的 LK_SITE_USER / LK_SITE_PASS 里，前端 bundle 里不再有明文。
 * 登录成功下发 HttpOnly cookie，token 存在 Redis 的 `lk:admin:session` 单 key 上，
 * 所以**同一时间只有一个管理会话有效**：新登录会顶掉旧登录。
 *
 * - `GET  /api/login` -> { authed, session }  当前这台设备是不是登录态、谁占着会话
 * - `POST /api/login` { action: 'login', username, password }
 * - `POST /api/login` { action: 'logout' }
 */

const {
  bumpLoginFailure,
  checkLoginThrottle,
  clearLoginFailures,
  credsMatch,
  issueSession,
  readLoginLog,
  readSession,
  recordLoginAttempt,
  renewSession,
  revokeSession,
  safeEqual,
  readCookie,
  FAIL_MAX,
  SESSION_COOKIE,
} = require('../lib/lk-admin-auth.js')
/*
 * 注意 require 路径：`../lib/...` 是相对**生成后**的 `api/login.js` 写的
 * （`scripts/copy-api.mjs` 把这个文件拍到根目录 api/）。在 docs/api/ 原地
 * 是解析不到的——这个目录只是源，从来不会被执行。
 */
const { kvReady } = require('../lib/lk-kv.js')
const { clientIp } = require('../lib/lk-ua.js')

/** 只回显足够认出「是不是我自己那台」的信息，token 永远不出服务端。 */
function publicSession(session, isMine) {
  if (!session) return null
  return {
    at: session.at || '',
    ip: session.ip || '',
    ua: session.ua || '',
    isMine: Boolean(isMine),
  }
}

/**
 * 匿名调用者只配知道「有没有人占着会话」。
 *
 * 这个接口是公开的，早先版本对谁都回 at / ip / ua，等于任何人 curl 一下就知道
 * 站长上次什么时候、从哪个 IP、用什么设备登录的。同一个响应里的 logins 早就做了
 * 这个判断，session 漏了。前端匿名时也只读 authed，别的字段本来就没人用。
 * 注意别把这个套到 `replaced` 上——那个是回给刚登录成功的人的，需要完整信息。
 */
function sessionForCaller(session, isMine) {
  if (!session) return null
  return isMine ? publicSession(session, true) : { isMine: false }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!process.env.LK_SITE_USER || !process.env.LK_SITE_PASS) {
    return res.status(500).json({ ok: false, error: 'Server misconfiguration' })
  }
  if (!kvReady()) {
    // 没接 Redis 就没地方放 token，直接说清楚，别假装登录成功。
    return res
      .status(503)
      .json({ ok: false, error: 'Session store unavailable', needsKv: true })
  }

  const token = readCookie(req, SESSION_COOKIE)

  if (req.method === 'GET') {
    const session = await readSession().catch(() => null)
    const mine = Boolean(session && token && safeEqual(token, session.token))
    /*
     * 滑动过期。LoginGate 每次整页加载都会来问一次，所以「只要还在用就一直登录着」，
     * 而不是每 N 小时把自己踢下线一次。伪造 hint 的人 mine 为 false，到不了这里。
     */
    if (mine) await renewSession(res, token)
    return res.status(200).json({
      ok: true,
      authed: mine,
      session: sessionForCaller(session, mine),
      /* 登录流水只给已登录的人看，匿名请求不该知道有谁试过密码。 */
      logins: mine ? await readLoginLog() : [],
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const action = body.action === 'logout' ? 'logout' : 'login'

  if (action === 'logout') {
    const session = await readSession().catch(() => null)
    // 只允许持有当前 token 的人登出，否则任何人都能把你踢下线。
    if (session && token && safeEqual(token, session.token)) {
      await revokeSession(res)
    }
    return res.status(200).json({ ok: true, authed: false })
  }

  const ip = clientIp(req)
  const ua = String(req.headers['user-agent'] || '')

  // 撞库节流。密码在旧 bundle 里公开过，没有这层等于敞开让人试。
  const throttle = await checkLoginThrottle(ip)
  if (throttle.blocked) {
    res.setHeader('Retry-After', String(throttle.retryAfter))
    return res.status(429).json({
      ok: false,
      error: `失败次数过多，请 ${Math.ceil(throttle.retryAfter / 60)} 分钟后再试。`,
      retryAfter: throttle.retryAfter,
    })
  }

  if (!credsMatch(body.username, body.password)) {
    await bumpLoginFailure(ip)
    await recordLoginAttempt({ ok: false, ip, ua, user: body.username })
    return res
      .status(401)
      .json({ ok: false, error: 'Username or password is incorrect.' })
  }

  const previous = await readSession().catch(() => null)
  const record = await issueSession(res, { ip, ua })
  await clearLoginFailures(ip)
  await recordLoginAttempt({
    ok: true,
    ip,
    ua,
    user: body.username,
    kicked: previous ? previous.ip || 'unknown' : '',
  })

  return res.status(200).json({
    ok: true,
    authed: true,
    session: publicSession(record, true),
    /* 上一个会话是别人（IP 不同）时前端会提示「已把某台设备顶下线」。 */
    replaced: previous ? publicSession(previous, false) : null,
    logins: await readLoginLog(),
  })
}
