<script setup>
/**
 * 2D 世界足迹图（中国省份描边）：台州为辐射中心；左侧城市列表展示各地时间/天气；
 * 地图支持滚轮缩放与拖拽平移；列表点击会自动放大并把该城市移到画面中心。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  WORLD_MAP_BOUNDS,
  WORLD_VIEWBOX,
  WORLD_SVG_PATH_D,
  CHINA_PROVINCES_PATH_D,
} from '../data/worldMapOutline.generated.js'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'

/** 虚线辐射起点（家乡坐标） */
const HUB_ID = 'taizhou'
/** 默认详情展示城市 */
const DEFAULT_ACTIVE_ID = 'taizhou'

/*
 * 地名是专有名词，交给翻译模型容易出「Zhejiang Hangzhou」这种别扭结果；而且地图上的
 * <text> 本来就被 pageTranslate 的 SKIP_SELECTOR 排除（翻了会撑坏 SVG 排版）。
 * 所以这里直接写死双语：nameEn 给左侧城市列表，shortEn 给地图上的标点。
 */
const cityList = [
  { id: 'singapore', name: '新加坡', nameEn: 'Singapore', shortEn: 'Singapore', lat: 1.3521, lng: 103.8198, tz: 'Asia/Singapore', wttr: 'Singapore' },
  { id: 'beijing', name: '北京', nameEn: 'Beijing', shortEn: 'Beijing', lat: 39.9042, lng: 116.4074, tz: 'Asia/Shanghai', wttr: 'Beijing' },
  { id: 'shanghai', name: '上海', nameEn: 'Shanghai', shortEn: 'Shanghai', lat: 31.2304, lng: 121.4737, tz: 'Asia/Shanghai', wttr: 'Shanghai' },
  { id: 'hangzhou', name: '浙江 · 杭州', nameEn: 'Hangzhou, Zhejiang', shortEn: 'Hangzhou', lat: 30.2741, lng: 120.1551, tz: 'Asia/Shanghai', wttr: 'Hangzhou' },
  { id: 'wenzhou', name: '浙江 · 温州', nameEn: 'Wenzhou, Zhejiang', shortEn: 'Wenzhou', lat: 27.9938, lng: 120.699, tz: 'Asia/Shanghai', wttr: 'Wenzhou' },
  { id: 'taizhou', name: '浙江 · 台州', nameEn: 'Taizhou, Zhejiang', shortEn: 'Taizhou', lat: 28.6561, lng: 121.4208, tz: 'Asia/Shanghai', wttr: 'Taizhou' },
  { id: 'xiamen', name: '福建 · 厦门', nameEn: 'Xiamen, Fujian', shortEn: 'Xiamen', lat: 24.4798, lng: 118.0894, tz: 'Asia/Shanghai', wttr: 'Xiamen' },
  { id: 'zhangzhou', name: '福建 · 漳州', nameEn: 'Zhangzhou, Fujian', shortEn: 'Zhangzhou', lat: 24.5108, lng: 117.647, tz: 'Asia/Shanghai', wttr: 'Zhangzhou' },
  { id: 'xian', name: '陕西 · 西安', nameEn: "Xi'an, Shaanxi", shortEn: "Xi'an", lat: 34.3416, lng: 108.9398, tz: 'Asia/Shanghai', wttr: 'Xian' },
  { id: 'changsha', name: '湖南 · 长沙', nameEn: 'Changsha, Hunan', shortEn: 'Changsha', lat: 28.2278, lng: 112.9388, tz: 'Asia/Shanghai', wttr: 'Changsha' },
  { id: 'guangzhou', name: '广东 · 广州', nameEn: 'Guangzhou, Guangdong', shortEn: 'Guangzhou', lat: 23.1291, lng: 113.2644, tz: 'Asia/Shanghai', wttr: 'Guangzhou' },
  { id: 'shenzhen', name: '广东 · 深圳', nameEn: 'Shenzhen, Guangdong', shortEn: 'Shenzhen', lat: 22.5431, lng: 114.0579, tz: 'Asia/Shanghai', wttr: 'Shenzhen' },
  { id: 'hongkong', name: '香港', nameEn: 'Hong Kong', shortEn: 'Hong Kong', lat: 22.3193, lng: 114.1694, tz: 'Asia/Hong_Kong', wttr: 'HongKong' },
  { id: 'bangkok', name: '🇹🇭 泰国 · 曼谷', nameEn: '🇹🇭 Bangkok, Thailand', shortEn: 'Bangkok', lat: 13.7563, lng: 100.5018, tz: 'Asia/Bangkok', wttr: 'Bangkok' },
]

/** 跟着导航栏那个地球开关走；pageLang 是模块级 ref，切语言这里会自动重渲染。 */
const isEnglish = computed(() => pageLang.value !== SOURCE_LANG)

/** 左侧城市列表用的完整名字。 */
function cityLabel(city) {
  return isEnglish.value && city.nameEn ? city.nameEn : city.name
}

/** 与城市标点共用：plate carrée 投影到 WORLD_VIEWBOX */
function llToSvg(lng, lat) {
  const { L, R, B, T } = WORLD_MAP_BOUNDS
  const x = ((lng - L) / (R - L)) * WORLD_VIEWBOX.w
  const y = WORLD_VIEWBOX.h - ((lat - B) / (T - B)) * WORLD_VIEWBOX.h
  return { x, y }
}

function shortMapLabel(name) {
  const s = name.replace(/^🇹🇭\s*/, '').trim()
  const i = s.indexOf('·')
  if (i >= 0) return s.slice(i + 1).trim()
  return s
}

