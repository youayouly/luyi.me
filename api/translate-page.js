/*
 * 运行时兜底翻译：构建期 `scripts/pretranslate.mjs` 已经把全站中文预翻好写进
 * `/i18n/en.json`，前端命中静态词典就不会走到这里。剩下打进来的都是词典里没有的
 * 动态内容（新发的文章还没重建、组件运行时拼出来的文案等）。
 *
 * 这个文件是自包含的（不 require 本目录其它文件）。provider / prompt / 解析逻辑
 * 也复制在 `scripts/lib/translate-core.cjs` 里给构建期脚本用，改 prompt 时两处一起改。
 */

const path = require('path')

function loadLocalEnv() {
  try {
    require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), quiet: true })
    require('dotenv').config({ quiet: true })
  } catch {
    // dotenv is a local/dev convenience. Deployed env vars are already in process.env.
  }
}

loadLocalEnv()

let fetchImpl
try {
  fetchImpl = require('undici').fetch
} catch {
  fetchImpl = global.fetch
}

/* 单次请求的上限：翻译接口不做登录校验，靠体积上限兜住额度。 */
const MAX_TEXTS = 60
const MAX_TOTAL_CHARS = 8000
const MAX_ONE_CHARS = 1200

const LANG_NAMES = {
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
}

function resolveProvider() {
  const base =
    process.env.TRANSLATE_API_BASE ||
    process.env.SILICONFLOW_API_BASE ||
    'https://api.siliconflow.com/v1'
  const key = process.env.TRANSLATE_API_KEY || process.env.SILICONFLOW_API_KEY
  const model = process.env.TRANSLATE_MODEL || 'Qwen/Qwen3-30B-A3B-Instruct-2507'
  return { base: base.replace(/\/+$/, ''), key, model }
}

function buildSystemPrompt(targetName) {
  return [
    `You translate UI strings and article prose for a personal tech blog into ${targetName}.`,
    'Input is a JSON array of strings. Translate every element.',
    'Rules:',
    `- Return exactly the same number of elements, in the same order.`,
    '- Preserve leading and trailing whitespace of each string.',
    '- Keep numbers, URLs, emoji, code identifiers, file names and brand/proper nouns as-is.',
    `- If a string is already in ${targetName}, return it unchanged.`,
    '- Translate naturally and concisely; navigation labels stay short.',
    '- No explanations, no extra keys.',
    'Respond with JSON only, in the form {"t": ["...", "..."]}.',
  ].join('\n')
}

/* 模型偶尔会裹一层 ``` 或多说一句，这里尽量把数组捞出来。 */
function parseTranslations(raw, expected) {
  if (!raw) return null
  let text = String(raw).trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  const candidates = []
  candidates.push(text)

  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) candidates.push(objMatch[0])
  const arrMatch = text.match(/\[[\s\S]*\]/)
  if (arrMatch) candidates.push(arrMatch[0])

  for (const candidate of candidates) {
    let parsed
    try {
      parsed = JSON.parse(candidate)
    } catch {
      continue
    }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.t) ? parsed.t : null
    if (list && list.length === expected) return list.map((item) => String(item ?? ''))
  }

  return null
}

async function translateBatch(texts, target) {
  const { base, key, model } = resolveProvider()
  if (!key) throw new Error('Translation provider is not configured (missing SILICONFLOW_API_KEY)')

  const targetName = LANG_NAMES[target] || LANG_NAMES.en
  const body = {
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(targetName) },
      { role: 'user', content: JSON.stringify(texts) },
    ],
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    // Qwen3 系列在 SiliconFlow 上默认开思考模式，翻译用不上还会拖慢首屏。
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

  if (!res.ok) throw new Error(`Translation API error ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content
  const list = parseTranslations(raw, texts.length)
  if (!list) throw new Error('Translation API returned an unusable payload')

  return { translations: list, model }
}


/*
 * 这个接口不需要登录（访客也要能翻译），但每次调用都要烧模型额度。
 * 所以只放行本站发起的请求：同源浏览器请求带的 Origin 与 Host 一致，跨站盗用会被挡下。
 * 需要额外域名（预览环境等）时用 TRANSLATE_ALLOWED_ORIGINS 逗号分隔配置。
 */
function isAllowedOrigin(req) {
  const origin = req.headers?.origin
  if (!origin) return true // 非浏览器调用（脚本、健康检查）没有 Origin

  const allowList = (process.env.TRANSLATE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (allowList.includes(origin)) return true

  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers?.origin
  const allowed = isAllowedOrigin(req)
  res.setHeader('Access-Control-Allow-Origin', origin && allowed ? origin : '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })
  if (!allowed) return res.status(403).json({ ok: false, error: 'Origin not allowed' })

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const target = String(payload.target || 'en').toLowerCase()
    if (!LANG_NAMES[target]) return res.status(400).json({ ok: false, error: `Unsupported target: ${target}` })

    const texts = Array.isArray(payload.texts) ? payload.texts.map((item) => String(item ?? '')) : []
    if (!texts.length) return res.status(400).json({ ok: false, error: 'Missing texts' })
    if (texts.length > MAX_TEXTS) {
      return res.status(413).json({ ok: false, error: `Too many texts (max ${MAX_TEXTS})` })
    }
    if (texts.some((item) => item.length > MAX_ONE_CHARS)) {
      return res.status(413).json({ ok: false, error: `A single text exceeds ${MAX_ONE_CHARS} chars` })
    }
    const totalChars = texts.reduce((sum, item) => sum + item.length, 0)
    if (totalChars > MAX_TOTAL_CHARS) {
      return res.status(413).json({ ok: false, error: `Payload too large (max ${MAX_TOTAL_CHARS} chars)` })
    }

    const { translations, model } = await translateBatch(texts, target)
    return res.status(200).json({ ok: true, target, model, translations })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Translation failed' })
  }
}
