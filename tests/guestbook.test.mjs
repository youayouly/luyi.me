/**
 * 留言板接口的行为测试。
 *
 * 和 admin-session-visitor-log.test.mjs 同一路数：把 `api/guestbook.js` 当函数跑，
 * 用内存 Map 假装 Upstash 的 REST 端点。重点验四类东西：
 *   1. 降级：没配 KV 时读不炸、写明确报错（不能假装留言成功）
 *   2. 闸门：跨站 Origin、蜜罐、冷却
 *   3. XSS：访客写的标签必须被转义，v-html 那一端才敢直接渲染
 *   4. 隐私与越权：明文邮箱不外吐、悄悄话只有管理员看得到、owner 不可伪造
 *
 * 跑法：node tests/guestbook.test.mjs
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
const SITE_HOST = 'www.example.com'

/* ---------- 假的 Upstash REST 端点 ---------- */

let store = new Map()

function runCommand(args) {
  const [rawCmd, ...rest] = args
  const cmd = String(rawCmd).toUpperCase()
  const key = rest[0]

  switch (cmd) {
    case 'SET': {
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
    case 'LREM': {
      const list = store.get(key) || []
      const at = list.indexOf(rest[2])
      if (at === -1) return 0
      list.splice(at, 1)
      store.set(key, list)
      return 1
    }
    case 'HINCRBY': {
      const hash = store.get(key) || new Map()
      const next = Number(hash.get(rest[1]) || 0) + Number(rest[2])
      hash.set(rest[1], String(next))
      store.set(key, hash)
      return next
    }
    case 'HDEL': {
      const hash = store.get(key) || new Map()
      let removed = 0
      for (const field of rest.slice(1)) if (hash.delete(field)) removed += 1
      store.set(key, hash)
      return removed
    }
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

function mockReq({ method = 'GET', body = {}, headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0',
      host: SITE_HOST,
      origin: `https://${SITE_HOST}`,
      'x-forwarded-for': '203.0.113.9',
      ...headers,
    },
  }
}

function mockRes() {
  return {
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
}

/** 每个用例之间要清干净：冷却锁和限速计数会串味。 */
function reset({ kv = true } = {}) {
  store = new Map()
  if (kv) {
    process.env.KV_REST_API_URL = KV_URL
    process.env.KV_REST_API_TOKEN = KV_TOKEN
  } else {
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  }
  process.env.LK_SITE_USER = USER
  process.env.LK_SITE_PASS = PASS
  delete process.env.RESEND_API_KEY
  delete process.env.LK_MAIL_FROM
}

const handler = require(path.join(root, 'api', 'guestbook.js'))

async function call(options) {
  const res = mockRes()
  await handler(mockReq(options), res)
  return res
}

const creds = { authUser: USER, authPass: PASS }
/** 冷却锁是按 IP+UA 算的，同一测试里连发要换个 IP。 */
function fromIp(ip) {
  return { 'x-forwarded-for': ip }
}

installFakeKv()
const results = []
async function test(name, fn) {
  reset()
  await fn()
  results.push(name)
}

/* ---------- 用例 ---------- */

await test('没配 KV：读返回空列表，写明确报错', async () => {
  reset({ kv: false })
  const read = await call({ method: 'GET' })
  assert.equal(read.statusCode, 200)
  assert.deepEqual(read.payload.items, [])
  assert.equal(read.payload.configured, false)

  const write = await call({ method: 'POST', body: { nick: 'a', content: 'b' } })
  assert.equal(write.statusCode, 503)
  assert.equal(write.payload.needsKv, true)
})

await test('跨站 Origin 被挡在门外', async () => {
  const res = await call({
    method: 'POST',
    body: { nick: '路人', content: '你好' },
    headers: { origin: 'https://evil.example.net' },
  })
  assert.equal(res.statusCode, 403)
})

await test('蜜罐命中：假装成功，但什么都不存', async () => {
  const res = await call({
    method: 'POST',
    body: { nick: '机器人', content: '广告', website: 'http://spam.example' },
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.skipped, 'honeypot')
  const list = await call({ method: 'GET' })
  assert.equal(list.payload.items.length, 0)
})

await test('爬虫 UA 同样静默丢弃', async () => {
  const res = await call({
    method: 'POST',
    body: { nick: 'bot', content: 'hi' },
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  })
  assert.equal(res.payload.skipped, 'bot')
})

await test('正常留言：存得下，标签被转义', async () => {
  const res = await call({
    method: 'POST',
    body: { nick: '路人甲', content: '<script>alert(1)</script> **粗体**' },
  })
  assert.equal(res.statusCode, 200)
  assert.ok(res.payload.item.html.includes('&lt;script&gt;'))
  assert.ok(!res.payload.item.html.includes('<script>'))
  assert.ok(res.payload.item.html.includes('<strong>粗体</strong>'))
})

await test('30 秒冷却：同一设备连发第二条被拦', async () => {
  await call({ method: 'POST', body: { nick: '甲', content: '第一条' } })
  const second = await call({ method: 'POST', body: { nick: '甲', content: '第二条' } })
  assert.equal(second.statusCode, 429)
})

await test('昵称为空 / 正文为空都要报错', async () => {
  const noNick = await call({ method: 'POST', body: { nick: '   ', content: '有内容' } })
  assert.equal(noNick.statusCode, 400)
  const noText = await call({
    method: 'POST',
    body: { nick: '甲', content: '  ' },
    headers: fromIp('203.0.113.10'),
  })
  assert.equal(noText.statusCode, 400)
})

await test('QQ 号 / 邮箱各自生成头像，明文邮箱永不外吐', async () => {
  const qq = await call({
    method: 'POST',
    body: { nick: 'klein', content: '好牛', contact: '123456789' },
  })
  assert.ok(qq.payload.item.avatar.includes('qlogo.cn'))

  const mail = await call({
    method: 'POST',
    body: { nick: '素素', content: '好厉害', contact: 'someone@gmail.com', notify: true },
    headers: fromIp('203.0.113.11'),
  })
  assert.ok(mail.payload.item.avatar.includes('cravatar.cn'))

  const anon = await call({ method: 'GET' })
  const dump = JSON.stringify(anon.payload)
  assert.ok(!dump.includes('someone@gmail.com'), '匿名响应里出现了明文邮箱')

  const admin = await call({ method: 'GET', body: creds })
  const adminDump = JSON.stringify(admin.payload)
  assert.ok(!adminDump.includes('someone@gmail.com'), '管理员响应里出现了明文邮箱')
  assert.ok(adminDump.includes('som***@gmail.com'), '管理员应看到掩码后的联系方式')
})

await test('悄悄话：匿名看不到内容，管理员看得到', async () => {
  await call({
    method: 'POST',
    body: { nick: '悄悄', content: '只给站长看的话', private: true },
  })

  const anon = await call({ method: 'GET' })
  assert.equal(anon.payload.items[0].redacted, true)
  assert.equal(anon.payload.items[0].html, '')
  assert.ok(!JSON.stringify(anon.payload).includes('只给站长看的话'))

  const admin = await call({ method: 'GET', body: creds })
  assert.equal(admin.payload.isAdmin, true)
  assert.ok(admin.payload.items[0].html.includes('只给站长看的话'))
})

await test('owner 由服务端说了算：前端自称站长无效', async () => {
  const fake = await call({
    method: 'POST',
    body: { nick: '冒牌站长', content: '我是站长', owner: true },
  })
  assert.equal(fake.payload.item.owner, false)

  const real = await call({
    method: 'POST',
    body: { nick: 'Luke', content: '我才是', ...creds },
    headers: fromIp('203.0.113.12'),
  })
  assert.equal(real.payload.item.owner, true)
})

await test('删除要管理员；删父留言会带走它的回复', async () => {
  const parent = await call({ method: 'POST', body: { nick: '甲', content: '楼主' } })
  const parentId = parent.payload.item.id
  await call({
    method: 'POST',
    body: { nick: 'Luke', content: '回复', parent: parentId, ...creds },
    headers: fromIp('203.0.113.13'),
  })

  const denied = await call({ method: 'POST', body: { action: 'delete', id: parentId } })
  assert.equal(denied.statusCode, 401)

  const removed = await call({
    method: 'POST',
    body: { action: 'delete', id: parentId, ...creds },
  })
  assert.equal(removed.statusCode, 200)
  assert.equal(removed.payload.removed, 2)

  const list = await call({ method: 'GET' })
  assert.equal(list.payload.items.length, 0)
})

await test('超长留言被挡下，正好 1000 字放行', async () => {
  const ok = await call({ method: 'POST', body: { nick: '甲', content: '字'.repeat(1000) } })
  assert.equal(ok.statusCode, 200)

  const tooLong = await call({
    method: 'POST',
    body: { nick: '甲', content: '字'.repeat(1001) },
    headers: fromIp('203.0.113.20'),
  })
  assert.equal(tooLong.statusCode, 400)
})

await test('每 IP 限速：同一个 IP 刷到第六条就 429', async () => {
  /* 冷却锁按 IP+UA 算，所以换 UA 绕开冷却，单独验限速这一条。 */
  const codes = []
  for (let i = 0; i < 6; i += 1) {
    const res = await call({
      method: 'POST',
      body: { nick: '刷子', content: '第 ' + i + ' 条' },
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/13' + i },
    })
    codes.push(res.statusCode)
  }
  assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200])
  assert.equal(codes[5], 429, '第六条应该被限速挡下')
})

await test('第二轮 XSS：这些花样也必须变成纯文本', async () => {
  const FENCE = String.fromCharCode(96).repeat(3)
  /* lk-markdown.js 允许产出的全部标签，多一个都算越界 */
  const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote', 'a'])
  const payloads = [
    '<svg onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '[链接](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[链接](vbscript:msgbox(1))',
    '<a href="#" onclick="alert(1)">点我</a>',
    FENCE + '\n<img src=x onerror=alert(1)>\n' + FENCE,
    '**<script>alert(1)</script>**',
    '> <script>alert(1)</script>',
  ]
  let ip = 30
  for (const payload of payloads) {
    ip += 1
    const res = await call({
      method: 'POST',
      body: { nick: '攻击者', content: payload },
      headers: { ...fromIp('203.0.113.' + ip), 'user-agent': 'Mozilla/5.0 Chrome/1' + ip },
    })
    const html = res.payload.item.html
    const tags = [...html.matchAll(/<\s*\/?([a-zA-Z0-9]+)/g)].map((m) => m[1].toLowerCase())
    for (const tag of tags) {
      assert.ok(ALLOWED_TAGS.has(tag), `漏出了不该有的标签 <${tag}>：${payload} -> ${html}`)
    }
    assert.ok(
      !/href="(javascript|data|vbscript):/i.test(html),
      `漏出了危险协议：${payload} -> ${html}`,
    )
  }
})

await test('表情回应：白名单外拒绝，同设备同表情只能点一次', async () => {
  const post = await call({ method: 'POST', body: { nick: '甲', content: '来点个赞' } })
  const id = post.payload.item.id

  const bad = await call({ method: 'POST', body: { action: 'react', id, emoji: '<img src=x>' } })
  assert.equal(bad.statusCode, 400, '白名单之外的表情必须拒绝')

  const first = await call({ method: 'POST', body: { action: 'react', id, emoji: '👍' } })
  assert.equal(first.payload.count, 1)

  const again = await call({ method: 'POST', body: { action: 'react', id, emoji: '👍' } })
  assert.equal(again.payload.skipped, 'already', '同一设备重复点同一个表情应被锁住')

  /* 同一条留言换个表情是允许的：拦的是刷同一个，不是不让表达 */
  const other = await call({ method: 'POST', body: { action: 'react', id, emoji: '🎉' } })
  assert.equal(other.payload.count, 1)

  const list = await call({ method: 'GET' })
  assert.deepEqual(list.payload.items[0].reactions, { '👍': 1, '🎉': 1 })
})

await test('删留言时表情计数一起清掉，不留孤儿字段', async () => {
  const post = await call({ method: 'POST', body: { nick: '甲', content: '待会删掉' } })
  const id = post.payload.item.id
  await call({ method: 'POST', body: { action: 'react', id, emoji: '👍' } })

  await call({ method: 'POST', body: { action: 'delete', id, ...creds } })

  /* 复用同一个 id 不可能，但 HASH 里不该再有它的字段 */
  const react = store.get('lk:gb:react')
  const leftovers = react ? [...react.keys()].filter((k) => k.startsWith(id + ':')) : []
  assert.deepEqual(leftovers, [], '删完还留着表情字段')
})

await test('地区只到省 / 国家，城市和 IP 不外吐', async () => {
  await call({
    method: 'POST',
    body: { nick: '广东路人', content: '你好' },
    headers: {
      'x-vercel-ip-country': 'CN',
      'x-vercel-ip-country-region': 'GD',
      'x-vercel-ip-city': 'Shenzhen',
    },
  })

  const anon = await call({ method: 'GET' })
  const item = anon.payload.items[0]
  assert.deepEqual(item.place, { country: 'CN', region: 'GD' })
  const dump = JSON.stringify(anon.payload)
  assert.ok(!dump.includes('Shenzhen'), '城市泄漏了')
  assert.ok(!dump.includes('203.0.113'), 'IP 泄漏了')
})

await test('没配 LK_MAIL_TO 时站长通知安静跳过', async () => {
  delete process.env.LK_MAIL_TO
  const res = await call({ method: 'POST', body: { nick: '甲', content: '有人来了', ...creds } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.payload.ownerMail.sent, false)
  assert.equal(res.payload.ownerMail.skipped, 'no-owner-mail')
})

await test('没配发信时「发验证码」明确报错，不假装成功', async () => {
  const res = await call({ method: 'POST', body: { action: 'send-code', contact: 'a@b.com' } })
  assert.equal(res.statusCode, 503)
  assert.equal(res.payload.needsMail, true)
  const list = await call({ method: 'GET' })
  assert.equal(list.payload.mailReady, false, 'GET 要告诉前端发信没开')
})

await test('验证码：可选；填了必须对；验过即焚', async () => {
  /* 直接把码塞进 KV，绕开发信——这里验的是校验逻辑，不是发信 */
  const { md5 } = require(path.join(root, 'lib', 'lk-guest.js'))
  const hash = md5('someone@qq.com')
  store.set('lk:gb:code:' + hash, '123456')

  const wrong = await call({
    method: 'POST',
    body: { nick: '甲', contact: 'someone@qq.com', content: '码填错', code: '000000' },
  })
  assert.equal(wrong.statusCode, 400, '错码必须挡下')

  const right = await call({
    method: 'POST',
    body: { nick: '甲', contact: 'someone@qq.com', content: '码填对', code: '123456' },
    headers: fromIp('203.0.113.40'),
  })
  assert.equal(right.payload.item.verified, true)

  /* 同一个码不能再用第二次 */
  const reuse = await call({
    method: 'POST',
    body: { nick: '乙', contact: 'someone@qq.com', content: '想再镀一次金', code: '123456' },
    headers: fromIp('203.0.113.41'),
  })
  assert.equal(reuse.statusCode, 400, '用过的码必须失效')

  /* 不填码照样能发，只是没有已验证标 */
  const plain = await call({
    method: 'POST',
    body: { nick: '丙', content: '我不验', },
    headers: fromIp('203.0.113.42'),
  })
  assert.equal(plain.statusCode, 200)
  assert.equal(plain.payload.item.verified, false)
})

await test('楼中楼只有一层：回复的回复挂回同一个楼主', async () => {
  const parent = await call({ method: 'POST', body: { nick: '甲', content: '楼主' } })
  const parentId = parent.payload.item.id

  const reply = await call({
    method: 'POST',
    body: { nick: '乙', content: '一层', parent: parentId },
    headers: fromIp('203.0.113.14'),
  })
  assert.equal(reply.payload.item.parent, parentId)

  const nested = await call({
    method: 'POST',
    body: { nick: '丙', content: '二层', parent: reply.payload.item.id },
    headers: fromIp('203.0.113.15'),
  })
  assert.equal(nested.payload.item.parent, parentId, '二层回复应该挂回楼主')
})

console.log(`留言板接口测试通过（${results.length} 项）：`)
for (const name of results) console.log(`  ✓ ${name}`)
