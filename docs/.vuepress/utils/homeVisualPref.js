import { computed, onScopeDispose, ref } from 'vue'

export const HOME_BG_PREF_KEY = 'lk-home-bg-src'
export const HOME_BG_HISTORY_KEY = 'lk-home-bg-history'
export const HOME_PORTRAIT_PREF_KEY = 'lk-home-portrait-src'
export const HOME_PORTRAIT_HISTORY_KEY = 'lk-home-portrait-history'
export const HOME_VISUAL_PREF_EVENT = 'lk-home-visual-changed'

/**
 * 一次性清理标记：当默认背景 / 访客卡 / 不蒜子等有破坏性改动时递增这个值，
 * 每个用户的浏览器首次加载到新版本就会把旧 localStorage 抹干净，回到默认态。
 */
const VISUAL_RESET_KEY = 'lk-visual-reset-v'
const VISUAL_RESET_VERSION = '2026-04-26-hangmoon'
/** 需要在迁移时清掉的历史键（不会影响 authedRef / navPrefs 等其他功能） */
const LEGACY_KEYS_TO_CLEAR = [
  HOME_BG_PREF_KEY,
  HOME_BG_HISTORY_KEY,
  HOME_PORTRAIT_PREF_KEY,
  HOME_PORTRAIT_HISTORY_KEY,
  'busuanzi_value_site_uv',
  'busuanzi_value_site_pv',
]

function runVisualPrefMigrationOnce() {
  if (typeof window === 'undefined') return
  try {
    const stored = window.localStorage.getItem(VISUAL_RESET_KEY)
    if (stored === VISUAL_RESET_VERSION) return
    for (const k of LEGACY_KEYS_TO_CLEAR) {
      window.localStorage.removeItem(k)
    }
    window.localStorage.setItem(VISUAL_RESET_KEY, VISUAL_RESET_VERSION)
  } catch {
    /* localStorage blocked — worst case: user sees old cached preferences */
  }
}

runVisualPrefMigrationOnce()

/**
 * 默认 Hero：「Five minutes of silence」by Hangmoon（pixiv 62506385，4K 原图）。
 * 黄昏湖畔少女背影 + 大片云霞，暖色 + 深蓝双调，浅 / 深主题都 hold 得住。
 *
 * 只保留彩色背景：深色主题下 hero 文案与 CTA 都翻成深色字（见 index.scss），
 * 纯黑夜景那张（星夜湖畔深色 / 跟随主题切换）会让深色字读不出来，已移除。
 * 旧 localStorage 里存的这两个值会被 normalizeSelection 判为未知，自动回落到默认图。
 */
export const DEFAULT_HERO = '/gallery/hero-hangmoon-gaze.jpg'
export const DEFAULT_HOME_BG_LIGHT = '/gallery/hero-starlake-light.png'
export const DEFAULT_HOME_BG = DEFAULT_HERO
export const DEFAULT_HOME_PORTRAIT = ''

export const homeBackgroundChoices = [
  { src: DEFAULT_HERO, label: 'Hangmoon · 黄昏湖畔（默认）' },
  { src: DEFAULT_HOME_BG_LIGHT, label: '星夜湖畔（浅色）' },
  { src: '/gallery/home-bg-anime-landscape.png', label: '动漫自然风景（旧）' },
  { src: '/gallery/home-bg-abstract-gradient.svg', label: '淡色抽象底' },
  { src: '/gallery/about-bg-bright-starfield.svg', label: '亮星空' },
  {
    src: '/gallery/about-hero-sf.png',
    label: '硅基群像（本地 npm run gen:about-hero）',
  },
]

export const homePortraitChoices = [
  { src: '', label: 'Hide Portrait' },
  { src: '/avatar.png', label: 'Current Avatar Portrait' },
  { src: '/gallery/avatar-2026-04-14.png', label: 'Portrait History 1' },
]

function readJsonArray(key) {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

function writeJsonArray(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore storage failures */
  }
}

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function normalizeSelection(src, defaults, history, fallback) {
  if (!src) return fallback
  const known = [...defaults.map((item) => item.src), ...history.map((item) => item.src)]
  if (known.includes(src) || isDataUrl(src)) return src
  return fallback
}

function createLabel(prefix) {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  return `${prefix} ${stamp}`
}

export function readHomeBackgroundHistory() {
  return readJsonArray(HOME_BG_HISTORY_KEY)
}

export function readHomePortraitHistory() {
  return readJsonArray(HOME_PORTRAIT_HISTORY_KEY)
}

