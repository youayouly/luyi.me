/**
 * Vercel Serverless Function: 留言板
 *
 * 一个文件三件事（`api/` 下每个文件都是一个函数，能合就合）：
 *
 * - `GET  /api/guestbook`  读留言。公开。
 * - `POST /api/guestbook`  发留言 / 回复。公开，带四道闸。
 * - `POST /api/guestbook` + `action:'delete'`  删留言。要管理员。
 *
 * ## 数据放在哪
 *
 * | key | 内容 |
 * |---|---|
 * | `lk:gb`                | LIST，每条留言一行 JSON，LPUSH + LTRIM 封顶 500 |
 * | `lk:gb:rate:<ip>:<窗口>` | 每 IP 每 10 分钟的发言数，TTL 到窗口结束 |
 * | `lk:gb:cool:<vid>`      | 同一台设备两次发言之间的 30 秒冷却，SET NX EX |
 *
 * 没有单独的索引 key：500 条以内一次 LRANGE 全取回来在内存里组树，比维护
 * 父子索引简单得多，也不会出现「索引和正文对不上」的状态。真到需要翻页的
 * 量级（这是个人站的留言板，不会有）再说。
 *
 * ## 公开接口的四道闸
 *
 * 抄 `visit.js` 的顺序，先花钱少的：
 * 1. **同源校验**：浏览器对 POST 必发 Origin，缺了就用 Referer 兜底，两者都没有
 *    直接 403 —— 一条 Redis 命令都不花就把 curl 挡在外面。
 * 2. **蜜罐字段**：表单里有个 CSS 藏起来的 `website`，真人永远填不到它。
 *    命中就假装成功返回，不写库、不给对方任何信号。
 * 3. **爬虫 UA**：直接丢弃，同样假装成功。
 * 4. **限速**：每 IP 每 10 分钟 5 条 + 每设备 30 秒冷却。超了才回真错误，
 *    因为这条是真人也可能撞到的，得告诉他「慢一点」而不是假装成功。
 *
 * ## 隐私
 *
 * 邮箱默认**只存 md5**（头像要用），明文只在访客勾了「回复邮件提醒」时才存，
 * 且任何响应都不外吐：管理员看到的也是 `abc***@qq.com`。IP 和 UA 只给管理员。
 *
 * 注意 require 路径 `../lib/...` 是相对**生成后**的 `api/guestbook.js` 写的
 * （`scripts/copy-api.mjs` 会把本文件拍到根目录 api/），在 docs/api/ 原地解析不到。
 */

const crypto = require('crypto')
const { kvReady, kvCmd, kvPipeline } = require('../lib/lk-kv.js')
const { clientIp, parseUa } = require('../lib/lk-ua.js')
const { verifyAdmin } = require('../lib/lk-admin-auth.js')
const { MAX_CHARS, renderMarkdown, toPlainText } = require('../lib/lk-markdown.js')
const { cleanNick, maskEmail, newId, parseContact } = require('../lib/lk-guest.js')
const { mailReady, sendMail } = require('../lib/lk-mail.js')

const LIST_KEY = 'lk:gb'
/** 表情回应：计数放一个 HASH，字段是 `<留言id>:<表情>`。 */
const REACT_KEY = 'lk:gb:react'
/**
 * 能点的表情就这四个。**必须是白名单**：字段名进 Redis、表情进页面，
 * 放开任意字符串等于给了一个可以写任意 key、也可能塞进 DOM 的口子。
 */
