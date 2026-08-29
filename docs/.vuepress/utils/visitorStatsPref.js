export const VISITOR_STATS_PREF_KEY = 'lk-visitor-stats-enabled'
export const VISITOR_STATS_EVENT = 'lk-visitor-stats-changed'

export function readVisitorStatsEnabled() {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(VISITOR_STATS_PREF_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function writeVisitorStatsEnabled(enabled) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VISITOR_STATS_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(VISITOR_STATS_EVENT, { detail: { enabled } }))
}
