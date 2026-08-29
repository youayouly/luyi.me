/**
 * 后台会话 + 访客日志接口的行为测试。
 *
 * 跟 tests/ 里其他几个「读源码文本」的布局守卫不一样，这个是真的把
 * `api/*.js` 当函数跑起来，用一个内存 Map 假装 Upstash 的 REST 端点。
 * 重点验三件事：
 *   1. 环境变量缺失时的降级路径（这套东西最容易在线上踩的坑）
 *   2. 密码错 -> 401，密码对 -> 下发 cookie
 *   3. **单会话**：第二次登录必须让第一次的 token 立刻失效
 *
 * 跑法：node tests/admin-session-visitor-log.test.mjs
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const KV_URL = 'https://fake-kv.upstash.io'
const KV_TOKEN = 'fake-token'
const USER = 'test-user'
const PASS = 'test-pass'

/* ---------- 假的 Upstash REST 端点 ---------- */

const store = new Map()

function runCommand(args) {
  const [rawCmd, ...rest] = args
  const cmd = String(rawCmd).toUpperCase()
  const key = rest[0]

  switch (cmd) {
    case 'SET': {
      // SET key value [NX] [EX n] —— 只实现这次用到的这几个 flag
      const flags = rest.slice(2).map((f) => String(f).toUpperCase())
      if (flags.includes('NX') && store.has(key)) return null
      store.set(key, rest[1])
      return 'OK'
    }
    case 'GET':
      return store.has(key) ? store.get(key) : null
    case 'DEL':
      return store.delete(key) ? 1 : 0
    case 'EXPIRE':
      return 1
    case 'TTL':
      return store.has(key) ? 900 : -2
    case 'INCR': {
      const next = Number(store.get(key) || 0) + 1
      store.set(key, String(next))
      return next
    }
    case 'LPUSH': {
      const list = store.get(key) || []
      list.unshift(rest[1])
      store.set(key, list)
      return list.length
    }
    case 'LTRIM': {
      const list = store.get(key) || []
      store.set(key, list.slice(Number(rest[1]), Number(rest[2]) + 1))
      return 'OK'
    }
    case 'LRANGE': {
      const list = store.get(key) || []
      return list.slice(Number(rest[1]), Number(rest[2]) + 1)
    }
    case 'SADD': {
      const set = store.get(key) || new Set()
      const had = set.has(rest[1])
      set.add(rest[1])
      store.set(key, set)
      return had ? 0 : 1
    }
    case 'SCARD':
      return (store.get(key) || new Set()).size
    case 'HSET': {
      const hash = store.get(key) || new Map()
      hash.set(rest[1], rest[2])
      store.set(key, hash)
      return 1
    }
    case 'HSETNX': {
      const hash = store.get(key) || new Map()
      if (hash.has(rest[1])) return 0
      hash.set(rest[1], rest[2])
      store.set(key, hash)
      return 1
    }
    case 'HINCRBY': {
      const hash = store.get(key) || new Map()
      const next = Number(hash.get(rest[1]) || 0) + Number(rest[2])
      hash.set(rest[1], String(next))
      store.set(key, hash)
      return next
    }
    case 'HEXISTS':
      return (store.get(key) || new Map()).has(rest[1]) ? 1 : 0
    case 'HLEN':
      return (store.get(key) || new Map()).size
    case 'HGETALL': {
      const flat = []
      for (const [k, v] of store.get(key) || new Map()) flat.push(k, v)
      return flat
    }
    default:
      throw new Error(`fake KV: unhandled ${cmd}`)
  }
}

function installFakeKv() {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    const isPipeline = String(url).endsWith('/pipeline')
    const result = isPipeline
      ? body.map((cmd) => ({ result: runCommand(cmd) }))
      : { result: runCommand(body) }
    return {
      ok: true,
      status: 200,
      json: async () => result,
      text: async () => JSON.stringify(result),
    }
  }
}

/* ---------- 请求 / 响应替身 ---------- */

const SITE_HOST = 'www.example.com'

