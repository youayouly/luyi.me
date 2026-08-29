/** localStorage + 自定义事件：与导航栏看板娘开关、client.js 同步 */
export const LIVE2D_PREF_KEY = 'lk-live2d-enabled'
export const LIVE2D_PREF_EVENT = 'lk-live2d-pref-changed'

/** 未写入 localStorage 时默认关闭；仅 `lk-live2d-enabled === '1'` 为开启。 */
export function readLive2dPref() {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(LIVE2D_PREF_KEY)
    if (v === null) return false
    return v !== '0'
  } catch {
    return false
  }
}

export function writeLive2dPref(enabled) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LIVE2D_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(LIVE2D_PREF_EVENT, { detail: { enabled } }),
  )
}