function curvePath(x0, y0, x1, y1, bulge = 8) {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const cx = mx + (-dy / len) * bulge
  const cy = my + (dx / len) * bulge
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

const countryLabelList = [
  { id: 'china', name: '中国', nameEn: 'China', lat: 35.5, lng: 104.5 },
  { id: 'japan', name: '日本', nameEn: 'Japan', lat: 37.4, lng: 138.5 },
  { id: 'south-korea', name: '韩国', nameEn: 'South Korea', lat: 36.2, lng: 127.9 },
  { id: 'thailand', name: '泰国', nameEn: 'Thailand', lat: 15.4, lng: 101.0 },
  { id: 'singapore-country', name: '新加坡', nameEn: 'Singapore', lat: 1.35, lng: 103.82 },
]

const cities = ref(
  cityList.map((c) => ({
    ...c,
    time: '',
    weatherZh: '',
    weatherEn: '',
    weatherEmoji: '⛅',
  })),
)

const activeId = ref(DEFAULT_ACTIVE_ID)
let timer = null

/** 地图缩放平移（视口 CSS 像素，transform-origin: 0 0） */
const zoomShellRef = ref(null)
const mapZoom = ref(1)
const mapPanX = ref(0)
const mapPanY = ref(0)
const ZOOM_MIN = 1
const ZOOM_MAX = 36
/** 左侧列表点击后聚焦时使用的目标缩放（世界视图下覆盖城市附近 ~40°×16°） */
const BASE_FOCUS_ZOOM = 9
const MAX_FOCUS_ZOOM = 18
const FOCUS_ZOOM_STEP = 0.5
const FOCUS_LABEL_RELEASE_ZOOM = 7.4
const LABEL_FONT_MAX = 18
const LABEL_FONT_CAP_MIN = LABEL_FONT_MAX
const LABEL_FONT_CAP_MAX = LABEL_FONT_MAX
const LABEL_FONT_CAP_STEP = 1
const labelFontCap = ref(LABEL_FONT_MAX)
const COUNTRY_LABEL_SHOW_ZOOM = 3.6
const COUNTRY_LABEL_HIDE_ZOOM = 5.05
const COUNTRY_LABEL_FONT_SIZE = 13.2
const COUNTRY_LABEL_STROKE_WIDTH = 2.1

const activePointers = new Map()
let mapGesture = null
/** 本次按下后若发生过平移，则忽略随后的标点 click */
let mapDragSuppressClick = false
const mapLabelMode = ref('overview')

/** 仅在「聚焦城市 / 复位」时短暂开启的 transform 过渡 */
const mapTransition = ref(false)
let mapTransitionTimer = null

function enableMapTransition(durationMs = 420) {
  mapTransition.value = true
  if (mapTransitionTimer) clearTimeout(mapTransitionTimer)
  mapTransitionTimer = setTimeout(() => {
    mapTransition.value = false
  }, durationMs)
}

function selectCity(cityId) {
  activeId.value = cityId
}

function enterOverviewLabelMode() {
  mapLabelMode.value = 'overview'
}

function enterFocusLabelMode() {
  mapLabelMode.value = 'focus'
}

function getShellSize() {
  const shell = zoomShellRef.value
  if (!shell) return null
  const sw = shell.clientWidth
  const sh = shell.clientHeight
  if (!sw || !sh) return null
  return { sw, sh }
}

/**
 * 计算 inner 内超宽 SVG 的 slice 几何。
 * inner box = 3*sw × sh，SVG viewBox = 3*W × H，preserveAspectRatio="xMidYMid slice"。
 * 返回当前 zoom 下「一份地图」对应的 shell 像素宽度（period）以及投影 scale / offset。
 */
function computeMapMetrics() {
  const sz = getShellSize()
  if (!sz) return null
  const innerW = sz.sw * 3
  const innerH = sz.sh
  const svgW = WORLD_VIEWBOX.w * 3
  const svgH = WORLD_VIEWBOX.h
  const innerRatio = innerW / innerH
  const svgRatio = svgW / svgH
  // slice = "覆盖 / cover": scale 取 max，铺满 inner，超出方向被裁
  const scale = innerRatio >= svgRatio ? innerW / svgW : innerH / svgH
  const drawnW = svgW * scale
  const drawnH = svgH * scale
  const offsetX = (innerW - drawnW) / 2
  const offsetY = (innerH - drawnH) / 2
  return { sw: sz.sw, sh: sz.sh, innerW, innerH, scale, drawnW, drawnH, offsetX, offsetY }
}

/**
 * 把中间地图的 SVG 局部坐标 (svgX∈[0,W], svgY∈[0,H]) 投影到 inner 的物理像素。
 * 因为中间地图被 transform translate(W 0) 放置在超宽 viewBox 的 [W, 2W] 区段，
 * 所以全局 viewBox x = W + svgX。
 */
function svgToInnerPx(svgX, svgY) {
  const m = computeMapMetrics()
  if (!m) return null
  const px = (WORLD_VIEWBOX.w + svgX) * m.scale + m.offsetX
  const py = svgY * m.scale + m.offsetY
  return { px, py }
}

/**
 * 横向 wrap：让 panX 始终落在「中间地图覆盖 shell 中心」的 ±半周期范围。
 * period = 一份地图在 shell 中的像素宽度 = W * slice_scale * zoom。
 * 因 SVG 内部 3 份地图坐标连续，相邻 ±period 等价于经度 ±360°，视觉无缝。
 */
function wrapPanX() {
  const m = computeMapMetrics()
  if (!m) return
  const period = WORLD_VIEWBOX.w * m.scale * mapZoom.value
  if (!period) return
  // 中间地图视觉中心（viewBox x = 1.5W）对应的 panX
  const centerInnerPx = 1.5 * WORLD_VIEWBOX.w * m.scale + m.offsetX
  const centerPanX = m.sw / 2 - centerInnerPx * mapZoom.value
  while (mapPanX.value > centerPanX + period * 0.5) mapPanX.value -= period
  while (mapPanX.value < centerPanX - period * 0.5) mapPanX.value += period
}

/** 防止纵向露白：纵向不循环，只允许 panY 落在能让 inner 继续覆盖 shell 上下边界的范围 */
function clampPanY() {
  const sz = getShellSize()
  if (!sz) return
  const scaledH = sz.sh * mapZoom.value
  if (scaledH <= sz.sh) {
    mapPanY.value = (sz.sh - scaledH) / 2
  } else {
    mapPanY.value = Math.min(0, Math.max(sz.sh - scaledH, mapPanY.value))
  }
}

const mapViewportTransform = computed(() => {
  const m = computeMapMetrics()
  if (!m || !m.scale) return 'translate(0 0) scale(1)'
  const tx = (mapPanX.value + m.offsetX * (mapZoom.value - 1)) / m.scale
  const ty = (mapPanY.value + m.offsetY * (mapZoom.value - 1)) / m.scale
  return `translate(${tx} ${ty}) scale(${mapZoom.value})`
})

const isFocusLabelMode = computed(
  () => mapLabelMode.value === 'focus' && mapZoom.value >= FOCUS_LABEL_RELEASE_ZOOM,
)

function syncLabelModeAfterZoom(nextZoom = mapZoom.value) {
  if (mapLabelMode.value === 'focus' && nextZoom < FOCUS_LABEL_RELEASE_ZOOM) {
    enterOverviewLabelMode()
  }
}

/** 把 (svgX, svgY) 平移到 shell 中心并按指定 zoom 放大 */
function focusToSvgPoint(svgX, svgY, zoom) {
  const m = computeMapMetrics()
  const pt = svgToInnerPx(svgX, svgY)
  if (!m || !pt) return
  enableMapTransition()
  mapZoom.value = zoom
  mapPanX.value = m.sw / 2 - pt.px * zoom
  mapPanY.value = m.sh / 2 - pt.py * zoom
  wrapPanX()
  clampPanY()
}

function focusCityOnMap(cityId) {
  const city = mapCities.value.find((c) => c.id === cityId)
  if (!city) return
  enterFocusLabelMode()
  focusToSvgPoint(city.mapX, city.mapY, getRecommendedFocusZoom(city))
}

function selectCityFromList(cityId) {
  selectCity(cityId)
  nextTick(() => focusCityOnMap(cityId))
}

/** 初始视图：把东亚-东南亚区域居中（中国 + 曼谷的"重心"附近） */
function focusInitialAsia() {
  enterOverviewLabelMode()
  const { x, y } = llToSvg(112, 28)
  focusToSvgPoint(x, y, 3.6)
}

function centerMapInShell() {
  const m = computeMapMetrics()
  if (!m) return
  // 默认让中间地图视觉中心 (viewBox x=1.5W) 落在 shell 中央
  const centerInnerPx = 1.5 * WORLD_VIEWBOX.w * m.scale + m.offsetX
  mapPanX.value = m.sw / 2 - centerInnerPx * mapZoom.value
  mapPanY.value = 0
  wrapPanX()
  clampPanY()
}

function stepZoom(factor) {
  const sz = getShellSize()
  if (!sz) return
  const mx = sz.sw / 2
  const my = sz.sh / 2
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, mapZoom.value * factor))
  const k = next / mapZoom.value
  mapPanX.value = mx - (mx - mapPanX.value) * k
  mapPanY.value = my - (my - mapPanY.value) * k
  mapZoom.value = next
  syncLabelModeAfterZoom(next)
  wrapPanX()
  clampPanY()
}