/**
 * 默认带上同源的 host/origin：`/api/visit` 只放行本站发起的请求，
 * 不给默认值的话每个用例都要自己写这两行。想测「来源不对」就显式覆盖。
 */
function mockReq({ method = 'GET', body = {}, headers = {}, query = {} } = {}) {
  return {
    method,
    body,
    query,
    headers: {
      'user-agent': 'test-agent',
      host: SITE_HOST,
      origin: `https://${SITE_HOST}`,
      ...headers,
    },
  }
}

function mockRes() {
  const res = {
    statusCode: 0,
    payload: null,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.payload = data
      return this
    },
    end() {
      return this
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
  }
  return res
}

/** 从 Set-Cookie 数组里取出某个 cookie 的值。 */
function cookieValue(res, name) {
  const raw = res.headers['Set-Cookie'] || []
  for (const line of Array.isArray(raw) ? raw : [raw]) {
    const [pair] = String(line).split(';')
    const idx = pair.indexOf('=')
    if (pair.slice(0, idx) === name) return pair.slice(idx + 1)
  }
  return ''
}

/** 每个用例都重新 require，免得模块级读到的 env 被上一个用例污染。 */
function loadHandler(name) {
  const file = path.join(root, 'api', `${name}.js`)
  delete require.cache[require.resolve(file)]
  delete require.cache[require.resolve(path.join(root, 'lib', 'lk-kv.js'))]
  delete require.cache[require.resolve(path.join(root, 'lib', 'lk-admin-auth.js'))]
  return require(file)
}

function clearEnv() {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.LK_SITE_USER
  delete process.env.LK_SITE_PASS
}

function setEnv() {
  process.env.KV_REST_API_URL = KV_URL
  process.env.KV_REST_API_TOKEN = KV_TOKEN
  process.env.LK_SITE_USER = USER
  process.env.LK_SITE_PASS = PASS
}

/* ---------- 用例 ---------- */

const tests = []
const test = (name, fn) => tests.push([name, fn])

test('没配 KV 时 /api/visit 静默成功，绝不让统计拖垮浏览', async () => {
  clearEnv()
  const res = mockRes()
  await loadHandler('visit')(mockReq({ method: 'POST', body: { path: '/' } }), res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.skipped, 'no-kv')
})

test('/api/visit 只收 POST', async () => {
  clearEnv()
  const res = mockRes()
  await loadHandler('visit')(mockReq({ method: 'GET' }), res)
  assert.equal(res.statusCode, 405)
})

test('没配 LK_SITE_USER 时 /api/login 回 500，而不是「密码错误」', async () => {
  clearEnv()
  const res = mockRes()
  await loadHandler('login')(mockReq({ method: 'GET' }), res)
  assert.equal(res.statusCode, 500)
})

test('配了账号但没配 KV 时 /api/login 回 503 + needsKv', async () => {
  clearEnv()
  process.env.LK_SITE_USER = USER
  process.env.LK_SITE_PASS = PASS
  const res = mockRes()
  await loadHandler('login')(mockReq({ method: 'GET' }), res)
  assert.equal(res.statusCode, 503)
  assert.equal(res.payload.needsKv, true)
})

test('密码错 -> 401，且不下发任何 cookie', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const res = mockRes()
  await loadHandler('login')(
    mockReq({ method: 'POST', body: { action: 'login', username: USER, password: 'nope' } }),
    res,
  )
  assert.equal(res.statusCode, 401)
  assert.equal(cookieValue(res, 'lk_admin'), '')
})

test('密码对 -> 下发 HttpOnly token cookie 和可读的 hint cookie', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const res = mockRes()
  await loadHandler('login')(
    mockReq({ method: 'POST', body: { action: 'login', username: USER, password: PASS } }),
    res,
  )
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.authed, true)

  const setCookie = res.headers['Set-Cookie']
  const tokenLine = setCookie.find((l) => l.startsWith('lk_admin='))
  const hintLine = setCookie.find((l) => l.startsWith('lk_admin_hint='))
  assert.match(tokenLine, /HttpOnly/, 'token cookie 必须是 HttpOnly')
  assert.doesNotMatch(hintLine, /HttpOnly/, 'hint 要能被 JS 读到，否则它就没意义了')
  assert.equal(cookieValue(res, 'lk_admin_hint'), '1')
  assert.ok(cookieValue(res, 'lk_admin').length >= 32)
})