const REACTIONS = ['👍', '🎉', '🤝', '😂']
/** 一台设备对一条留言的同一个表情最多同时算一次；取消后锁清掉，可以重新点。锁本身留半年。 */
const REACT_LOCK_TTL_SEC = 180 * 24 * 60 * 60
/** 验证码有效期 10 分钟，够去邮箱翻一趟。 */
const CODE_TTL_SEC = 10 * 60
/** 同一个邮箱两次要码的间隔。 */
const CODE_COOLDOWN_SEC = 60
/** 每 IP 每小时最多要几次码。发信是要花钱的，这道闸比留言那道还紧。 */
const CODE_MAX_PER_HOUR = 5
/** 留言保留条数。Upstash 按命令计费，定长列表让占用可预期。 */
const LIST_MAX = 500
/** 每 IP 每窗口能发几条。 */
const RATE_MAX = 5
const RATE_WINDOW_SEC = 10 * 60
/** 同一台设备两次发言的最小间隔。 */
const COOLDOWN_SEC = 30
const NICK_MIN = 1

/** Vercel 的 x-vercel-ip-* 是 URI 编码过的，解不开就用原值。 */
function header(req, name) {
  const raw = req.headers[name]
  if (!raw) return ''
  try {
    return decodeURIComponent(String(raw)).slice(0, 40)
  } catch {
    return String(raw).slice(0, 40)
  }
}

function hostOf(url) {
  try {
    return new URL(String(url)).host
  } catch {
    return ''
  }
}

/** 和 visit.js 的 isSameSite 一脉相承：缺 Origin 不放行，只用 Referer 兜底。 */
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
  const referer = req.headers.referer
  if (referer) return hostOf(referer) === req.headers.host
  return false
}

/**
 * 访客填的个人网址。只放行 http(s)，其余（javascript:、data:、协议相对）当没填。
 * 和 lk-markdown.js#safeUrl 同一条规矩——那边管正文里的链接，这边管昵称上的链接。
 */
function cleanSite(raw) {
  const value = String(raw || '').trim().slice(0, 200)
  if (!value) return ''
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return ''
  return value
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body || {}
}

/** 存进 Redis 的整行，读出来给前端之前必须过 publicView / adminView。 */
function publicView(row, reactions) {
  const base = {
    id: row.id,
    at: row.at,
    parent: row.parent || '',
    nick: row.nick,
    avatar: row.avatar || '',
    owner: row.owner === true,
    private: row.private === true,
    /*
     * 只给国家 / 省两级代码，前端查表变成「来自 广东」。
     * 城市和 IP 不出这个函数——那是后台才该看到的东西。
     */
    site: row.site || '',
    verified: row.verified === true,
    place: { country: row.country || '', region: row.region || '' },
    reactions: reactions ? reactions[row.id] || {} : {},
  }
  if (row.private === true) {
    /* 悄悄话对外只留一个壳：让写的人知道发出去了，别人看不到内容。 */
    return { ...base, html: '', redacted: true }
  }
  return { ...base, html: row.html || '' }
}

function adminView(row, reactions) {
  return {
    ...publicView(row, reactions),
    html: row.html || '',
    redacted: false,
    contact: row.email ? maskEmail(row.email) : row.emailMask || '',
    notify: row.notify === true,
    ip: row.ip || '',
    device: row.device || '',
  }
}

/**
 * 把 `<id>:<表情> -> 次数` 的扁平 HASH 折成 `{ 留言id: { 表情: 次数 } }`。
 * Upstash 的 HGETALL 回的是 [k, v, k, v, ...]。
 */
async function readReactions() {
  const flat = await kvCmd('HGETALL', REACT_KEY)
  const out = {}
  if (!Array.isArray(flat)) return out
  for (let i = 0; i < flat.length; i += 2) {
    const [id, emoji] = String(flat[i]).split(':')
    const count = Number(flat[i + 1])
    if (!id || !emoji || !Number.isFinite(count) || count <= 0) continue
    if (!out[id]) out[id] = {}
    out[id][emoji] = count
  }
  return out
}