function resetMapView() {
  enterOverviewLabelMode()
  // 「复位」= 回到默认聚焦中国（与首次进入页面一致），而非缩到全球
  nextTick(() => focusInitialAsia())
}

function onMapWheel(e) {
  const shell = zoomShellRef.value
  if (!shell) return
  mapTransition.value = false
  const rect = shell.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const delta = -e.deltaY * 0.0012
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, mapZoom.value * (1 + delta)))
  const k = next / mapZoom.value
  mapPanX.value = mx - (mx - mapPanX.value) * k
  mapPanY.value = my - (my - mapPanY.value) * k
  mapZoom.value = next
  syncLabelModeAfterZoom(next)
  wrapPanX()
  clampPanY()
}

function getLocalPointerPoint(e) {
  const shell = zoomShellRef.value
  if (!shell) return null
  const rect = shell.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

function getGesturePointers() {
  return Array.from(activePointers.values()).slice(0, 2)
}

function getPointerDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y) || 1
}

function getPointerMidpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

function syncMapGesture() {
  if (activePointers.size >= 2) {
    const [a, b] = getGesturePointers()
    if (!a || !b) return
    const midpoint = getPointerMidpoint(a, b)
    mapGesture = {
      kind: 'pinch',
      startDistance: getPointerDistance(a, b),
      startMidX: midpoint.x,
      startMidY: midpoint.y,
      startPanX: mapPanX.value,
      startPanY: mapPanY.value,
      startZoom: mapZoom.value,
    }
    return
  }

  const pointer = activePointers.values().next().value
  if (pointer) {
    mapGesture = {
      kind: 'pan',
      lastX: pointer.x,
      lastY: pointer.y,
    }
    return
  }

  mapGesture = null
}

function onMapPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  mapTransition.value = false
  const point = getLocalPointerPoint(e)
  if (!point) return
  if (activePointers.size === 0) mapDragSuppressClick = false
  activePointers.set(e.pointerId, point)
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch (_) {}
  syncMapGesture()
}

function onMapPointerMove(e) {
  if (!activePointers.has(e.pointerId)) return
  const point = getLocalPointerPoint(e)
  if (!point) return
  activePointers.set(e.pointerId, point)

  if (activePointers.size >= 2) {
    if (!mapGesture || mapGesture.kind !== 'pinch') syncMapGesture()
    const [a, b] = getGesturePointers()
    if (!a || !b || !mapGesture || mapGesture.kind !== 'pinch') return

    const midpoint = getPointerMidpoint(a, b)
    const distance = getPointerDistance(a, b)
    const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, mapGesture.startZoom * (distance / mapGesture.startDistance)))
    const zoomRatio = nextZoom / mapGesture.startZoom

    if (
      Math.abs(distance - mapGesture.startDistance) > 2 ||
      Math.hypot(midpoint.x - mapGesture.startMidX, midpoint.y - mapGesture.startMidY) > 2
    ) {
      mapDragSuppressClick = true
    }

    mapPanX.value = midpoint.x - (mapGesture.startMidX - mapGesture.startPanX) * zoomRatio
    mapPanY.value = midpoint.y - (mapGesture.startMidY - mapGesture.startPanY) * zoomRatio
    mapZoom.value = nextZoom
    syncLabelModeAfterZoom(nextZoom)
    wrapPanX()
    clampPanY()
    return
  }

  if (!mapGesture || mapGesture.kind !== 'pan') syncMapGesture()
  if (!mapGesture || mapGesture.kind !== 'pan') return

  const dx = point.x - mapGesture.lastX
  const dy = point.y - mapGesture.lastY
  if (Math.hypot(dx, dy) > 4) mapDragSuppressClick = true
  mapPanX.value += dx
  mapPanY.value += dy
  wrapPanX()
  clampPanY()
  mapGesture.lastX = point.x
  mapGesture.lastY = point.y
}

function onMapPointerUp(e) {
  if (!activePointers.has(e.pointerId)) return
  activePointers.delete(e.pointerId)
  try {
    e.currentTarget.releasePointerCapture(e.pointerId)
  } catch (_) {}
  syncMapGesture()
}

const mapCities = computed(() =>
  cities.value.map((c) => {
    const { x, y } = llToSvg(c.lng, c.lat)
    // 英文别再拿 '·' 去切：'Hangzhou, Zhejiang' 里根本没有那个分隔符。
    const mapLabel = isEnglish.value
      ? c.shortEn || c.nameEn || shortMapLabel(c.name)
      : shortMapLabel(c.name)
    return { ...c, mapX: x, mapY: y, mapLabel }
  }),
)

const mapCountryLabels = computed(() =>
  countryLabelList.map((c) => {
    const { x, y } = llToSvg(c.lng, c.lat)
    return { ...c, mapX: x, mapY: y, label: isEnglish.value && c.nameEn ? c.nameEn : c.name }
  }),
)

const countryLabelOpacity = computed(() => {
  const progress = clampValue(
    (COUNTRY_LABEL_HIDE_ZOOM - mapZoom.value) / (COUNTRY_LABEL_HIDE_ZOOM - COUNTRY_LABEL_SHOW_ZOOM),
    0,
    1,
  )
  return Math.round(progress * 100) / 100
})

const shouldShowCountryLabels = computed(() => countryLabelOpacity.value > 0.03)

const hub = computed(() => mapCities.value.find((c) => c.id === HUB_ID))

const connectionPaths = computed(() => {
  const h = hub.value
  if (!h) return []
  return mapCities.value
    .filter((c) => c.id !== HUB_ID)
    .map((c) => ({ id: c.id, d: curvePath(h.mapX, h.mapY, c.mapX, c.mapY) }))
})

function openCityFromMap(cityId) {
  if (mapDragSuppressClick) {
    mapDragSuppressClick = false
    return
  }
  selectCity(cityId)
  nextTick(() => focusCityOnMap(cityId))
}

const LABEL_DEFAULT_DIRECTIONS = {
  beijing: 'top',
  shanghai: 'right',
  hangzhou: 'right',
  wenzhou: 'bottom',
  taizhou: 'left',
  xiamen: 'right',
  zhangzhou: 'left',
  xian: 'left',
  changsha: 'left',
  guangzhou: 'left',
  shenzhen: 'right',
  hongkong: 'bottom',
  singapore: 'right',
  bangkok: 'left',
}

const LABEL_DIRECTION_ORDERS = {
  right: ['right', 'top', 'bottom', 'left'],
  left: ['left', 'top', 'bottom', 'right'],
  top: ['top', 'right', 'left', 'bottom'],
  bottom: ['bottom', 'right', 'left', 'top'],
}

