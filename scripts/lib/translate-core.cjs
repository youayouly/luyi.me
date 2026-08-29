/*
 * 翻译公共内核（构建期用）：scripts/pretranslate.mjs 和 docs/api/translate-page.js 共用
 * 同一套 provider / prompt / 解析逻辑，避免两边漂移。API 那边是自包含的副本，改 prompt 两处一起改。
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

module.exports = {
  LANG_NAMES,
  MAX_TEXTS,
  MAX_TOTAL_CHARS,
  MAX_ONE_CHARS,
  resolveProvider,
  translateBatch,
}
