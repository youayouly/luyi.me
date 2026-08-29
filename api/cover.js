const fs = require('fs')
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

let fetch
try {
  fetch = require('undici').fetch
} catch {
  fetch = global.fetch
}

const GALLERY_DIR = path.join(process.cwd(), 'docs', '.vuepress', 'public', 'gallery')

function ensureGalleryDir() {
  if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true })
}

function canWriteLocal() {
  try {
    ensureGalleryDir()
    const testFile = path.join(GALLERY_DIR, '.write-test')
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
    return true
  } catch {
    return false
  }
}

function slugify(input) {
  const slug = String(input || 'cover')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return slug || 'cover'
}

function detectImageFormat(buffer, contentType = '') {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('svg')) return 'svg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'webp'
  return 'png'
}

function tryGitAdd(filepath) {
  if (process.env.COVER_SKIP_GIT_ADD === '1') return
  try {
    const { execSync } = require('child_process')
    execSync(`git add "${filepath}"`, { encoding: 'utf8', stdio: 'pipe' })
  } catch (error) {
    console.warn('[Cover] git add skipped:', error.message)
  }
}

async function saveBufferLocal(buffer, title, contentType = '') {
  if (!canWriteLocal()) return null
  const format = detectImageFormat(buffer, contentType)
  const filename = `article-cover-${slugify(title)}-${Date.now()}.${format}`
  const filepath = path.join(GALLERY_DIR, filename)
  fs.writeFileSync(filepath, buffer)
  tryGitAdd(filepath)
  return {
    url: `/gallery/${filename}`,
    localPath: filepath,
    filename,
    size: buffer.length,
  }
}

function svgFallback(title, keywords = []) {
  const hashSource = `${title} ${Array.isArray(keywords) ? keywords.join(' ') : keywords}`
  let hash = 0
  for (let i = 0; i < hashSource.length; i += 1) {
    hash = hashSource.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  const accent = `hsl(${hue}, 74%, 54%)`
  const accent2 = `hsl(${(hue + 42) % 360}, 72%, 38%)`
  const label = (Array.isArray(keywords) ? keywords : String(keywords || '').split(','))
    .map(item => String(item).trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ') || 'TECH'
  const initials = String(title || 'AI').trim().slice(0, 2).toUpperCase()

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.48" stop-color="${accent2}"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <radialGradient id="glow" cx="32%" cy="22%" r="60%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect width="1200" height="800" fill="url(#glow)"/>
  <g fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2">
    <path d="M120 560 C280 430 390 610 540 480 S820 290 1060 390"/>
    <path d="M160 250 H1040 M210 310 H990 M280 370 H920"/>
  </g>
  <circle cx="900" cy="170" r="92" fill="rgba(255,255,255,.08)"/>
  <circle cx="990" cy="250" r="36" fill="rgba(255,255,255,.13)"/>
  <text x="92" y="292" fill="rgba(255,255,255,.24)" font-family="Arial, sans-serif" font-size="180" font-weight="800">${initials}</text>
  <text x="96" y="610" fill="white" font-family="Arial, sans-serif" font-size="44" font-weight="800">${escapeXml(title || 'Article Cover')}</text>
  <text x="100" y="672" fill="rgba(255,255,255,.78)" font-family="Arial, sans-serif" font-size="28" font-weight="600">${escapeXml(label)}</text>
</svg>`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function saveSvgFallback(title, keywords) {
  const svg = svgFallback(title, keywords)
  if (canWriteLocal()) {
    const filename = `article-cover-${slugify(title)}-${Date.now()}.svg`
    const filepath = path.join(GALLERY_DIR, filename)
    fs.writeFileSync(filepath, svg, 'utf8')
    tryGitAdd(filepath)
    return { imageUrl: `/gallery/${filename}`, localSaved: true, localPath: filepath, fallback: true }
  }
  return { imageUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`, localSaved: false, fallback: true }
}

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords.map(String).filter(Boolean)
  if (typeof keywords === 'string') return keywords.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

function buildPrompt(title, keywords, summary) {
  const keywordText = normalizeKeywords(keywords).join(', ') || 'technology, software, engineering'
  return [
    'Professional editorial cover image for a technical blog.',
    `Topic: ${title}.`,
    `Keywords: ${keywordText}.`,
    summary ? `Context: ${summary}.` : '',
    'Visual metaphor only. Do not render the title or keywords as typography.',
    'No text, no letters, no numbers, no captions, no labels, no UI screenshots, no logo, no watermark.',
    'Modern, cinematic, high contrast, clean composition, suitable as an article cover.',
  ].filter(Boolean).join(' ')
}

function backendConfig(bodyBackend) {
  const envBackend = process.env.COVER_IMAGE_BACKEND
  return String(bodyBackend || envBackend || 'siliconflow').toLowerCase()
}

function isConfigured(backend) {
  if (backend === 'pollinations') return Boolean(process.env.POLLINATIONS_API_KEY || process.env.POLLINATIONS_ALLOW_ANON === '1')
  if (backend === 'dify') return Boolean(process.env.DIFY_API_URL && process.env.DIFY_API_KEY)
  if (backend === 'siliconflow') return Boolean(process.env.SILICONFLOW_API_KEY)
  if (backend === 'huggingface') return Boolean(process.env.HUGGINGFACE_API_KEY)
  if (backend === 'stability') return Boolean(process.env.STABILITY_API_KEY)
  if (backend === 'cloudflare') return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
  return true
}

async function generateWithPollinations(title, keywords, summary) {
  const prompt = buildPrompt(title, keywords, summary)
  const params = new URLSearchParams({
    width: '1200',
    height: '800',
    nologo: 'true',
    private: 'true',
    seed: String(Math.abs(hashCode(`${title}${Date.now()}`)) % 2147483647),
  })
  if (process.env.POLLINATIONS_API_KEY) params.set('key', process.env.POLLINATIONS_API_KEY)
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params}`
  return fetchImageUrl(url, title)
}

async function generateWithSvg(title, keywords) {
  return saveSvgFallback(title, keywords)
}

function hashCode(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash)
  return hash
}

async function fetchImageUrl(url, title) {
  const res = await fetch(url, { headers: { Accept: 'image/*' } })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${await res.text().catch(() => '')}`)
  const contentType = res.headers.get('content-type') || ''
  const buffer = Buffer.from(await res.arrayBuffer())
  const saved = await saveBufferLocal(buffer, title, contentType)
  if (saved) return { imageUrl: saved.url, localSaved: true, localPath: saved.localPath }
  return { imageUrl: `data:${contentType || 'image/png'};base64,${buffer.toString('base64')}`, localSaved: false }
}