test('单会话：第二次登录让第一次的 token 立刻失效', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')

  const first = mockRes()
  await login(
    mockReq({ method: 'POST', body: { action: 'login', username: USER, password: PASS } }),
    first,
  )
  const firstToken = cookieValue(first, 'lk_admin')

  // 第一个会话此刻是有效的
  const checkA = mockRes()
  await login(mockReq({ headers: { cookie: `lk_admin=${firstToken}` } }), checkA)
  assert.equal(checkA.payload.authed, true)

  // 另一台设备登录成功
  const second = mockRes()
  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: PASS },
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
    second,
  )
  const secondToken = cookieValue(second, 'lk_admin')
  assert.notEqual(secondToken, firstToken)
  assert.ok(second.payload.replaced, '应当报告顶掉了上一个会话')

  // 第一个会话被顶下线
  const checkB = mockRes()
  await login(mockReq({ headers: { cookie: `lk_admin=${firstToken}` } }), checkB)
  assert.equal(checkB.payload.authed, false, '旧 token 必须立刻失效')

  // 新会话有效
  const checkC = mockRes()
  await login(mockReq({ headers: { cookie: `lk_admin=${secondToken}` } }), checkC)
  assert.equal(checkC.payload.authed, true)
})

test('会话滑动过期：认出是本人就顺延 TTL 并重发 cookie，冒名的不给', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')

  const ok = mockRes()
  await login(
    mockReq({ method: 'POST', body: { action: 'login', username: USER, password: PASS } }),
    ok,
  )
  const token = cookieValue(ok, 'lk_admin')

  const expires = []
  const realCommand = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    const cmds = String(url).endsWith('/pipeline') ? body : [body]
    for (const cmd of cmds) {
      if (String(cmd[0]).toUpperCase() === 'EXPIRE' && cmd[1] === 'lk:admin:session') {
        expires.push(Number(cmd[2]))
      }
    }
    return realCommand(url, init)
  }

  const mine = mockRes()
  await login(mockReq({ headers: { cookie: `lk_admin=${token}` } }), mine)
  assert.equal(mine.payload.authed, true)
  assert.equal(expires.length, 1, '本人来看一次就该把 TTL 往后推一次')
  assert.ok(expires[0] >= 24 * 60 * 60, '顺延的时长要够跨天，否则关了浏览器第二天还是要重登')
  assert.equal(cookieValue(mine, 'lk_admin'), token, '不换 token：换了会让别的标签页立刻掉线')
  assert.equal(cookieValue(mine, 'lk_admin_hint'), '1', 'hint 要一起顺延，它是首帧判断登录态的依据')

  // 伪造 hint、没有真 token 的人，既不认证也不该续期
  const faker = mockRes()
  await login(mockReq({ headers: { cookie: 'lk_admin_hint=1' } }), faker)
  assert.equal(faker.payload.authed, false)
  assert.equal(expires.length, 1, '冒名的请求不能顺延会话')

  globalThis.fetch = realCommand
})

test('/api/visitor-log 没有身份时 401', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const res = mockRes()
  await loadHandler('visitor-log')(mockReq({ method: 'GET' }), res)
  assert.equal(res.statusCode, 401)
})

