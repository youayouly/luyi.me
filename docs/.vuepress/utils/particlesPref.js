/** localStorage + 自定义事件：与 NetworkParticlesBg / 导航栏开关同步 */
export const PARTICLES_PREF_KEY = 'lk-network-particles-enabled'
export const PARTICLES_PREF_EVENT = 'lk-particles-pref-changed'

export function readParticlesPref() {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(PARTICLES_PREF_KEY)
    if (v === null) return false
    return v !== '0'
  } catch {
    return false
  }
}

export function writeParticlesPref(enabled) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PARTICLES_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(PARTICLES_PREF_EVENT, { detail: { enabled } }),
  )
}