async function generateWithDify(title, keywords, summary) {
  const res = await fetch(`${process.env.DIFY_API_URL.replace(/\/+$/, '')}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { title, keywords: normalizeKeywords(keywords).join(', '), summary: summary || title },
      response_mode: 'blocking',
      user: 'article-publisher',
    }),
  })
  if (!res.ok) throw new Error(`Dify API error: ${await res.text()}`)
  const data = await res.json()
  if (data.data?.status === 'failed') throw new Error(`Dify workflow failed: ${data.data?.error || 'unknown error'}`)
  const outputs = data.data?.outputs || {}
  const imageUrl = outputs.result?.[0]?.url || outputs.image_url || outputs.cover_url || outputs.url ||
    (typeof outputs.result === 'string' ? outputs.result : null)
  if (!imageUrl) throw new Error('Dify did not return an image URL')
  return fetchImageUrl(imageUrl, title)
}

async function generateWithSiliconFlow(title, keywords, summary) {
  const apiBase = process.env.SILICONFLOW_API_BASE || 'https://api.siliconflow.com/v1'
  const body = {
    model: process.env.SILICONFLOW_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell',
    prompt: buildPrompt(title, keywords, summary),
    image_size: process.env.SILICONFLOW_IMAGE_SIZE || '1024x768',
  }
  if (process.env.SILICONFLOW_IMAGE_SEED) body.seed = Number(process.env.SILICONFLOW_IMAGE_SEED)

  const res = await fetch(`${apiBase.replace(/\/+$/, '')}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`SiliconFlow API error: ${await res.text()}`)
  const data = await res.json()
  const imageUrl = data.images?.[0]?.url || data.data?.[0]?.url
  if (!imageUrl) throw new Error('SiliconFlow did not return an image URL')
  return fetchImageUrl(imageUrl, title)
}