test('一次访问被记下来，并能被管理员读回；30 秒内重复上报不重复计数', async () => {
  store.clear()
  setEnv()
  installFakeKv()

  const visit = loadHandler('visit')
  const headers = {
    'x-forwarded-for': '198.51.100.7',
    'user-agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    'x-vercel-ip-country': 'CN',
    'x-vercel-ip-city': 'Shanghai',
  }

  const a = mockRes()
  await visit(mockReq({ method: 'POST', body: { path: '/about' }, headers }), a)
  assert.equal(a.payload.ok, true)
  assert.ok(!a.payload.deduped)

  // 同一个人同一个页面立刻再来一次 -> 去重
  const b = mockRes()
  await visit(mockReq({ method: 'POST', body: { path: '/about' }, headers }), b)
  assert.equal(b.payload.deduped, true)

  const res = mockRes()
  await loadHandler('visitor-log')(
    mockReq({ method: 'GET', headers: { 'x-lk-user': USER, 'x-lk-pass': PASS } }),
    res,
  )
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.pv, 1, '去重过的那一次不该计入 PV')
  assert.equal(res.payload.uvToday, 1)
  assert.equal(res.payload.uniqueTotal, 1)

  const [row] = res.payload.recent
  assert.equal(row.path, '/about')
  assert.equal(row.ip, '198.51.100.7')
  assert.equal(row.city, 'Shanghai')
  assert.equal(row.device, '手机')
  assert.equal(row.model, 'iPhone', 'iOS 拿不到具体机型，但至少要认出是 iPhone')
  assert.equal(row.os, 'iOS 17.0', '系统要带版本号')
  assert.equal(row.browser, 'Safari', '这条 UA 里没有 Version/，就只给浏览器名')

  const [person] = res.payload.visitors
  assert.equal(person.hits, 1)
  assert.ok(person.first, '首次访问时间要写进去')
})


test('站长自己的访问不进明细、不算 PV，只在「我的设备」里占一行并原地更新', async () => {
  store.clear()
  setEnv()
  installFakeKv()

  const visit = loadHandler('visit')
  const headers = {
    'x-forwarded-for': '203.0.113.9',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'x-vercel-ip-city': 'Hangzhou',
  }

  // 同一台设备连着看两个页面：不去重（要「实时」），但也只该留一行
  await visit(mockReq({ method: 'POST', body: { path: '/about', owner: true }, headers }), mockRes())
  const second = mockRes()
  await visit(mockReq({ method: 'POST', body: { path: '/article/', owner: true }, headers }), second)
  assert.equal(second.payload.owner, true)
  assert.ok(!second.payload.deduped, '自己的访问不该被 30 秒锁挡住，否则「实时」就成了半分钟')

  // 别人来一次，作为对照
  await visit(
    mockReq({
      method: 'POST',
      body: { path: '/about' },
      headers: { 'x-forwarded-for': '198.51.100.7', 'user-agent': headers['user-agent'] },
    }),
    mockRes(),
  )

  const res = mockRes()
  await loadHandler('visitor-log')(
    mockReq({ method: 'GET', headers: { 'x-lk-user': USER, 'x-lk-pass': PASS } }),
    res,
  )

  assert.equal(res.payload.pv, 1, '自己的两次访问不该计入 PV')
  assert.equal(res.payload.uniqueTotal, 1, '自己不该算成一个「用户个体」')
  assert.equal(res.payload.recent.length, 1, '明细里只该有别人')
  assert.equal(res.payload.recent[0].ip, '198.51.100.7')

  assert.equal(res.payload.owner.length, 1, '两次访问只留一行，原地覆盖')
  assert.equal(res.payload.owner[0].path, '/article/', '这一行要是最新的那次')
  assert.equal(res.payload.owner[0].hits, 2)
  assert.equal(res.payload.owner[0].city, 'Hangzhou')

  // 清空要把自己的那一行也带走
  await loadHandler('visitor-log')(
    mockReq({
      method: 'POST',
      body: { action: 'clear' },
      headers: { 'x-lk-user': USER, 'x-lk-pass': PASS },
    }),
    mockRes(),
  )
  const after = mockRes()
  await loadHandler('visitor-log')(
    mockReq({ method: 'GET', headers: { 'x-lk-user': USER, 'x-lk-pass': PASS } }),
    after,
  )
  assert.equal(after.payload.owner.length, 0, '清空之后不该还留着我自己的记录')
})

