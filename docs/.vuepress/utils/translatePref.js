/** localStorage + 自定义事件：页面翻译语言在导航栏开关、设置面板和翻译引擎之间同步 */
export const TRANSLATE_LANG_KEY = 'lk-page-lang'
export const TRANSLATE_LANG_EVENT = 'lk-page-lang-changed'

/** 站点原文语言，也是"关闭翻译"时的取值。 */
export const SOURCE_LANG = 'zh'
export const DEFAULT_TARGET_LANG = 'en'

export const SUPPORTED_LANGS = [SOURCE_LANG, DEFAULT_TARGET_LANG]

/**
 * 存的是「模式」不是语言：
 * - `en`（默认）所有人进来都显示英文
 * - `auto` 跟随浏览器语言，中文环境看原文，其他一律译成英文
 * - `zh` / `en` 是访客点过开关后的明确选择
 */
export const LANG_MODE_AUTO = 'auto'
export const SUPPORTED_LANG_MODES = [LANG_MODE_AUTO, ...SUPPORTED_LANGS]

/** 浏览器首选语言是中文（含港澳台、新马）就看原文，其余按英文处理。 */
export function detectBrowserLang() {
  if (typeof navigator === 'undefined') return SOURCE_LANG
  const list = navigator.languages?.length ? navigator.languages : [navigator.language]
  const primary = String(list?.[0] || '').toLowerCase()
  return primary.startsWith('zh') ? SOURCE_LANG : DEFAULT_TARGET_LANG
}

export function resolveLang(mode) {
  if (mode === SOURCE_LANG || mode === DEFAULT_TARGET_LANG) return mode
  return detectBrowserLang()
}

/** 读原始模式，给设置面板用（要能区分「跟随浏览器」和「明确选了中文」）。 */
export function readLangMode() {
  if (typeof window === 'undefined') return LANG_MODE_AUTO
  try {
    const v = window.localStorage.getItem(TRANSLATE_LANG_KEY)
    // 没存过就默认英文：所有人进来都是英文，而不是跟随浏览器语言。
    return SUPPORTED_LANG_MODES.includes(v) ? v : DEFAULT_TARGET_LANG
  } catch {
    return DEFAULT_TARGET_LANG
  }
}

/** 读实际生效的语言，给翻译引擎用。 */
export function readLangPref() {
  return resolveLang(readLangMode())
}

export function writeLangMode(mode) {
  if (typeof window === 'undefined') return LANG_MODE_AUTO
  const next = SUPPORTED_LANG_MODES.includes(mode) ? mode : LANG_MODE_AUTO
  try {
    window.localStorage.setItem(TRANSLATE_LANG_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(TRANSLATE_LANG_EVENT, { detail: { mode: next, lang: resolveLang(next) } }),
  )
  return next
}

export function writeLangPref(lang) {
  return writeLangMode(SUPPORTED_LANGS.includes(lang) ? lang : SOURCE_LANG)
}