async function generateWithHuggingFace(title, keywords, summary) {
  const model = process.env.HUGGINGFACE_IMAGE_MODEL || 'stabilityai/stable-diffusion-xl-base-1.0'
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: buildPrompt(title, keywords, summary),
      parameters: { width: 1024, height: 768 },
    }),
  })
  if (!res.ok) throw new Error(`HuggingFace API error: ${await res.text()}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const saved = await saveBufferLocal(buffer, title, res.headers.get('content-type') || 'image/png')
  if (saved) return { imageUrl: saved.url, localSaved: true, localPath: saved.localPath }
  return { imageUrl: `data:image/png;base64,${buffer.toString('base64')}`, localSaved: false }
}

async function generateWithCloudflare(title, keywords, summary) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: buildPrompt(title, keywords, summary) }),
  })
  if (!res.ok) throw new Error(`Cloudflare API error: ${await res.text()}`)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    const saved = await saveBufferLocal(buffer, title, contentType)
    if (saved) return { imageUrl: saved.url, localSaved: true, localPath: saved.localPath }
    return { imageUrl: `data:${contentType};base64,${buffer.toString('base64')}`, localSaved: false }
  }
  const data = await res.json()
  const base64 = data.result?.image || data.result
  if (!base64 || typeof base64 !== 'string') throw new Error('Cloudflare did not return image data')
  const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  const saved = await saveBufferLocal(buffer, title, 'image/png')
  if (saved) return { imageUrl: saved.url, localSaved: true, localPath: saved.localPath }
  return { imageUrl: `data:image/png;base64,${buffer.toString('base64')}`, localSaved: false }
}

const GENERATORS = {
  svg: generateWithSvg,
  pollinations: generateWithPollinations,
  dify: generateWithDify,
  siliconflow: generateWithSiliconFlow,
  huggingface: generateWithHuggingFace,
  cloudflare: generateWithCloudflare,
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const { title, keywords = [], summary, authUser, authPass } = req.body || {}
    if (!title) return res.status(400).json({ ok: false, error: 'Missing title' })

    const LK_SITE_USER = process.env.LK_SITE_USER
    const LK_SITE_PASS = process.env.LK_SITE_PASS
    if (LK_SITE_USER && LK_SITE_PASS && (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS)) {
      return res.status(401).json({ ok: false, error: 'Authentication failed' })
    }

    const requestedBackend = backendConfig(req.body?.backend)
    const strictBackend = req.body?.strictBackend === true
    const errors = []
    const order = (strictBackend ? [requestedBackend] : [requestedBackend, 'pollinations', 'svg'])
      .filter((item, index, arr) => item && arr.indexOf(item) === index)

    for (const backend of order) {
      const generator = GENERATORS[backend]
      if (!generator) {
        errors.push(`${backend}: unknown backend`)
        continue
      }
      if (!isConfigured(backend)) {
        errors.push(`${backend}: not configured`)
        continue
      }
      try {
        const result = await generator(title, keywords, summary)
        return res.status(200).json({
          ok: true,
          ...result,
          backend,
          fallbackUsed: backend !== requestedBackend,
          errors: errors.length ? errors : undefined,
        })
      } catch (error) {
        console.warn(`[Cover] ${backend} failed:`, error.message)
        errors.push(`${backend}: ${error.message}`)
      }
    }

    if (strictBackend) {
      return res.status(502).json({
        ok: false,
        backend: requestedBackend,
        error: errors.join('; ') || `${requestedBackend}: unavailable`,
        errors,
      })
    }

    const fallback = await saveSvgFallback(title, keywords)
    return res.status(200).json({
      ok: true,
      ...fallback,
      backend: 'svg-fallback',
      fallbackUsed: true,
      errors,
    })
  } catch (error) {
    console.error('[Cover] Error:', error)
    if (req.body?.strictBackend === true) {
      return res.status(500).json({
        ok: false,
        backend: backendConfig(req.body?.backend),
        error: error.message || 'Internal server error',
        errors: [error.message || 'Internal server error'],
      })
    }
    const fallback = await saveSvgFallback(req.body?.title || 'Article Cover', req.body?.keywords || [])
    return res.status(200).json({
      ok: true,
      ...fallback,
      backend: 'svg-fallback',
      fallbackUsed: true,
      errors: [error.message || 'Internal server error'],
    })
  }
}