async function readRows() {
  const raw = await kvCmd('LRANGE', LIST_KEY, 0, LIST_MAX - 1)
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      try {
        return { raw: item, row: JSON.parse(item) }
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/**
 * 发一封「你的留言收到回复了」。发信失败不影响留言本身，见 lk-mail.js。
 */
async function notifyParentAuthor(parentRow, replyRow) {
  if (!parentRow || parentRow.notify !== true || !parentRow.email) {
    return { sent: false, skipped: 'no-subscriber' }
  }
  /* 自己回自己不用提醒。 */
  if (replyRow.email && replyRow.email === parentRow.email) {
    return { sent: false, skipped: 'self-reply' }
  }

  const who = replyRow.owner ? '站长' : replyRow.nick
  const preview = toPlainText(replyRow.text).slice(0, 200)
  const link = 'https://www.luyi.me/guestbook'
  return sendMail({
    to: parentRow.email,
    subject: `${who} 回复了你在 Luke 的空间的留言`,
    text: `${who} 回复了你：\n\n${preview}\n\n查看：${link}`,
    html:
      `<p><strong>${who}</strong> 回复了你在 <a href="${link}">Luke 的空间</a> 的留言：</p>` +
      `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #93c5fd;color:#334155">${preview}</blockquote>` +
      `<p><a href="${link}">去看看</a></p>`,
  })
}

/**
 * 有新留言就给站长发一封。没配 LK_MAIL_TO 就跳过（和整条发信链路一样，
 * 发信失败绝不能变成留言失败）。站长自己发的、以及自己回自己的不发。
 */
async function notifyOwner(row) {
  const to = process.env.LK_MAIL_TO
  if (!to || row.owner === true) return { sent: false, skipped: 'no-owner-mail' }

  const preview = toPlainText(row.text).slice(0, 300)
  const link = 'https://www.luyi.me/guestbook'
  const kind = row.parent ? '回复' : '留言'
  return sendMail({
    to,
    subject: `${row.nick} 在留言板留了一条${kind}`,
    text: `${row.nick}：

${preview}

${link}`,
    html:
      `<p><strong>${row.nick}</strong> 在<a href="${link}">留言板</a>留了一条${kind}：</p>` +
      `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #93c5fd;color:#334155">${preview}</blockquote>`,
  })
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (!kvReady()) {
    /* 没接 Redis：读返回空列表并说明原因，写明确报错——留言不能假装成功。 */
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, items: [], configured: false })
    }
    return res
      .status(503)
      .json({ ok: false, needsKv: true, error: '服务端未配置留言存储' })
  }

  const body = readBody(req)
  const ip = clientIp(req)
  const ua = String(req.headers['user-agent'] || '').slice(0, 400)
  const parsed = parseUa(ua)

  try {
    const admin = await verifyAdmin(req, {
      username: body.authUser || body.username || '',
      password: body.authPass || body.password || '',
    })

    if (req.method === 'GET') {
      const [rows, reactions] = await Promise.all([readRows(), readReactions()])
      const items = rows.map(({ row }) =>
        admin.ok ? adminView(row, reactions) : publicView(row, reactions),
      )
      return res.status(200).json({
        ok: true,
        items,
        isAdmin: admin.ok,
        configured: true,
        /* 没配发信就别把「发验证码」画出来——按了也只会得到一个 503。 */
        mailReady: mailReady(),
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    if (!isSameSite(req)) {
      return res.status(403).json({ ok: false, error: 'Origin not allowed' })
    }

    /* ── 管理员动作 ─────────────────────────────────────────── */
    if (body.action === 'delete') {
      if (!admin.ok) return res.status(401).json({ ok: false, error: '需要登录' })
      const id = String(body.id || '')
      const rows = await readRows()
      /* 删父留言时把它下面的回复一起带走，否则会留下无主的楼中楼。 */
      const doomed = rows.filter(({ row }) => row.id === id || row.parent === id)
      if (!doomed.length) return res.status(404).json({ ok: false, error: '留言不存在' })
      /* 表情计数存在另一个 HASH 里，不一起删就成了永远对不上号的孤儿字段。 */
      const fields = []
      for (const { row } of doomed) for (const emoji of REACTIONS) fields.push(`${row.id}:${emoji}`)
      await kvPipeline([
        ...doomed.map(({ raw }) => ['LREM', LIST_KEY, '1', raw]),
        ['HDEL', REACT_KEY, ...fields],
      ])
      return res.status(200).json({ ok: true, removed: doomed.length })
    }

    /*
     * ── 两个不落库的轻动作 ────────────────────────────────────
     * 都只做纯计算，不碰 Redis，所以放在限速之前也不心疼；
     * 但同源校验（上面那道）照样管着它们，curl 依旧进不来。
     */
    if (body.action === 'preview') {
      const text = String(body.content || '')
      if (text.length > MAX_CHARS) {
        return res.status(400).json({ ok: false, error: `留言最多 ${MAX_CHARS} 字` })
      }
      /*
       * 预览必须走服务端：前端再实现一份 Markdown 解析，等于把「先转义再加标签」
       * 那道唯一的防线搬到访客能碰到的地方。多一次请求换这个，值。
       */
      return res.status(200).json({ ok: true, html: renderMarkdown(text) })
    }

    if (body.action === 'identity') {
      const identity = parseContact(body.contact)
      /* 只回头像和类型，不回邮箱本身——它是调用方自己填的，没必要再吐回去。 */
      return res.status(200).json({ ok: true, avatar: identity.avatar, kind: identity.kind })
    }

    /* ── 发验证码 ───────────────────────────────────────────── */
    if (body.action === 'send-code') {
      /*
       * 没配发信就明确说「服务端没开」，不要假装成功——
       * 这条和留言不同：留言丢不得，验证码发不出去必须让人知道，
       * 否则他会一直等一封永远不来的信。
       */
      if (!mailReady()) {
        return res.status(503).json({ ok: false, needsMail: true, error: '服务端还没配好发信' })
      }
      if (parsed.bot) return res.status(200).json({ ok: true, skipped: 'bot' })

      const identity = parseContact(body.contact)
      /* QQ 号会被解析成 <号码>@qq.com，所以填 QQ 号的人也能验。 */
      if (!identity.email) {
        return res.status(400).json({ ok: false, error: '先填邮箱或 QQ 号' })
      }

      const hour = Math.floor(Date.now() / (60 * 60 * 1000))
      const quotaKey = `lk:gb:codereq:${ip}:${hour}`
      const coolKey = `lk:gb:codecool:${identity.emailHash}`
      const [used, fresh] = await kvPipeline([
        ['INCR', quotaKey],
        ['SET', coolKey, '1', 'NX', 'EX', CODE_COOLDOWN_SEC],
        ['EXPIRE', quotaKey, 60 * 60 + 60],
      ])
      if (Number(used) > CODE_MAX_PER_HOUR) {
        return res.status(429).json({ ok: false, error: '要码太频繁了，过一小时再来' })
      }
      if (!fresh) {
        return res.status(429).json({ ok: false, error: '刚发过一封，等一分钟再要' })
      }

      /* 六位数字，crypto 随机——Math.random 猜得出来。 */
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await kvCmd('SET', `lk:gb:code:${identity.emailHash}`, code, 'EX', CODE_TTL_SEC)

      const mail = await sendMail({
        to: identity.email,
        subject: `留言板验证码 ${code}`,
        text: `你的验证码是 ${code}，10 分钟内有效。不是你本人操作的话，忽略这封信即可。`,
        html:
          `<p>你的验证码是</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>` +
          `<p>10 分钟内有效。不是你本人操作的话，忽略这封信即可。</p>`,
      })
      if (!mail.sent) {
        return res.status(502).json({ ok: false, error: '验证码没发出去，稍后再试' })
      }
      return res.status(200).json({ ok: true, sent: true })
    }

    /* ── 表情回应 ───────────────────────────────────────────── */
    if (body.action === 'react') {
      const id = String(body.id || '')
      const emoji = String(body.emoji || '')
      /* 白名单之外一律拒绝：这个值会变成 Redis 字段名，也会进页面。 */
      if (!REACTIONS.includes(emoji)) {
        return res.status(400).json({ ok: false, error: '不支持这个表情' })
      }
      if (parsed.bot) return res.status(200).json({ ok: true, skipped: 'bot' })

      const vid = crypto
        .createHash('sha256')
        .update(`${ip}|${ua}`)
        .digest('hex')
        .slice(0, 16)

      /*
       * 一台设备对一条留言只能点一次，靠 SET NX 的锁，不靠前端。
       * 锁按 (设备, 留言) 建，所以同一条留言可以点不同表情——这是有意的，
       * 拦的是「一个人把同一个表情刷到 999」。
       */
      const lockKey = `lk:gb:rx:${vid}:${id}:${emoji}`
      const locked = await kvCmd('SET', lockKey, '1', 'NX', 'EX', REACT_LOCK_TTL_SEC)
      if (!locked) return res.status(200).json({ ok: true, skipped: 'already' })

      const rows = await readRows()
      if (!rows.some(({ row }) => row.id === id)) {
        return res.status(404).json({ ok: false, error: '留言不存在' })
      }

      const count = await kvCmd('HINCRBY', REACT_KEY, `${id}:${emoji}`, 1)
      return res.status(200).json({ ok: true, id, emoji, count: Number(count) })
    }

    /* ── 取消表情回应 ───────────────────────────────────────── */
    if (body.action === 'unreact') {
      const id = String(body.id || '')
      const emoji = String(body.emoji || '')
      if (!REACTIONS.includes(emoji)) {
        return res.status(400).json({ ok: false, error: '不支持这个表情' })
      }
      if (parsed.bot) return res.status(200).json({ ok: true, skipped: 'bot' })

      const vid = crypto
        .createHash('sha256')
        .update(`${ip}|${ua}`)
        .digest('hex')
        .slice(0, 16)

      /* 锁不存在说明这台设备本来就没点过这个表情，没什么好撤的。 */
      const lockKey = `lk:gb:rx:${vid}:${id}:${emoji}`
      const removed = await kvCmd('DEL', lockKey)
      if (!removed) return res.status(200).json({ ok: true, skipped: 'not-reacted' })

      const count = await kvCmd('HINCRBY', REACT_KEY, `${id}:${emoji}`, -1)
      /* 正常不会到负数，但别的设备的取消请求可能并发撞上，夹一下保险。 */
      if (Number(count) < 0) {
        await kvCmd('HSET', REACT_KEY, `${id}:${emoji}`, 0)
        return res.status(200).json({ ok: true, id, emoji, count: 0 })
      }
      return res.status(200).json({ ok: true, id, emoji, count: Number(count) })
    }

    /* ── 发言 ───────────────────────────────────────────────── */

    /* 蜜罐：表单里那个藏起来的输入框，真人碰不到。装作成功，不给信号。 */
    if (String(body.website || '').trim()) {
      return res.status(200).json({ ok: true, skipped: 'honeypot' })
    }
    /* 爬虫同理，静默丢弃。 */
    if (parsed.bot) {
      return res.status(200).json({ ok: true, skipped: 'bot' })
    }

    const nick = cleanNick(body.nick)
    const text = String(body.content || '').trim()
    if (nick.length < NICK_MIN) {
      return res.status(400).json({ ok: false, error: '请填个昵称' })
    }
    if (!text) return res.status(400).json({ ok: false, error: '留言不能为空' })
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ ok: false, error: `留言最多 ${MAX_CHARS} 字` })
    }

    const vid = crypto
      .createHash('sha256')
      .update(`${ip}|${ua}`)
      .digest('hex')
      .slice(0, 16)

    /*
     * 限速。这一条和 visit.js 不同，超限要回真错误：
     * 发言是主动行为，假装成功会让人以为留言丢了，反复重发。
     */
    const window = Math.floor(Date.now() / (RATE_WINDOW_SEC * 1000))
    const rateKey = `lk:gb:rate:${ip}:${window}`
    const coolKey = `lk:gb:cool:${vid}`
    const [hits, cooled] = await kvPipeline([
      ['INCR', rateKey],
      ['SET', coolKey, '1', 'NX', 'EX', COOLDOWN_SEC],
      ['EXPIRE', rateKey, RATE_WINDOW_SEC + 30],
    ])
    if (Number(hits) > RATE_MAX) {
      return res.status(429).json({ ok: false, error: '发得有点快，过十分钟再来吧' })
    }
    if (!cooled) {
      return res.status(429).json({ ok: false, error: '刚发过一条，歇 30 秒再发' })
    }

    const rows = await readRows()
    const parentId = String(body.parent || '')
    const parentEntry = parentId ? rows.find(({ row }) => row.id === parentId) : null
    if (parentId && !parentEntry) {
      return res.status(404).json({ ok: false, error: '要回复的留言不见了' })
    }
    /* 只做一层楼中楼：回复的回复挂到同一个父节点上。 */
    const parent = parentEntry ? parentEntry.row.parent || parentEntry.row.id : ''

    const identity = parseContact(body.contact)
    const notify = body.notify === true && Boolean(identity.email)

    /*
     * 验证码是**可选**的：不填照样能发，只是拿不到「已验证」那个标。
     * 填了就必须对——填错还放行的话，这个标就成了摆设。
     * 验过即焚：同一个码不能拿来给第二条留言镀金。
     */
    let verified = false
    const code = String(body.code || '').trim()
    if (code) {
      if (!identity.emailHash) {
        return res.status(400).json({ ok: false, error: '验证码要配着邮箱或 QQ 号用' })
      }
      const expect = await kvCmd('GET', `lk:gb:code:${identity.emailHash}`)
      if (!expect || String(expect) !== code) {
        return res.status(400).json({ ok: false, error: '验证码不对或已过期' })
      }
      await kvCmd('DEL', `lk:gb:code:${identity.emailHash}`)
      verified = true
    }

    const row = {
      id: newId(),
      at: new Date().toISOString(),
      parent,
      nick,
      avatar: identity.avatar,
      kind: identity.kind,
      emailHash: identity.emailHash,
      /* 明文邮箱只在要发提醒时留一份，别的地方一律用 md5。 */
      email: notify ? identity.email : '',
      emailMask: identity.email ? maskEmail(identity.email) : '',
      notify,
      site: cleanSite(body.site),
      verified,
      private: body.private === true,
      /* owner 只由服务端在鉴权通过后写入，前端说了不算。 */
      owner: admin.ok === true,
      text,
      html: renderMarkdown(text),
      ip,
      device: [parsed.device, parsed.os, parsed.browser].filter(Boolean).join(' · '),
      /*
       * 只留国家 / 省两级，**不存城市**：留言旁边显示「来自 广东」够了，
       * 精确到城市对访客来说是被盯着的感觉，对站长也没多大用。
       */
      country: header(req, 'x-vercel-ip-country'),
      region: header(req, 'x-vercel-ip-country-region'),
    }

    await kvPipeline([
      ['LPUSH', LIST_KEY, JSON.stringify(row)],
      ['LTRIM', LIST_KEY, '0', String(LIST_MAX - 1)],
    ])

    const mail = parentEntry ? await notifyParentAuthor(parentEntry.row, row) : null
    /* 站长通知和「回复提醒」是两条线：前者给我，后者给被回复的人。 */
    const ownerMail = await notifyOwner(row)

    /*
     * 发信结果只回给管理员。对匿名调用者说「已提醒 xxx」等于泄漏
     * 「这条留言留了邮箱」，而且访客也用不上这个信息。
     */
    return res.status(200).json({
      ok: true,
      item: admin.ok ? adminView(row) : publicView(row),
      ...(admin.ok ? { mail, ownerMail } : {}),
    })
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: String((err && err.message) || err).slice(0, 200) })
  }
}