export function readHomeBackground() {
  if (typeof window === 'undefined') return DEFAULT_HOME_BG
  try {
    const raw = window.localStorage.getItem(HOME_BG_PREF_KEY) || DEFAULT_HOME_BG
    return normalizeSelection(
      raw,
      homeBackgroundChoices,
      readHomeBackgroundHistory(),
      DEFAULT_HOME_BG,
    )
  } catch {
    return DEFAULT_HOME_BG
  }
}

export function readHomePortrait() {
  if (typeof window === 'undefined') return DEFAULT_HOME_PORTRAIT
  try {
    const raw = window.localStorage.getItem(HOME_PORTRAIT_PREF_KEY) || DEFAULT_HOME_PORTRAIT
    return normalizeSelection(
      raw,
      homePortraitChoices,
      readHomePortraitHistory(),
      DEFAULT_HOME_PORTRAIT,
    )
  } catch {
    return DEFAULT_HOME_PORTRAIT
  }
}

function notifyHomeVisualChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(HOME_VISUAL_PREF_EVENT))
}

export function writeHomeBackground(src) {
  if (typeof window === 'undefined') return
  const next = normalizeSelection(
    src,
    homeBackgroundChoices,
    readHomeBackgroundHistory(),
    DEFAULT_HOME_BG,
  )
  try {
    window.localStorage.setItem(HOME_BG_PREF_KEY, next)
  } catch {
    /* ignore */
  }
  notifyHomeVisualChange()
}

export function writeHomePortrait(src) {
  if (typeof window === 'undefined') return
  const next = normalizeSelection(
    src,
    homePortraitChoices,
    readHomePortraitHistory(),
    DEFAULT_HOME_PORTRAIT,
  )
  try {
    window.localStorage.setItem(HOME_PORTRAIT_PREF_KEY, next)
  } catch {
    /* ignore */
  }
  notifyHomeVisualChange()
}

function appendHistoryItem(historyKey, currentKey, src, labelPrefix) {
  const history = readJsonArray(historyKey)
  const nextItem = {
    src,
    label: createLabel(labelPrefix),
  }
  const next = [
    nextItem,
    ...history.filter((item) => item && item.src && item.src !== src),
  ].slice(0, 8)
  writeJsonArray(historyKey, next)
  try {
    window.localStorage.setItem(currentKey, src)
  } catch {
    /* ignore */
  }
  notifyHomeVisualChange()
}

export function addHomeBackgroundUpload(src) {
  if (!isDataUrl(src) || typeof window === 'undefined') return
  appendHistoryItem(HOME_BG_HISTORY_KEY, HOME_BG_PREF_KEY, src, 'Background')
}

export function addHomePortraitUpload(src) {
  if (!isDataUrl(src) || typeof window === 'undefined') return
  appendHistoryItem(HOME_PORTRAIT_HISTORY_KEY, HOME_PORTRAIT_PREF_KEY, src, 'Portrait')
}

export const homeBackgroundRef = ref(DEFAULT_HOME_BG)
export const homePortraitRef = ref(DEFAULT_HOME_PORTRAIT)
export const homeBackgroundHistoryRef = ref([])
export const homePortraitHistoryRef = ref([])

export function syncHomeVisualsFromStorage() {
  homeBackgroundRef.value = readHomeBackground()
  homePortraitRef.value = readHomePortrait()
  homeBackgroundHistoryRef.value = readHomeBackgroundHistory()
  homePortraitHistoryRef.value = readHomePortraitHistory()
}

/**
 * 当前主题（'light' | 'dark'）。监听 `<html data-theme>` 变化，便于 Hero 图
 * 在用户切换深浅色时实时跟随。SSR 环境下回退为 'light'。
 */
export const currentThemeRef = ref('light')
let themeObserver = null

function readCurrentTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function ensureThemeObserver() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  if (themeObserver) return
  currentThemeRef.value = readCurrentTheme()
  themeObserver = new MutationObserver(() => {
    currentThemeRef.value = readCurrentTheme()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
}

if (typeof window !== 'undefined') {
  ensureThemeObserver()
}

/**
 * 解析背景：空 / 未设置用 DEFAULT_HERO（hangmoon），其余显式 URL 直接透传。
 * 背景不再跟主题切换——深浅两套主题共用同一张彩色图。
 */
function resolveBackground(value) {
  return value || DEFAULT_HERO
}

export function useHomeBackgroundSrc() {
  return computed(() => resolveBackground(homeBackgroundRef.value))
}

export function useHomePortraitSrc() {
  return computed(() => homePortraitRef.value)
}

export function useHomeBackgroundOptions() {
  return computed(() => [...homeBackgroundChoices, ...homeBackgroundHistoryRef.value])
}

export function useHomePortraitOptions() {
  return computed(() => [...homePortraitChoices, ...homePortraitHistoryRef.value])
}
