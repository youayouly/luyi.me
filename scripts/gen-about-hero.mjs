/**
 * 生成「关于我」整页背景用的横版二次元群像图（硅基流动），写入固定路径供站点引用。
 * 需要环境变量 SILICONFLOW_API_KEY；可选加载 .env.local（与 gen-pm-covers 一致）。
 *
 * 用法:
 *   npm run gen:about-hero
 *   node scripts/gen-about-hero.mjs --prompt "your prompt" --out gallery/custom.png
 *   node scripts/gen-about-hero.mjs --size 1024x1024 --help
 *
 * --out 为相对于 docs/.vuepress/public/ 的路径；也可用绝对路径。
 */
import { config } from 'dotenv'
import fs from 'fs'
import { dirname, isAbsolute, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

config({ path: '.env.local' })
config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicRoot = join(__dirname, '../docs/.vuepress/public')

const DEFAULT_PROMPT =
  'Ultra wide anime-style group portrait, cheerful friends in light casual outfits, ' +
  'very bright pastel sky with soft clouds and gentle sun glow, high key lighting, airy atmosphere, ' +
  'clean cel shading, no night sky, no heavy shadows, no text, no letters, no watermark, no logos.'

const DEFAULT_OUT_REL = 'gallery/about-hero-sf.png'
const DEFAULT_IMAGE_SIZE = '1536x640'

function parseArgs(argv) {
  const args = {
    prompt: null,
    out: null,
    size: null,
    help: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--prompt' && argv[i + 1]) args.prompt = argv[++i]
    else if (a === '--out' && argv[i + 1]) args.out = argv[++i]
    else if (a === '--size' && argv[i + 1]) args.size = argv[++i]
  }
  return args
}

function printHelp() {
  console.log(`gen-about-hero.mjs — SiliconFlow FLUX image → local file

环境: SILICONFLOW_API_KEY（.env.local 或环境变量）

选项:
  --prompt <text>   生图提示词（默认: 内置 about 横版群像 prompt）
  --out <path>      输出路径，相对 docs/.vuepress/public/（默认: ${DEFAULT_OUT_REL}）
  --size <WxH>      image_size，默认 ${DEFAULT_IMAGE_SIZE}
  -h, --help        显示本说明

示例:
  node scripts/gen-about-hero.mjs
  node scripts/gen-about-hero.mjs --prompt "soft pastel landscape, no text" --out gallery/hero-test.png
  npm run gen:about-hero -- --out gallery/about-hero-sf.png --size 1536x640
`)
}

function resolveOutPath(outArg) {
  if (!outArg) return join(publicRoot, normalize(DEFAULT_OUT_REL))
  const n = normalize(outArg.replace(/\\/g, '/'))
  if (isAbsolute(n)) return n
  const rel = n.replace(/^\//, '')
  return join(publicRoot, rel)
}

const cli = parseArgs(process.argv)
if (cli.help) {
  printHelp()
  process.exit(0)
}

const API_KEY = process.env.SILICONFLOW_API_KEY
if (!API_KEY) {
  console.error('Missing SILICONFLOW_API_KEY')
  process.exit(1)
}

const prompt = cli.prompt || DEFAULT_PROMPT
const outPath = resolveOutPath(cli.out)
const imageSize = cli.size || DEFAULT_IMAGE_SIZE

const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'black-forest-labs/FLUX.1-schnell',
    prompt,
    image_size: imageSize,
  }),
})

if (!res.ok) {
  throw new Error(`API error: ${await res.text()}`)
}

const data = await res.json()
const url = data.images?.[0]?.url || data.data?.[0]?.url
if (!url) throw new Error('No image URL in response')

const imgRes = await fetch(url)
if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)

const buf = Buffer.from(await imgRes.arrayBuffer())
fs.mkdirSync(dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, buf)
console.log(`Wrote ${outPath}`)
