import { normPath } from './authGate.js'
import { siteConfig } from '../site.config.js'

export const PROTECTED_ACCESS_ITEMS_PREF_KEY = 'lk_protected_access_items'
export const HIDDEN_NAV_ITEMS_PREF_KEY = 'lk_hidden_nav_items'

export const PROTECTED_ACCESS_EVENT = 'lk:protected-access-change'
export const HIDDEN_NAV_ITEMS_EVENT = 'lk:hidden-nav-items-change'

/** 导航主链接来自 site.config.js；这里只做一次浅拷贝，避免调用方改到配置对象本身 */
export const siteNavbarLinks = siteConfig.nav.map((item) => ({ ...item }))

export const navbarPageOptions = [
  {
    id: 'about',
    label: '首页',
    matches: (path) => {
      const p = normPath(path)
      return p === '/' || p === '/index' || p === '/about' || p.startsWith('/about/')
    },
  },
  {
    id: 'tech',
    label: '项目',
    matches: (path) => {
      const p = normPath(path)
      return p === '/tech' || p.startsWith('/tech/')
    },
  },
  {
    id: 'article',
    label: '文章',
    matches: (path) => {
      const p = normPath(path)
      return p === '/article' || p.startsWith('/article/')
    },
  },
  {
    id: 'study',
    label: '留学',
    matches: (path) => {
      const p = normPath(path)
      return p === '/study' || p.startsWith('/study/')
    },
  },
  {
    id: 'travel',
    label: '相册',
    matches: (path) => {
      const p = normPath(path)
      return p === '/travel' || p.startsWith('/travel/')
    },
  },
  {
    id: 'stats',
    label: '统计',
    matches: (path) => {
      const p = normPath(path)
      return p === '/stats' || p.startsWith('/stats/')
    },
  },
]

export const accessControlledPageOptions = navbarPageOptions.filter((item) => item.id !== 'about')

function readIdList(key, fallback = []) {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallback
    const validIds = new Set(navbarPageOptions.map((item) => item.id))
    return parsed.filter((item) => validIds.has(item))
  } catch {
    return fallback
  }
}

export function readProtectedAccessItems() {
  return readIdList(PROTECTED_ACCESS_ITEMS_PREF_KEY, [])
}

export function writeProtectedAccessItems(ids) {
  const validIds = new Set(accessControlledPageOptions.map((item) => item.id))
  const next = [...new Set(ids)].filter((item) => validIds.has(item))
  try {
    localStorage.setItem(PROTECTED_ACCESS_ITEMS_PREF_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage failures */
  }
  notifyWindow(PROTECTED_ACCESS_EVENT)
}

export function toggleProtectedAccessItem(id) {
  const current = new Set(readProtectedAccessItems())
  if (current.has(id)) current.delete(id)
  else current.add(id)
  writeProtectedAccessItems([...current])
}

export function readHiddenNavItems() {
  return readIdList(HIDDEN_NAV_ITEMS_PREF_KEY, ['study', 'travel'])
}

export function writeHiddenNavItems(ids) {
  const validIds = new Set(navbarPageOptions.map((item) => item.id))
  const next = [...new Set(ids)].filter((item) => validIds.has(item))
  try {
    localStorage.setItem(HIDDEN_NAV_ITEMS_PREF_KEY, JSON.stringify(next))
  } catch {
    /* ignore storage failures */
  }
  notifyWindow(HIDDEN_NAV_ITEMS_EVENT)
}

export function toggleHiddenNavItem(id) {
  const current = new Set(readHiddenNavItems())
  if (current.has(id)) current.delete(id)
  else current.add(id)
  writeHiddenNavItems([...current])
}

function notifyWindow(eventName) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(eventName))
  } catch {
    /* ignore */
  }
}
