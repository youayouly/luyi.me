/** localStorage + 自定义事件：与 RoutePageCurtain / 设置面板同步 */
export const ROUTE_CURTAIN_PREF_KEY = 'lk-route-curtain-enabled'
export const ROUTE_CURTAIN_PREF_EVENT = 'lk-route-curtain-pref-changed'

/** 默认开启：未存过偏好时返回 true */
export function readRouteCurtainPref() {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(ROUTE_CURTAIN_PREF_KEY)
    if (v === null) return true
    return v !== '0'
  } catch {
    return true
  }
}

export function writeRouteCurtainPref(enabled) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ROUTE_CURTAIN_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(ROUTE_CURTAIN_PREF_EVENT, { detail: { enabled } }),
  )
}