const LABEL_FONT_MIN = 7.2
const LABEL_ACTIVE_FONT_BONUS = 0.9
const LABEL_FOCUS_FONT_BONUS = 1.6
const LABEL_STROKE_MIN = 2
const LABEL_STROKE_MAX = 2.8
const LABEL_CHAR_WIDTH = 1.02
const LABEL_BOX_PADDING_X = 4.5
const LABEL_BOX_PADDING_Y = 3
const LABEL_COLLISION_GAP = 5
const LABEL_EDGE_PADDING = 8
const MARKER_COLLISION_PADDING = 6
const MARKER_DOT_RADIUS = 5.8
const MARKER_ACTIVE_DOT_RADIUS = 8.2
const MARKER_RIPPLE_RADIUS = 5.6
const LABEL_PRIORITY = {
  beijing: 90,
  shanghai: 92,
  hangzhou: 86,
  taizhou: 85,
  shenzhen: 84,
  guangzhou: 83,
  hongkong: 82,
  xiamen: 80,
  changsha: 78,
  xian: 77,
  wenzhou: 76,
  zhangzhou: 74,
  singapore: 72,
  bangkok: 70,
}
const CITY_LABEL_MIN_ZOOM = {
  shanghai: 5.1,
  beijing: 5.15,
  xian: 5.2,
  changsha: 5.25,
  guangzhou: 5.35,
  bangkok: 5.45,
  hangzhou: 5.7,
  taizhou: 5.95,
  xiamen: 6.05,
  wenzhou: 6.15,
  shenzhen: 6.25,
  zhangzhou: 6.35,
  singapore: 6.45,
  hongkong: 6.55,
}

function isFocusedCityLabel(c) {
  return isFocusLabelMode.value && c.id === activeId.value
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getLabelFontSize(c, zoom = mapZoom.value, state = {}) {
  const { active = c.id === activeId.value, focused = isFocusedCityLabel(c) } = state
  const zoomProgress = clampValue((zoom - 4.8) / 4.4, 0, 1)
  let size = LABEL_FONT_MIN + (LABEL_FONT_MAX - LABEL_FONT_MIN) * zoomProgress
  if (active) size += LABEL_ACTIVE_FONT_BONUS
  if (focused) size += LABEL_FOCUS_FONT_BONUS
  size = Math.min(LABEL_FONT_MAX, size)
  return Math.round(size * 10) / 10
}

function getLabelStrokeWidth(c, zoom = mapZoom.value, state = {}) {
  const fontPx = getLabelFontSize(c, zoom, state)
  const stroke = clampValue(fontPx * 0.22, LABEL_STROKE_MIN, LABEL_STROKE_MAX)
  return Math.round(stroke * 10) / 10
}

function getPreferredLabelDirection(c, focused = isFocusedCityLabel(c)) {
  if (focused) return 'bottom'
  return LABEL_DEFAULT_DIRECTIONS[c.id] || 'right'
}

function getLabelDirectionOrder(c, focused = isFocusedCityLabel(c)) {
  const preferred = getPreferredLabelDirection(c, focused)
  return LABEL_DIRECTION_ORDERS[preferred] || LABEL_DIRECTION_ORDERS.right
}

function buildLabelLayout(c, direction, zoom = mapZoom.value, state = {}) {
  const fontPx = getLabelFontSize(c, zoom, state)
  const gap = Math.max(11, markerDotRadius(c) + fontPx * 0.72)
  if (direction === 'left') {
    return { dx: -gap, dy: 0, anchor: 'end', baseline: 'middle', direction }
  }
  if (direction === 'top') {
    return { dx: 0, dy: -gap, anchor: 'middle', baseline: null, direction }
  }
  if (direction === 'bottom') {
    return { dx: 0, dy: gap, anchor: 'middle', baseline: 'hanging', direction }
  }
  return { dx: gap, dy: 0, anchor: 'start', baseline: 'middle', direction: 'right' }
}

function getFallbackLabelLayout(c) {
  return buildLabelLayout(c, getLabelDirectionOrder(c)[0])
}

function labelOffset(c) {
  const { dx, dy } = visibleLabelLayouts.value.get(c.id) || getFallbackLabelLayout(c)
  return { dx, dy }
}

function labelAnchor(c) {
  return (visibleLabelLayouts.value.get(c.id) || getFallbackLabelLayout(c)).anchor || 'start'
}

function labelBaseline(c) {
  return (visibleLabelLayouts.value.get(c.id) || getFallbackLabelLayout(c)).baseline || null
}

function shouldParticipateInLabelPass(c) {
  if (mapLabelMode.value === 'focus' && c.id === activeId.value) return true
  const minZoom = CITY_LABEL_MIN_ZOOM[c.id] ?? 5.4
  return mapZoom.value >= minZoom
}

const overlaySvgScale = computed(() => {
  const metrics = computeMapMetrics()
  if (!metrics || !metrics.scale || !mapZoom.value) return 1
  return 1 / (metrics.scale * mapZoom.value)
})

function markerDotRadius(c) {
  return c.id === activeId.value ? MARKER_ACTIVE_DOT_RADIUS : MARKER_DOT_RADIUS
}

function labelStyle(c) {
  return {
    fontSize: `${getLabelFontSize(c)}px`,
    strokeWidth: `${getLabelStrokeWidth(c)}px`,
  }
}

const countryLabelStyle = computed(() => ({
  fontSize: `${COUNTRY_LABEL_FONT_SIZE}px`,
  strokeWidth: `${COUNTRY_LABEL_STROKE_WIDTH}px`,
}))

function svgToShellPx(
  svgX,
  svgY,
  metrics = computeMapMetrics(),
  zoom = mapZoom.value,
  panX = mapPanX.value,
  panY = mapPanY.value,
) {
  if (!metrics) return null
  const innerX = (WORLD_VIEWBOX.w + svgX) * metrics.scale + metrics.offsetX
  const innerY = svgY * metrics.scale + metrics.offsetY
  return {
    x: innerX * zoom + panX,
    y: innerY * zoom + panY,
  }
}

function getLabelBBox(c, metrics, layout, options = {}) {
  const {
    zoom = mapZoom.value,
    panX = mapPanX.value,
    panY = mapPanY.value,
    point = null,
    state = {},
  } = options
  const { dx, dy, anchor, baseline } = layout
  const screenPointBase = point || svgToShellPx(c.mapX, c.mapY, metrics, zoom, panX, panY)
  if (!screenPointBase) return null
  const screenPoint = { x: screenPointBase.x + dx, y: screenPointBase.y + dy }
  if (!screenPoint) return null

  const fontPx = getLabelFontSize(c, zoom, state)
  const textWidth = [...c.mapLabel].length * fontPx * LABEL_CHAR_WIDTH
  const width = textWidth + LABEL_BOX_PADDING_X * 2
  const height = fontPx * 1.08 + LABEL_BOX_PADDING_Y * 2

  let left = screenPoint.x
  if (anchor === 'middle') left -= width / 2
  else if (anchor === 'end') left -= width

  let top = screenPoint.y - height * 0.78
  if (baseline === 'middle') top = screenPoint.y - height / 2
  else if (baseline === 'hanging') top = screenPoint.y

  return {
    id: c.id,
    left: left - LABEL_COLLISION_GAP,
    top: top - LABEL_COLLISION_GAP,
    right: left + width + LABEL_COLLISION_GAP,
    bottom: top + height + LABEL_COLLISION_GAP,
    centerX: screenPoint.x,
    centerY: screenPoint.y,
  }
}

function getMarkerCollisionBox(c, metrics, options = {}) {
  const {
    zoom = mapZoom.value,
    panX = mapPanX.value,
    panY = mapPanY.value,
    point = null,
  } = options
  const shellPoint = point || svgToShellPx(c.mapX, c.mapY, metrics, zoom, panX, panY)
  if (!shellPoint) return null
  const radius = Math.max(markerDotRadius(c), MARKER_RIPPLE_RADIUS) + MARKER_COLLISION_PADDING
  return {
    id: c.id,
    left: shellPoint.x - radius,
    top: shellPoint.y - radius,
    right: shellPoint.x + radius,
    bottom: shellPoint.y + radius,
  }
}

function isLabelBoxOffscreen(box, shellWidth, shellHeight) {
  return (
    box.left < LABEL_EDGE_PADDING ||
    box.top < LABEL_EDGE_PADDING ||
    box.right > shellWidth - LABEL_EDGE_PADDING ||
    box.bottom > shellHeight - LABEL_EDGE_PADDING
  )
}

function labelBoxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function getLabelPriority(c, box, shellWidth, shellHeight) {
  let score = LABEL_PRIORITY[c.id] || 60
  if (c.id === activeId.value) score += 120
  if (isFocusedCityLabel(c)) score += 500
  const dx = box.centerX - shellWidth / 2
  const dy = box.centerY - shellHeight / 2
  const distance = Math.hypot(dx, dy)
  score += Math.max(0, 80 - distance * 0.16)
  return score
}

function getCenteredPanForCity(city, metrics, zoom) {
  if (!metrics) return null
  const point = svgToShellPx(city.mapX, city.mapY, metrics, 1, 0, 0)
  if (!point) return null
  return {
    panX: metrics.sw / 2 - point.x * zoom,
    panY: metrics.sh / 2 - point.y * zoom,
  }
}

function canPlaceFocusedLabel(city, metrics, zoom) {
  const focusPan = getCenteredPanForCity(city, metrics, zoom)
  if (!focusPan) return false

  const focusState = { active: true, focused: true }
  const markerBoxes = mapCities.value
    .map((other) => {
      const point = svgToShellPx(other.mapX, other.mapY, metrics, zoom, focusPan.panX, focusPan.panY)
      const box = getMarkerCollisionBox(other, metrics, { zoom, point })
      return box ? { id: other.id, box } : null
    })
    .filter(Boolean)

  const focusedPoint = svgToShellPx(city.mapX, city.mapY, metrics, zoom, focusPan.panX, focusPan.panY)
  if (!focusedPoint) return false

  for (const direction of getLabelDirectionOrder(city, true)) {
    const layout = buildLabelLayout(city, direction, zoom, focusState)
    const box = getLabelBBox(city, metrics, layout, { zoom, point: focusedPoint, state: focusState })
    if (!box || isLabelBoxOffscreen(box, metrics.sw, metrics.sh)) continue
    const hitsMarker = markerBoxes.some((marker) => marker.id !== city.id && labelBoxesOverlap(box, marker.box))
    if (!hitsMarker) return true
  }

  return false
}

function getRecommendedFocusZoom(city) {
  const metrics = computeMapMetrics()
  if (!city || !metrics) return BASE_FOCUS_ZOOM

  for (let zoom = BASE_FOCUS_ZOOM; zoom <= MAX_FOCUS_ZOOM + 0.001; zoom += FOCUS_ZOOM_STEP) {
    if (canPlaceFocusedLabel(city, metrics, zoom)) {
      return Math.round(zoom * 10) / 10
    }
  }

  return MAX_FOCUS_ZOOM
}

const visibleLabelLayouts = computed(() => {
  const metrics = computeMapMetrics()
  if (!metrics) return new Map()

  const markerBoxes = mapCities.value
    .map((c) => {
      const box = getMarkerCollisionBox(c, metrics)
      return box ? { id: c.id, box } : null
    })
    .filter(Boolean)

  const candidates = mapCities.value
    .map((c, index) => {
      if (!shouldParticipateInLabelPass(c)) return null
      return {
        city: c,
        index,
        point: svgToShellPx(c.mapX, c.mapY, metrics),
      }
    })
    .filter(Boolean)
    .map((candidate) => ({
      ...candidate,
      priority: getLabelPriority(
        candidate.city,
        {
          centerX: candidate.point?.x ?? metrics.sw / 2,
          centerY: candidate.point?.y ?? metrics.sh / 2,
        },
        metrics.sw,
        metrics.sh,
      ),
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)

  const visible = []
  for (const candidate of candidates) {
    for (const direction of getLabelDirectionOrder(candidate.city)) {
      const layout = buildLabelLayout(candidate.city, direction)
      const box = getLabelBBox(candidate.city, metrics, layout)
      if (!box || isLabelBoxOffscreen(box, metrics.sw, metrics.sh)) continue
      const hitsVisibleLabel = visible.some((kept) => labelBoxesOverlap(box, kept.box))
      if (hitsVisibleLabel) continue
      const hitsMarker = markerBoxes.some((marker) => marker.id !== candidate.city.id && labelBoxesOverlap(box, marker.box))
      if (hitsMarker) continue
      visible.push({ ...candidate, box, layout })
      break
    }
  }

  return new Map(visible.map((item) => [item.city.id, item.layout]))
})

function shouldShowLabel(c) {
  return visibleLabelLayouts.value.has(c.id)
}

function fmtTime(tz) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date())
  } catch {
    return '—'
  }
}

