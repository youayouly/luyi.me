/**
 * 从 datasets/geo-countries 拉取中国边界（各多边形仅外环），Douglas–Peucker 简化后生成
 * docs/.vuepress/data/chinaMapOutline.generated.js（路径 + 与城市标点一致的 MAP_BOUNDS）
 *
 * 使用：node scripts/gen-china-outline.mjs
 * 构建不依赖网络；请把生成文件提交进仓库。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../docs/.vuepress/data/chinaMapOutline.generated.js')

const SRC =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

const VB = { w: 1000, h: 720 }
const PADDING_DEG = 0.35
/** Douglas–Peucker 容差（约 0.018° ≈ 2km，兼顾形状与体积） */
const DP_EPS = 0.018

/** 仅外轮廓：避免将 GeoJSON 内环（湖泊等）当作独立填充面 */
function exteriorRings(geometry) {
  const rings = []
  if (geometry.type === 'Polygon') {
    rings.push(geometry.coordinates[0])
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (poly[0]?.length) rings.push(poly[0])
    }
  }
  return rings
}

function ringBBox(ring) {
  let minL = Infinity,
    maxL = -Infinity,
    minLa = Infinity,
    maxLa = -Infinity
  for (const [lng, lat] of ring) {
    minL = Math.min(minL, lng)
    maxL = Math.max(maxL, lng)
    minLa = Math.min(minLa, lat)
    maxLa = Math.max(maxLa, lat)
  }
  return { minL, maxL, minLa, maxLa }
}

function geometryBBox(geometry) {
  const rings = exteriorRings(geometry)
  let b = null
  for (const ring of rings) {
    const r = ringBBox(ring)
    if (!b) b = { ...r, minL: r.minL, maxL: r.maxL, minLa: r.minLa, maxLa: r.maxLa }
    else {
      b.minL = Math.min(b.minL, r.minL)
      b.maxL = Math.max(b.maxL, r.maxL)
      b.minLa = Math.min(b.minLa, r.minLa)
      b.maxLa = Math.max(b.maxLa, r.maxLa)
    }
  }
  return b
}

function sqDist(p, a, b) {
  const [x, y] = p
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return (x - x1) ** 2 + (y - y1) ** 2
  let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
  t = Math.max(0, Math.min(1, t))
  const px = x1 + t * dx
  const py = y1 + t * dy
  return (x - px) ** 2 + (y - py) ** 2
}

function douglasPeucker(ring, eps) {
  if (ring.length <= 2) return ring.slice()
  const first = ring[0]
  const last = ring[ring.length - 1]
  let idx = 0
  let maxD = 0
  for (let i = 1; i < ring.length - 1; i++) {
    const d = sqDist(ring[i], first, last)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > eps * eps) {
    const a = douglasPeucker(ring.slice(0, idx + 1), eps)
    const b = douglasPeucker(ring.slice(idx), eps)
    return a.slice(0, -1).concat(b)
  }
  return [first, last]
}

function llToXY(lng, lat, bounds) {
  const { L, R, B, T } = bounds
  const x = ((lng - L) / (R - L)) * VB.w
  const y = VB.h - ((lat - B) / (T - B)) * VB.h
  return [x, y]
}

function ringToSvgD(ring, bounds) {
  if (ring.length < 2) return ''
  const [x0, y0] = llToXY(ring[0][0], ring[0][1], bounds)
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = llToXY(ring[i][0], ring[i][1], bounds)
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

async function main() {
  const res = await fetch(SRC)
  if (!res.ok) throw new Error('fetch ' + res.status)
  const geo = await res.json()
  const feat = geo.features.find((f) => f.properties?.name === 'China')
  if (!feat) throw new Error('China feature not found')

  const gb = geometryBBox(feat.geometry)
  const bounds = {
    L: gb.minL - PADDING_DEG,
    R: gb.maxL + PADDING_DEG,
    B: gb.minLa - PADDING_DEG,
    T: gb.maxLa + PADDING_DEG,
  }

  const rings = exteriorRings(feat.geometry)
  const parts = []
  for (const ring of rings) {
    if (ring.length < 4) continue
    const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    const open = closed ? ring.slice(0, -1) : ring.slice()
    const simp = douglasPeucker(open, DP_EPS)
    const out = closed ? [...simp, simp[0]] : simp
    parts.push(ringToSvgD(out, bounds))
  }

  const pathD = parts.join(' ')
  const json = JSON.stringify(bounds)

  const banner = `/* eslint-disable */\n/**
 * 由 scripts/gen-china-outline.mjs 从 datasets/geo-countries 生成，勿手改。
 * 运行：node scripts/gen-china-outline.mjs
 */\n`

  const body = `${banner}export const CHINA_MAP_BOUNDS = ${json}\n\nexport const CHINA_SVG_PATH_D = ${JSON.stringify(pathD)}\n`

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, body, 'utf8')
  console.log('Wrote', OUT, 'path length', pathD.length, 'rings', parts.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