test('登录流水：成功和失败都记下来，且绝不记密码', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')

  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: 'guess-1' },
      headers: { 'x-forwarded-for': '203.0.113.5' },
    }),
    mockRes(),
  )
  const good = mockRes()
  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: PASS },
      headers: { 'x-forwarded-for': '198.51.100.20' },
    }),
    good,
  )

  const log = good.payload.logins
  assert.equal(log.length, 2, '两次尝试都要有记录')
  assert.equal(log[0].ok, true)
  assert.equal(log[0].ip, '198.51.100.20')
  assert.equal(log[1].ok, false, '失败的那次必须留痕')
  assert.equal(log[1].ip, '203.0.113.5')
  assert.equal(log[1].user, USER)

  const dumped = JSON.stringify(log)
  assert.ok(!dumped.includes(PASS), '流水里绝不能出现密码')
  assert.ok(!dumped.includes('guess-1'), '试错的密码同样不能出现')
})

test('登录流水只给已登录的人看', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')

  const ok = mockRes()
  await login(mockReq({ method: 'POST', body: { action: 'login', username: USER, password: PASS } }), ok)

  // 没有 cookie 的匿名 GET
  const anon = mockRes()
  await login(mockReq(), anon)
  assert.equal(anon.payload.authed, false)
  assert.deepEqual(anon.payload.logins, [], '匿名请求不该看到有谁试过密码')

  // 带正确 cookie
  const mine = mockRes()
  await login(mockReq({ headers: { cookie: 'lk_admin=' + cookieValue(ok, 'lk_admin') } }), mine)
  assert.ok(mine.payload.logins.length >= 1)
})

test('撞库节流：同一 IP 连续失败到上限后回 429', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')
  const ip = '203.0.113.99'

  for (let i = 0; i < 10; i += 1) {
    const r = mockRes()
    await login(
      mockReq({
        method: 'POST',
        body: { action: 'login', username: USER, password: 'wrong-' + i },
        headers: { 'x-forwarded-for': ip },
      }),
      r,
    )
    assert.equal(r.statusCode, 401, '第' + (i + 1) + '次应该还是 401')
  }

  const blocked = mockRes()
  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: PASS },
      headers: { 'x-forwarded-for': ip },
    }),
    blocked,
  )
  assert.equal(blocked.statusCode, 429, '超过上限后即便密码正确也先冷却')
  assert.ok(blocked.headers['Retry-After'], '要告诉对方多久之后再试')

  // 换个 IP 不受影响，别人撞库不能把站长自己锁死
  const other = mockRes()
  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: PASS },
      headers: { 'x-forwarded-for': '198.51.100.1' },
    }),
    other,
  )
  assert.equal(other.statusCode, 200, '节流只按 IP，不能连累别的地址')
})

test('/api/visit 只认同源请求：Origin 不对直接 403，一条命令都不花', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const visit = loadHandler('visit')

  const evil = mockRes()
  await visit(
    mockReq({
      method: 'POST',
      body: { path: '/' },
      headers: { origin: 'https://evil.example.org' },
    }),
    evil,
  )
  assert.equal(evil.statusCode, 403)
  assert.equal(store.size, 0, '被挡下的请求不该在 Redis 里留下任何东西')

  // 连 Origin 都不带的（curl 直打）同样挡掉
  const bare = mockRes()
  await visit(
    { method: 'POST', body: { path: '/' }, query: {}, headers: { host: SITE_HOST } },
    bare,
  )
  assert.equal(bare.statusCode, 403)

  // Origin 缺失但 Referer 是本站（个别隐私设置会剥掉 Origin）-> 放行
  const viaReferer = mockRes()
  await visit(
    {
      method: 'POST',
      body: { path: '/' },
      query: {},
      headers: { host: SITE_HOST, referer: `https://${SITE_HOST}/about`, 'user-agent': 'test-agent' },
    },
    viaReferer,
  )
  assert.equal(viaReferer.statusCode, 200)
  assert.ok(store.has('lk:pv'), '同源请求要正常记下来')
})