function tickTimes() {
  for (const c of cities.value) c.time = fmtTime(c.tz)
}

const WEATHER_EMOJI = {
  '☀️': '☀️',
  '🌞': '☀️',
  Sunny: '☀️',
  '⛅': '⛅',
  Partly: '⛅',
  '☁️': '☁️',
  Cloudy: '☁️',
  Overcast: '☁️',
  '🌧': '🌧',
  Rain: '🌧',
  '❄️': '❄️',
  Snow: '❄️',
  '🌫': '🌫',
  Fog: '🌫',
  Mist: '🌫',
}

function pickEmoji(text) {
  if (!text) return '⛅'
  for (const k of Object.keys(WEATHER_EMOJI)) {
    if (text.includes(k)) return WEATHER_EMOJI[k]
  }
  return '⛅'
}

/*
 * 中英各存一份，而不是存一条拼好的字符串：天气只在挂载时拉一次，
 * 存成一条的话切到英文就只能挂着「体感 27°C」这种中英混排，除非重新请求。
 */
function applyWeather(idx, lines, emojiSource) {
  if (idx < 0) return
  const zh = typeof lines === 'string' ? lines : lines.zh
  const en = typeof lines === 'string' ? lines : lines.en
  cities.value[idx].weatherZh = zh
  cities.value[idx].weatherEn = en
  cities.value[idx].weatherEmoji = pickEmoji(emojiSource || zh || en)
}

/** 左侧列表那一行天气；没数据时显示对应语言的占位。 */
function weatherLabel(city) {
  if (isEnglish.value) return city.weatherEn || city.weatherZh || 'Loading…'
  return city.weatherZh || city.weatherEn || '加载中…'
}

async function fetchWeather(city) {
  const idx = cities.value.findIndex((c) => c.id === city.id)
  try {
    const url = `https://wttr.in/${encodeURIComponent(city.wttr)}?format=j1&lang=zh`
    const res = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('weather http ' + res.status)
    const raw = (await res.text()).trim()
    if (!raw || raw.startsWith('<') || raw.toLowerCase().includes('<!doctype')) {
      throw new Error('weather html body')
    }
    const data = JSON.parse(raw)
    const cur = data.current_condition?.[0]
    if (!cur) throw new Error('weather empty')
    const descZh = cur.lang_zh?.[0]?.value || cur.weatherDesc?.[0]?.value || '—'
    const descEn = cur.weatherDesc?.[0]?.value || cur.lang_zh?.[0]?.value || '—'
    const temp = cur.temp_C != null ? `${cur.temp_C}°C` : ''
    const feelC = cur.FeelsLikeC
    const build = (desc, feelLabel) =>
      [desc, temp, feelC != null ? `${feelLabel} ${feelC}°C` : ''].filter(Boolean).join(' · ')
    applyWeather(
      idx,
      { zh: build(descZh, '体感') || '—', en: build(descEn, 'Feels like') || '—' },
      descZh,
    )
  } catch {
    try {
      const url = `https://wttr.in/${encodeURIComponent(city.wttr)}?format=%c+%C+%t&lang=zh`
      const res = await fetch(url, {
        mode: 'cors',
        headers: { Accept: 'text/plain' },
      })
      if (!res.ok) throw new Error('fallback http')
      const text = (await res.text()).trim()
      if (!text || text.startsWith('<') || text.toLowerCase().includes('<!doctype')) {
        throw new Error('weather html body')
      }
      applyWeather(idx, text, text)
    } catch {
      applyWeather(idx, { zh: '天气暂不可用', en: 'Weather unavailable' }, '')
    }
  }
}

