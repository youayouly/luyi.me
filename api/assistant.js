/**
 * Vercel Serverless Function: AI 问答助手
 *
 * `POST /api/assistant` —— 访客在侧栏的聊天卡片里发一句话，回一句话。公开，不需要登录，
 * 但每次调用都要烧 SiliconFlow 的 token 额度，所以闸门抄 `guestbook.js` 的顺序（先花钱少的）：
 *
 * 1. 同源校验：浏览器 POST 必带 Origin，缺了拿 Referer 兜底，两者都没有直接 403。
 * 2. 爬虫 UA：静默丢弃，假装成功但不占额度。
 * 3. 每 IP 限速：这条会真的花钱，超了要回真错误，不能假装成功（假装成功会让人反复重发）。
 *
 * 跟 `guestbook.js` 不同的一点：**没配 Upstash 就直接拒绝**，不像 /api/visit 那样静默降级——
 * 那边没记到统计只是数据丢了，这里没有限速就等于一个能免费调用付费模型的开放端点，
 * 必须 fail closed。
 *
 * 不做会话持久化：聊天记录只活在浏览器这次页面会话里（组件自己拿 sessionStorage 存），
 * 服务端不落库、不需要 vid/cooldown 那一套——一条消息一次请求，历史由前端在 body 里带上。
 *
 * provider 调用抄的是 `translate-page.js`（同一个 SiliconFlow chat/completions，同一套
 * env 变量），system prompt 由 `lib/lk-assistant-context.js` 拼（文章标题/摘要/标签 +
 * 一段站点简介，轻量 grounding，不做向量检索）。
 *
 * 注意 require 路径 `../lib/...` 是相对**生成后**的 `api/assistant.js` 写的
 * （`scripts/copy-api.mjs` 会把本文件拍到根目录 api/），在 docs/api/ 原地解析不到。
 */

const path = require('path')
const { kvReady, kvCmd, kvPipeline } = require('../lib/lk-kv.js')
const { clientIp, parseUa } = require('../lib/lk-ua.js')
const { buildSystemPrompt } = require('../lib/lk-assistant-context.js')

function loadLocalEnv() {
  try {
    require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), quiet: true })
    require('dotenv').config({ quiet: true })
  } catch {
    // dotenv 只是本地开发的便利；线上环境变量已经在 process.env 里。
  }
}

loadLocalEnv()

let fetchImpl
try {
  fetchImpl = require('undici').fetch
} catch {
  fetchImpl = global.fetch
}

/** 单条消息、单次历史的上限。防止一次请求把 SiliconFlow 账单刷爆。 */
const MAX_MESSAGE_CHARS = 500
const MAX_HISTORY_TURNS = 6
const MAX_HISTORY_CHARS = 4000
const MAX_TOKENS = 700

/** 每 IP 每窗口能问几次。比留言板的 5/10min 松一点——正常对话来回问几句很正常。 */
const RATE_MAX = 12
const RATE_WINDOW_SEC = 10 * 60

function resolveProvider() {
  const base =
    process.env.TRANSLATE_API_BASE ||
    process.env.SILICONFLOW_API_BASE ||
    'https://api.siliconflow.com/v1'
  const key = process.env.TRANSLATE_API_KEY || process.env.SILICONFLOW_API_KEY
  const model = process.env.LK_ASSISTANT_MODEL || process.env.TRANSLATE_MODEL || 'Qwen/Qwen3-30B-A3B-Instruct-2507'
  return { base: base.replace(/\/+$/, ''), key, model }
}

function hostOf(url) {
  try {
    return new URL(String(url)).host
  } catch {
    return ''
  }
}

/** 跟 guestbook.js#isSameSite 一脉相承：缺 Origin 不放行，只用 Referer 兜底。 */
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

/** 只留 user/assistant 两种角色，裁到最近 N 轮、总字数封顶——防止前端传一份超长历史。 */
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return []
  const turns = raw
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: String(item.content || '').slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_TURNS)

  let total = 0
  const out = []
  // 从最新的往回收，超过字数预算就丢掉更早的几轮。
  for (let i = turns.length - 1; i >= 0; i--) {
    total += turns[i].content.length
    if (total > MAX_HISTORY_CHARS) break
    out.unshift(turns[i])
  }
  return out
}

async function askAssistant({ message, history, lang }) {
  const { base, key, model } = resolveProvider()
  if (!key) throw new Error('needsConfig')

  const body = {
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(lang) },
      ...history,
      { role: 'user', content: message },
    ],
    temperature: 0.6,
    max_tokens: MAX_TOKENS,
    enable_thinking: false,
  }

  const res = await fetchImpl(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Assistant API error ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content
  if (!reply || !String(reply).trim()) throw new Error('Assistant API returned an empty reply')
  return { reply: String(reply).trim(), model }
}

module.exports = async function handler(req, res) {
  const origin = req.headers?.origin
  const allowed = isSameSite(req) || !origin
  res.setHeader('Access-Control-Allow-Origin', origin && allowed ? origin : '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  const { key } = resolveProvider()

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, configured: Boolean(key) && kvReady() })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!isSameSite(req)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' })
  }

  /* 没配限速存储：宁可拒绝服务，也不能变成一个不限速的免费模型代理。 */
  if (!kvReady()) {
    return res.status(503).json({ ok: false, needsKv: true, error: '服务端未配置限速存储' })
  }
  if (!key) {
    return res.status(503).json({ ok: false, needsConfig: true, error: '服务端未配置 AI 助手' })
  }

  try {
    const body = readBody(req)
    const ua = String(req.headers['user-agent'] || '').slice(0, 400)
    if (parseUa(ua).bot) {
      return res.status(200).json({ ok: true, skipped: 'bot' })
    }

    const ip = clientIp(req)
    const window = Math.floor(Date.now() / (RATE_WINDOW_SEC * 1000))
    const rateKey = `lk:assistant:rate:${ip}:${window}`
    const [hits] = await kvPipeline([
      ['INCR', rateKey],
      ['EXPIRE', rateKey, RATE_WINDOW_SEC + 30],
    ])
    if (Number(hits) > RATE_MAX) {
      return res.status(429).json({ ok: false, error: '问得有点快，过十分钟再来吧' })
    }

    const message = String(body.message || '').trim()
    if (!message) return res.status(400).json({ ok: false, error: '消息不能为空' })
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(413).json({ ok: false, error: `单条消息最多 ${MAX_MESSAGE_CHARS} 字` })
    }

    const lang = body.lang === 'zh' ? 'zh' : 'en'
    const history = sanitizeHistory(body.history)

    const { reply, model } = await askAssistant({ message, history, lang })
    return res.status(200).json({ ok: true, reply, model })
  } catch (error) {
    if (error && error.message === 'needsConfig') {
      return res.status(503).json({ ok: false, needsConfig: true, error: '服务端未配置 AI 助手' })
    }
    return res.status(500).json({ ok: false, error: error.message || '助手暂时无法回答' })
  }
}