test('爬虫不进 PV / UV / 明细，只累加一个总数', async () => {
  store.clear()
  setEnv()
  installFakeKv()

  const googlebot =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

  const res = mockRes()
  await loadHandler('visit')(
    mockReq({ method: 'POST', body: { path: '/' }, headers: { 'user-agent': googlebot } }),
    res,
  )
  assert.equal(res.statusCode, 200)
  assert.equal(store.get('lk:bots'), '1')
  assert.ok(!store.has('lk:pv'), '爬虫不该污染 PV')
  assert.ok(!store.has('lk:visits'), '爬虫不该占明细的 800 条额度')

  const log = mockRes()
  await loadHandler('visitor-log')(
    mockReq({ method: 'GET', headers: { 'x-lk-user': USER, 'x-lk-pass': PASS } }),
    log,
  )
  assert.equal(log.payload.bots, 1, '后台要能看到爬虫来过多少次')
  assert.equal(log.payload.pv, 0)
})

test('单 IP 限速：超过上限后不再记账，但对外看起来和成功一模一样', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const visit = loadHandler('visit')
  const headers = { 'x-forwarded-for': '203.0.113.77' }

  // 上限 120 / 分钟。路径每次都不同，避开 30 秒去重锁。
  for (let i = 0; i < 120; i += 1) {
    await visit(mockReq({ method: 'POST', body: { path: `/p${i}` }, headers }), mockRes())
  }
  assert.equal(Number(store.get('lk:pv')), 120)

  const blocked = mockRes()
  await visit(mockReq({ method: 'POST', body: { path: '/p999' }, headers }), blocked)
  assert.equal(blocked.statusCode, 200, '被限速也要回 200')
  assert.deepEqual(blocked.payload, { ok: true }, '响应里不能有任何「你被挡了」的痕迹')
  assert.equal(Number(store.get('lk:pv')), 120, '超限的这次不该计入')

  // 换个 IP 不受影响
  const other = mockRes()
  await visit(
    mockReq({ method: 'POST', body: { path: '/p999' }, headers: { 'x-forwarded-for': '198.51.100.30' } }),
    other,
  )
  assert.equal(Number(store.get('lk:pv')), 121, '限速只按 IP，不能连累别人')
})

test('画像基数封顶：到顶后不再收新 vid，但老访客照常更新', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const visit = loadHandler('visit')
  const { createHash } = await import('node:crypto')
  const vidOf = (ip, ua) => createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16)

  const oldIp = '198.51.100.9'
  const oldUa = 'known-agent'
  const oldVid = vidOf(oldIp, oldUa)

  // 把 lk:visitors 灌到上限（5000），模拟被伪造 UA 刷满的状态，其中一个是老访客
  const profiles = new Map([[oldVid, '{}']])
  for (let i = 0; i < 4999; i += 1) profiles.set(`vid${i}`, '{}')
  store.set('lk:visitors', profiles)
  store.set('lk:visitors:hits', new Map([[oldVid, '7']]))

  // 新访客：明细和 PV 照记，但不再建画像
  await visit(
    mockReq({
      method: 'POST',
      body: { path: '/' },
      headers: { 'x-forwarded-for': '203.0.113.150', 'user-agent': 'brand-new-agent' },
    }),
    mockRes(),
  )
  assert.equal(store.get('lk:visitors').size, 5000, '到顶之后不能再长')
  assert.equal(Number(store.get('lk:pv')), 1, '这次访问本身照样计入 PV')
  assert.equal(store.get('lk:visits').length, 1, '明细也照常写（它有 LTRIM 兜底）')

  // 老访客：画像和次数继续更新，不能因为到顶就把真实访客也冻住
  await visit(
    mockReq({
      method: 'POST',
      body: { path: '/about' },
      headers: { 'x-forwarded-for': oldIp, 'user-agent': oldUa },
    }),
    mockRes(),
  )
  assert.equal(store.get('lk:visitors').size, 5000)
  assert.equal(store.get('lk:visitors:hits').get(oldVid), '8', '老访客的次数要继续累加')
  assert.notEqual(store.get('lk:visitors').get(oldVid), '{}', '老访客的画像要被刷新')
})