onMounted(() => {
  tickTimes()
  timer = setInterval(tickTimes, 1000)
  cityList.reduce(
    (p, city) => p.then(() => fetchWeather(city)).catch(() => {}),
    Promise.resolve(),
  )
  nextTick(() => {
    focusInitialAsia()
  })
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (mapTransitionTimer) clearTimeout(mapTransitionTimer)
  activePointers.clear()
  mapGesture = null
})
</script>

<template>
  <div class="lk-cnfp">
    <div class="lk-cnfp__layout">
      <aside class="lk-cnfp__side" aria-label="城市列表：当地时间与天气">
        <p class="lk-cnfp__side-intro">
          点选城市查看地图高亮；时间与天气来自 wttr.in。
        </p>
        <ul class="lk-cnfp__city-list" role="list">
          <li v-for="c in cities" :key="c.id">
            <button
              type="button"
              class="lk-cnfp__city-row"
              :class="{ 'lk-cnfp__city-row--active': c.id === activeId }"
              @click="selectCityFromList(c.id)"
            >
              <span class="lk-cnfp__city-row-head">
                <span class="lk-cnfp__city-row-name">{{ cityLabel(c) }}</span>
                <span class="lk-cnfp__city-row-emoji" aria-hidden="true">{{ c.weatherEmoji }}</span>
              </span>
              <span class="lk-cnfp__city-row-time">{{ c.time || '--:--:--' }}</span>
              <span class="lk-cnfp__city-row-weather">{{ weatherLabel(c) }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <div class="lk-cnfp__map-wrap">
        <header class="lk-cnfp__map-head">
          <h3 class="lk-cnfp__map-title">足迹 · 中国</h3>
          <p class="lk-cnfp__map-sub">每一个去过的地方，都是成长的坐标</p>
        </header>

        <div class="lk-cnfp__map-panel" role="img" aria-label="中国地图上的到访城市">
          <div class="lk-cnfp__zoom-tools">
            <label class="lk-cnfp__font-cap-control" aria-label="城市标签字号上限">
              <span class="lk-cnfp__font-cap-label">字上限</span>
              <input
                v-model.number="labelFontCap"
                class="lk-cnfp__font-cap-range"
                type="range"
                :min="LABEL_FONT_CAP_MIN"
                :max="LABEL_FONT_CAP_MAX"
                :step="LABEL_FONT_CAP_STEP"
              />
              <output class="lk-cnfp__font-cap-value">{{ labelFontCap.toFixed(1) }}</output>
            </label>
            <button
              type="button"
              class="lk-cnfp__zoom-btn"
              aria-label="放大"
              @click.stop="stepZoom(1.18)"
            >
              +
            </button>
            <button
              type="button"
              class="lk-cnfp__zoom-btn"
              aria-label="缩小"
              @click.stop="stepZoom(1 / 1.18)"
            >
              −
            </button>
            <button
              type="button"
              class="lk-cnfp__zoom-btn lk-cnfp__zoom-btn--text"
              aria-label="重置缩放与位置"
              @click.stop="resetMapView"
            >
              复位
            </button>
          </div>
          <p class="lk-cnfp__zoom-hint">滚轮或双指缩放 · 单指拖拽 · 点标点或左侧列表选城市</p>
          <div
            ref="zoomShellRef"
            class="lk-cnfp__zoom-shell"
            @wheel.prevent="onMapWheel"
            @pointerdown="onMapPointerDown"
            @pointermove="onMapPointerMove"
            @pointerup="onMapPointerUp"
            @pointercancel="onMapPointerUp"
          >
            <div class="lk-cnfp__zoom-inner">
              <!-- 单个超宽 SVG：viewBox 横向 3× (= 3 份地图在 SVG 内部坐标系连续排列)，
                   slice 裁切只发生在 SVG 最外侧两端虚空，相邻地图无接缝 -->
              <svg
                class="lk-cnfp__svg"
                :viewBox="`0 0 ${WORLD_VIEWBOX.w * 3} ${WORLD_VIEWBOX.h}`"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <linearGradient id="lk-cnfp-land" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#eef2ff" />
                    <stop offset="100%" stop-color="#e0e7ff" />
                  </linearGradient>
                  <filter id="lk-cnfp-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <g
                  class="lk-cnfp__zoom-viewport"
                  :transform="mapViewportTransform"
                  :style="{
                    transition: mapTransition
                      ? 'transform 0.36s cubic-bezier(0.22, 0.61, 0.36, 1)'
                      : 'none',
                  }"
                >

                <!-- 海洋背景：占满整个超宽 viewBox -->
                <rect
                  class="lk-cnfp__ocean"
                  x="0"
                  y="0"
                  :width="WORLD_VIEWBOX.w * 3"
                  :height="WORLD_VIEWBOX.h"
                />

                <!-- 3 份大陆 + 中国省份，左/中/右一字横排在同一 SVG 坐标系内 -->
                <g
                  v-for="i in 3"
                  :key="`tile-${i}`"
                  :transform="`translate(${(i - 1) * WORLD_VIEWBOX.w} 0)`"
                >
                  <path :d="WORLD_SVG_PATH_D" class="lk-cnfp__world-fill" />
                  <path :d="CHINA_PROVINCES_PATH_D" class="lk-cnfp__provinces" />
                </g>

                <!-- 辐射线 + 城市标记：只画在中间地图（viewBox x ∈ [W, 2W]） -->
                <g :transform="`translate(${WORLD_VIEWBOX.w} 0)`">
                  <g
                    v-if="shouldShowCountryLabels"
                    class="lk-cnfp__countries"
                    :style="{ opacity: countryLabelOpacity }"
                  >
                    <g
                      v-for="country in mapCountryLabels"
                      :key="country.id"
                      :transform="`translate(${country.mapX} ${country.mapY})`"
                      class="lk-cnfp__country-label-anchor"
                    >
                      <g :transform="`scale(${overlaySvgScale})`">
                        <text
                          class="lk-cnfp__country-label"
                          :style="countryLabelStyle"
                          text-anchor="middle"
                          dominant-baseline="middle"
                        >
                          {{ country.label }}
                        </text>
                      </g>
                    </g>
                  </g>
                  <g class="lk-cnfp__routes" fill="none" stroke-linecap="round">
                    <path
                      v-for="seg in connectionPaths"
                      :key="seg.id"
                      :d="seg.d"
                      class="lk-cnfp__route"
                      stroke-dasharray="3 5"
                    />
                  </g>

                  <g
                    v-for="c in mapCities"
                    :key="c.id"
                    class="lk-cnfp__marker-g"
                    :class="{ 'lk-cnfp__marker-g--active': c.id === activeId }"
                    @click="openCityFromMap(c.id)"
                  >
                    <g :transform="`translate(${c.mapX} ${c.mapY})`" class="lk-cnfp__marker-anchor">
                      <g :transform="`scale(${overlaySvgScale})`" class="lk-cnfp__marker">
                        <circle :r="MARKER_RIPPLE_RADIUS" class="lk-cnfp__ripple lk-cnfp__ripple--3" />
                        <circle :r="MARKER_RIPPLE_RADIUS" class="lk-cnfp__ripple lk-cnfp__ripple--2" />
                        <circle :r="MARKER_RIPPLE_RADIUS" class="lk-cnfp__ripple lk-cnfp__ripple--1" />
                        <circle :r="markerDotRadius(c)" class="lk-cnfp__dot" />
                        <text
                          v-if="shouldShowLabel(c)"
                          :x="labelOffset(c).dx"
                          :y="labelOffset(c).dy"
                          :text-anchor="labelAnchor(c)"
                          :dominant-baseline="labelBaseline(c)"
                          :style="labelStyle(c)"
                          class="lk-cnfp__label"
                          :class="{
                            'lk-cnfp__label--active': c.id === activeId,
                            'lk-cnfp__label--focus': isFocusedCityLabel(c),
                          }"
                        >
                          {{ c.mapLabel }}
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="lk-cnfp__legend" aria-label="说明">
      <span class="lk-cnfp__legend-item">虚线自浙江台州向外辐射；青色标点为到访城市，选中后变橙色</span>
      <span class="lk-cnfp__legend-item lk-cnfp__legend-item--hint">左侧列表与地图标点联动；地图可缩放拖拽浏览</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lk-cnfp {
  width: 100%;
}

