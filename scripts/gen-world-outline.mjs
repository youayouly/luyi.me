/**
 * 生成世界地图（含中国省份分界）SVG 路径数据：
 *   - 世界各国陆地外环：来自 datasets/geo-countries（Natural Earth Admin0 简化版）
 *   - 中国省份外环：来自 阿里云 DataV ATLAS 100000_full.json（34 个省级行政区）
 *
 * 同一 plate carrée（等距经纬度）投影下输出三段数据：
 *   - WORLD_MAP_BOUNDS  { L: -180, R: 180, B: -60, T: 85 }
 *   - WORLD_SVG_PATH_D  全世界陆地多边形（外环）
 *   - CHINA_PROVINCES_PATH_D  中国 34 个省级单位的外环（仅描线用）
 *
 * 使用：node scripts/gen-world-outline.mjs
 * 构建不依赖网络；生成的 docs/.vuepress/data/worldMapOutline.generated.js 请提交进仓库。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../docs/.vuepress/data/worldMapOutline.generated.js')

const SRC_WORLD =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
const SRC_CHINA_PROVINCES =
  'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'

/** viewBox：宽 1000 / 高 405 ≈ 经度 360° : 纬度 145°，整体趋近真实世界比例 */
const VB = { w: 1000, h: 405 }
/** 投影范围：去掉南极洲与北极冰盖以减少视觉浪费 */
const BOUNDS = { L: -180, R: 180, B: -60, T: 85 }
/** 世界陆地用粗一点的简化（容差 0.25°）；省份分界更细（0.08°） */
const DP_EPS_WORLD = 0.25
const DP_EPS_PROVINCE = 0.08

function exteriorRings(geometry) {
  const rings = []
  if (!geometry) return rings
  if (geometry.type === 'Polygon') {
    if (geometry.coordinates[0]) rings.push(geometry.coordinates[0])
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (poly[0]?.length) rings.push(poly[0])
    }
  }
  return rings
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

function llToXY(lng, lat) {
  const { L, R, B, T } = BOUNDS
  // 钳住越界经纬度，避免极端坐标拉爆 viewBox
  const ln = Math.max(L, Math.min(R, lng))
  const la = Math.max(B, Math.min(T, lat))
  const x = ((ln - L) / (R - L)) * VB.w
  const y = VB.h - ((la - B) / (T - B)) * VB.h
  return [x, y]
}

function ringToSvgD(ring) {
  if (ring.length < 2) return ''
  const [x0, y0] = llToXY(ring[0][0], ring[0][1])
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = llToXY(ring[i][0], ring[i][1])
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  d += ' Z'
  return d
}

function geomToPathD(geometry, eps) {
  const rings = exteriorRings(geometry)
  const parts = []
  for (const ring of rings) {
    if (ring.length < 4) continue
    const closed =
      ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    const open = closed ? ring.slice(0, -1) : ring.slice()
    const simp = douglasPeucker(open, eps)
    if (simp.length < 3) continue
    const out = closed ? [...simp, simp[0]] : simp
    parts.push(ringToSvgD(out))
  }
  return parts.join(' ')
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
  return await res.json()
}

async function main() {
  console.log('[world] fetch countries…')
  const world = await fetchJson(SRC_WORLD)
  const worldParts = []
  for (const feat of world.features) {
    const d = geomToPathD(feat.geometry, DP_EPS_WORLD)
    if (d) worldParts.push(d)
  }
  const WORLD_PATH_D = worldParts.join(' ')

  console.log('[world] fetch china provinces…')
  const cn = await fetchJson(SRC_CHINA_PROVINCES)
  const provParts = []
  for (const feat of cn.features) {
    const d = geomToPathD(feat.geometry, DP_EPS_PROVINCE)
    if (d) provParts.push(d)
  }
  const CN_PROVINCES_PATH_D = provParts.join(' ')

  const banner = `/* eslint-disable */\n/**
 * 由 scripts/gen-world-outline.mjs 生成；勿手改。
 * 数据源：
 *   - 世界陆地：datasets/geo-countries（Natural Earth Admin0 简化版）
 *   - 中国省份：阿里云 DataV ATLAS 100000_full.json
 * 投影：plate carrée（等距经纬度），viewBox ${VB.w}x${VB.h}。
 */\n`

  const body =
    `${banner}` +
    `export const WORLD_MAP_BOUNDS = ${JSON.stringify(BOUNDS)}\n\n` +
    `export const WORLD_VIEWBOX = ${JSON.stringify(VB)}\n\n` +
    `export const WORLD_SVG_PATH_D = ${JSON.stringify(WORLD_PATH_D)}\n\n` +
    `export const CHINA_PROVINCES_PATH_D = ${JSON.stringify(CN_PROVINCES_PATH_D)}\n`

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, body, 'utf8')
  console.log(
    'Wrote',
    OUT,
    `world=${WORLD_PATH_D.length}B`,
    `provinces=${CN_PROVINCES_PATH_D.length}B`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