test('UA 解析：型号 / 系统版本 / 浏览器版本，以及爬虫不再被当成手机', async () => {
  const { parseUa } = require(path.join(root, 'lib', 'lk-ua.js'))

  const samsung = parseUa(
    'Mozilla/5.0 (Linux; Android 13; SM-S9110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  )
  assert.equal(samsung.model, '三星 SM-S9110', '纯型号代码要补上厂商')
  assert.equal(samsung.os, 'Android 13')
  assert.equal(samsung.browser, 'Chrome 131')
  assert.equal(samsung.device, '手机')

  const huawei = parseUa(
    'Mozilla/5.0 (Linux; Android 12; HUAWEI P40 Build/HUAWEIP40) AppleWebKit/537.36 Chrome/108.0.0.0 Mobile Safari/537.36',
  )
  assert.equal(huawei.model, 'HUAWEI P40', '型号里已经有厂商名就别再拼一次')

  // Chrome >= 110 的 UA reduction：型号被抹成 K，这时候只能回落到「手机」
  const reduced = parseUa(
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  )
  assert.equal(reduced.model, '', 'K 是占位符，不能当成型号')

  const bot = parseUa(
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  )
  assert.equal(bot.bot, true)
  assert.equal(bot.device, '爬虫', 'Googlebot 的 UA 里有 Android+Mobile，绝不能被记成手机')
})

test('/api/login 匿名请求看不到站长的 IP 和设备', async () => {
  store.clear()
  setEnv()
  installFakeKv()
  const login = loadHandler('login')

  const ok = mockRes()
  await login(
    mockReq({
      method: 'POST',
      body: { action: 'login', username: USER, password: PASS },
      headers: { 'x-forwarded-for': '203.0.113.200' },
    }),
    ok,
  )

  const anon = mockRes()
  await login(mockReq(), anon)
  assert.equal(anon.payload.authed, false)
  assert.deepEqual(anon.payload.session, { isMine: false }, '匿名只配知道「有人占着会话」')
  const dumped = JSON.stringify(anon.payload)
  assert.ok(!dumped.includes('203.0.113.200'), '不能泄露站长的 IP')
  assert.ok(!dumped.includes('test-agent'), '不能泄露站长的 UA')

  // 自己人看得到完整信息
  const mine = mockRes()
  await login(mockReq({ headers: { cookie: 'lk_admin=' + cookieValue(ok, 'lk_admin') } }), mine)
  assert.equal(mine.payload.session.ip, '203.0.113.200')
  assert.equal(mine.payload.session.isMine, true)
})

test('前端首帧的登录态读 hint cookie，而不是随标签页消失的 sessionStorage', async () => {
  const fs = await import('node:fs')
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

  const gate = read('docs/.vuepress/utils/authGate.js')
  assert.match(
    gate,
    /import \{ hasSessionHint \} from '\.\/adminSession\.js'/,
    'sessionStorage 随标签页关闭清空，只看它就会「先不显示后台入口、再突然冒出来」',
  )
  assert.match(gate, /return hasSessionHint\(\)/, 'readAuthed 兜底要落到 hint cookie 上')

  const session = read('docs/.vuepress/utils/adminSession.js')
  assert.match(session, /export function clearSessionHint\(\)/, '被顶下线时要能把 hint 抹掉')

  const loginGate = read('docs/.vuepress/components/LoginGate.vue')
  assert.match(
    loginGate,
    /if \(!state\.authed\) \{[\s\S]{0,400}clearSessionHint\(\)/,
    '服务端说没会话时必须清 hint，否则下次进页面会反方向闪一次',
  )
})

/* ---------- 跑 ---------- */

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`  ok  ${name}`)
  } catch (err) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${err.message}`)
  }
}
clearEnv()
console.log(failed ? `\n${failed} 个用例失败` : `\n${tests.length} 个用例全部通过`)
process.exit(failed ? 1 : 0)