.lk-cnfp__layout {
  display: grid;
  grid-template-columns: minmax(232px, 280px) minmax(0, 1fr);
  gap: 0.85rem 1rem;
  /* 关键：左右两栏拉伸到同一行高，由右侧 map-wrap 的 flex 链条决定 */
  align-items: stretch;
}

.lk-cnfp__side {
  position: relative;
  min-height: 120px;
  /* 抬高 max-height 上限以容纳右侧地图自然高度；
     列表内部 flex:1 + overflow-y:auto 仍负责长列表滚动 */
  max-height: clamp(440px, 64vh, 620px);
  padding: 0.15rem 0.25rem 0 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.lk-cnfp__side-intro {
  margin: 0 0 0.45rem;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(15, 23, 42, 0.48);
  letter-spacing: 0.02em;
}

[data-theme='dark'] .lk-cnfp__side-intro {
  color: rgba(226, 232, 240, 0.48);
}

.lk-cnfp__city-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-height: 0;
  scrollbar-gutter: stable;
}

.lk-cnfp__city-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.12rem;
  width: 100%;
  margin: 0;
  padding: 0.42rem 0.5rem 0.48rem;
  border-radius: 11px;
  border: 1px solid rgba(99, 102, 241, 0.14);
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.lk-cnfp__city-row:hover {
  border-color: rgba(124, 58, 237, 0.35);
  background: rgba(245, 243, 255, 0.92);
}

.lk-cnfp__city-row--active {
  border-color: rgba(124, 58, 237, 0.55);
  background: linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%);
  box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.22);
}

[data-theme='dark'] .lk-cnfp__city-row {
  background: rgba(30, 41, 59, 0.55);
  border-color: rgba(148, 163, 184, 0.2);
}

[data-theme='dark'] .lk-cnfp__city-row:hover {
  background: rgba(49, 46, 129, 0.35);
  border-color: rgba(196, 181, 253, 0.35);
}

[data-theme='dark'] .lk-cnfp__city-row--active {
  background: linear-gradient(145deg, rgba(76, 29, 149, 0.45) 0%, rgba(30, 41, 59, 0.75) 100%);
  border-color: rgba(196, 181, 253, 0.45);
}

.lk-cnfp__city-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
}

.lk-cnfp__city-row-name {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #4c1d95;
  line-height: 1.25;
}

[data-theme='dark'] .lk-cnfp__city-row-name {
  color: #e9d5ff;
}

.lk-cnfp__city-row-emoji {
  font-size: 1.05rem;
  line-height: 1;
  flex-shrink: 0;
}

.lk-cnfp__city-row-time {
  font-family: var(--lk-font-mono, ui-monospace, monospace);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(15, 23, 42, 0.72);
}

[data-theme='dark'] .lk-cnfp__city-row-time {
  color: rgba(226, 232, 240, 0.82);
}

.lk-cnfp__city-row-weather {
  font-size: 0.7rem;
  line-height: 1.4;
  color: rgba(15, 23, 42, 0.58);
}

[data-theme='dark'] .lk-cnfp__city-row-weather {
  color: rgba(226, 232, 240, 0.62);
}

@media (max-width: 720px) {
  .lk-cnfp__layout {
    grid-template-columns: 1fr;
  }

  .lk-cnfp__side {
    min-height: 0;
    max-height: min(260px, 42vh);
    padding: 0 0 0.35rem;
    order: -1;
  }

  .lk-cnfp__map-panel {
    min-height: 300px;
  }

  .lk-cnfp__zoom-hint {
    padding-right: 0;
  }

  .lk-cnfp__zoom-tools {
    position: static;
    max-width: none;
    justify-content: flex-start;
    margin-bottom: 0.35rem;
  }
}

.lk-cnfp__map-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.lk-cnfp__map-head {
  padding: 0 0.15rem;
}

.lk-cnfp__map-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #5b21b6;
  line-height: 1.25;
}

[data-theme='dark'] .lk-cnfp__map-title {
  color: #c4b5fd;
}

.lk-cnfp__map-sub {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: rgba(91, 33, 182, 0.72);
  letter-spacing: 0.02em;
}

[data-theme='dark'] .lk-cnfp__map-sub {
  color: rgba(196, 181, 253, 0.75);
}

.lk-cnfp__map-panel {
  position: relative;
  /* 改为 flex 列：让 zoom-shell 通过 flex:1 撑满 map-wrap 行高，
     从而和左侧 sidebar 底部对齐 */
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: min(340px, 44vh);
  border-radius: 18px;
  padding: 0.5rem 0.55rem 2rem;
  background: linear-gradient(165deg, #ffffff 0%, #f8fafc 42%, #f1f5f9 100%);
  border: 1px solid rgba(99, 102, 241, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 12px 40px -24px rgba(91, 33, 182, 0.22);
}

[data-theme='dark'] .lk-cnfp__map-panel {
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.88) 100%);
  border-color: rgba(167, 139, 250, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 16px 48px -20px rgba(0, 0, 0, 0.45);
}

.lk-cnfp__zoom-tools {
  position: absolute;
  top: 0.4rem;
  right: 0.45rem;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.28rem;
  max-width: 52%;
}

.lk-cnfp__font-cap-control {
  display: none;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.65rem;
  padding: 0 0.45rem;
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  background: rgba(255, 255, 255, 0.9);
  color: #5b21b6;
  user-select: none;
}

.lk-cnfp__font-cap-label {
  font-size: 0.64rem;
  font-weight: 700;
  white-space: nowrap;
}

.lk-cnfp__font-cap-range {
  width: 5.25rem;
  accent-color: #7c3aed;
}

.lk-cnfp__font-cap-value {
  min-width: 2.2rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: right;
  color: inherit;
}

.lk-cnfp__zoom-btn {
  appearance: none;
  margin: 0;
  min-width: 1.65rem;
  height: 1.65rem;
  padding: 0 0.35rem;
  border-radius: 8px;
  border: 1px solid rgba(99, 102, 241, 0.28);
  background: rgba(255, 255, 255, 0.88);
  color: #5b21b6;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.lk-cnfp__zoom-btn--text {
  min-width: auto;
  padding: 0 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
}

.lk-cnfp__zoom-btn:hover {
  border-color: rgba(124, 58, 237, 0.45);
  background: #f5f3ff;
}

[data-theme='dark'] .lk-cnfp__zoom-btn {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(167, 139, 250, 0.35);
  color: #e9d5ff;
}

[data-theme='dark'] .lk-cnfp__font-cap-control {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(167, 139, 250, 0.28);
  color: #e9d5ff;
}

[data-theme='dark'] .lk-cnfp__zoom-btn:hover {
  background: rgba(76, 29, 149, 0.35);
}

.lk-cnfp__zoom-hint {
  margin: 0 0 0.4rem;
  padding-right: 6.5rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: rgba(91, 33, 182, 0.52);
  letter-spacing: 0.02em;
}

[data-theme='dark'] .lk-cnfp__zoom-hint {
  color: rgba(196, 181, 253, 0.55);
}

.lk-cnfp__zoom-shell {
  position: relative;
  overflow: hidden;
  border-radius: 13px;
  /* 由原固定 height 改为 flex 拉伸 + 最小高度，让地图与左侧城市列底部对齐 */
  flex: 1 1 auto;
  height: auto;
  min-height: clamp(340px, 50vh, 420px);
  touch-action: none;
  cursor: grab;
  background: rgba(248, 250, 252, 0.5);
}

[data-theme='dark'] .lk-cnfp__zoom-shell {
  background: rgba(15, 23, 42, 0.35);
}

.lk-cnfp__zoom-shell:active {
  cursor: grabbing;
}

// inner 横向 3× shell 宽：内含 1 个超宽 SVG，3 份地图通过 viewBox 内 transform 排列
// panX wrap 实现经度循环（"3D" 横向滚动），相邻地图视觉无缝
.lk-cnfp__zoom-inner {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 300%;
}

.lk-cnfp__svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  shape-rendering: geometricPrecision;
}

.lk-cnfp__zoom-viewport {
  transform-origin: 0 0;
}

.lk-cnfp__ocean {
  fill: rgba(224, 231, 255, 0.45);
}

[data-theme='dark'] .lk-cnfp__ocean {
  fill: rgba(15, 23, 42, 0.55);
}

.lk-cnfp__world-fill {
  fill: url(#lk-cnfp-land);
  stroke: rgba(99, 102, 241, 0.32);
  stroke-width: 0.45;
  fill-rule: evenodd;
  vector-effect: non-scaling-stroke;
}

[data-theme='dark'] .lk-cnfp__world-fill {
  fill: rgba(49, 46, 129, 0.62);
  stroke: rgba(167, 139, 250, 0.4);
}

.lk-cnfp__provinces {
  fill: none;
  stroke: rgba(124, 58, 237, 0.42);
  stroke-width: 0.36;
  stroke-linejoin: round;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}

[data-theme='dark'] .lk-cnfp__provinces {
  stroke: rgba(196, 181, 253, 0.5);
}

.lk-cnfp__route {
  stroke: rgba(124, 58, 237, 0.55);
  stroke-width: 0.55;
  vector-effect: non-scaling-stroke;
}

[data-theme='dark'] .lk-cnfp__route {
  stroke: rgba(196, 181, 253, 0.6);
}

.lk-cnfp__countries {
  pointer-events: none;
  transition: opacity 0.24s ease;
}

.lk-cnfp__country-label {
  font-size: 13.2px;
  font-weight: 700;
  letter-spacing: 0.08px;
  fill: rgba(124, 58, 237, 0.74);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.94);
  stroke-width: 2.1px;
  stroke-linejoin: round;
  text-rendering: geometricPrecision;
}

[data-theme='dark'] .lk-cnfp__country-label {
  fill: rgba(196, 181, 253, 0.8);
  stroke: rgba(15, 23, 42, 0.9);
}

.lk-cnfp__marker-g {
  cursor: pointer;
}

.lk-cnfp__ripple {
  fill: none;
  stroke: rgba(14, 165, 233, 0.55);
  stroke-width: 0.25;
  transform-box: fill-box;
  transform-origin: center;
  animation: lk-cnfp-ripple 2.85s ease-out infinite;
  vector-effect: non-scaling-stroke;
}

.lk-cnfp__ripple--2 {
  animation-delay: 0.55s;
  stroke: rgba(56, 189, 248, 0.45);
}

.lk-cnfp__ripple--3 {
  animation-delay: 1.1s;
  stroke: rgba(125, 211, 252, 0.38);
}

.lk-cnfp__marker-g--active .lk-cnfp__ripple {
  stroke: rgba(249, 115, 22, 0.92);
  stroke-width: 0.32;
}

.lk-cnfp__marker-g--active .lk-cnfp__ripple--2 {
  stroke: rgba(251, 146, 60, 0.8);
}

.lk-cnfp__marker-g--active .lk-cnfp__ripple--3 {
  stroke: rgba(254, 215, 170, 0.7);
}

.lk-cnfp__dot {
  fill: #0284c7;
  stroke: #f0f9ff;
  stroke-width: 0.34;
  filter: url(#lk-cnfp-glow);
  transition: fill 0.25s ease, stroke 0.25s ease;
  vector-effect: non-scaling-stroke;
}

.lk-cnfp__marker-g--active .lk-cnfp__dot {
  fill: #ea580c;
  stroke: #fff7ed;
  stroke-width: 0.4;
}

.lk-cnfp__label {
  font-weight: 600;
  letter-spacing: 0.04px;
  fill: rgba(30, 27, 75, 0.82);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-linejoin: round;
  pointer-events: none;
  transition: fill 0.25s ease, opacity 0.25s ease;
  text-rendering: geometricPrecision;
}

[data-theme='dark'] .lk-cnfp__label {
  fill: rgba(226, 232, 240, 0.92);
  stroke: rgba(15, 23, 42, 0.85);
}

.lk-cnfp__label--active {
  fill: #c2410c;
  font-weight: 800;
  stroke: rgba(255, 255, 255, 0.95);
}

.lk-cnfp__label--focus {
  letter-spacing: 0.08px;
}

[data-theme='dark'] .lk-cnfp__label--active {
  fill: #fdba74;
  stroke: rgba(15, 23, 42, 0.92);
}

/* 聚焦放大状态下，隐藏非选中标签彻底避免重叠；非选中点位保留半透明以便定位 */
.lk-cnfp__legend {
  margin-top: 0.65rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.85rem;
  font-size: 0.82rem;
  color: rgba(15, 23, 42, 0.78);
}

[data-theme='dark'] .lk-cnfp__legend {
  color: rgba(226, 232, 240, 0.85);
}

.lk-cnfp__legend-item--hint {
  margin-left: auto;
  font-weight: 600;
  opacity: 0.9;
}

@media (max-width: 720px) {
  .lk-cnfp__legend-item--hint {
    margin-left: 0;
  }
}

@keyframes lk-cnfp-ripple {
  0% {
    transform: scale(0.35);
    opacity: 0.88;
  }
  100% {
    transform: scale(5.2);
    opacity: 0;
  }
}
</style>
