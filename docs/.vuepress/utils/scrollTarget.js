const SCROLL_ROOT_SELECTORS = [
  '.theme-container',
  'main.vp-page',
  '.vp-page-content',
  '[vp-content]',
  '#app',
]

function isDocumentScroller(el) {
  if (typeof document === 'undefined') return false
  return el === document.scrollingElement || el === document.documentElement || el === document.body
}

function isScrollableElement(el) {
  if (typeof window === 'undefined' || !(el instanceof HTMLElement)) return false

  const style = window.getComputedStyle(el)
  const overflowY = `${style.overflowY} ${style.overflow}`.toLowerCase()
  if (!/(auto|scroll|overlay)/.test(overflowY)) return false

  return el.scrollHeight - el.clientHeight > 2
}

function findScrollableAncestor(target) {
  if (!(target instanceof Element)) return null

  let current = target.parentElement
  while (current) {
    if (isScrollableElement(current)) return current
    current = current.parentElement
  }

  return null
}

function getScrollRoot(target = null, preferredRoot = null) {
  if (typeof document === 'undefined') return null

  if (preferredRoot && (isDocumentScroller(preferredRoot) || isScrollableElement(preferredRoot))) {
    return preferredRoot
  }

  const ancestorRoot = findScrollableAncestor(target)
  if (ancestorRoot) return ancestorRoot

  for (const selector of SCROLL_ROOT_SELECTORS) {
    const candidate = document.querySelector(selector)
    if (candidate instanceof HTMLElement && isScrollableElement(candidate)) {
      return candidate
    }
  }

  const fallback = document.scrollingElement || document.documentElement
  return fallback instanceof HTMLElement ? fallback : document.documentElement
}

function getElementTopWithinRoot(target, root) {
  const targetRect = target.getBoundingClientRect()

  if (isDocumentScroller(root)) {
    return (
      (window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0) +
      targetRect.top
    )
  }

  const rootRect = root.getBoundingClientRect()
  return root.scrollTop + targetRect.top - rootRect.top
}

function readRootFontSize() {
  if (typeof window === 'undefined') return 16

  const parsed = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsed) ? parsed : 16
}

export function readAnchorScrollOffset(extraPx = readRootFontSize() * 0.8) {
  if (typeof window === 'undefined') return 0

  let offset = 0
  const nav = document.querySelector('.vp-navbar')
  if (nav instanceof HTMLElement) {
    offset = Math.max(offset, nav.getBoundingClientRect().height)
  }

  const cssHeight = Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue('--navbar-height'),
  )
  if (Number.isFinite(cssHeight)) {
    offset = Math.max(offset, cssHeight)
  }

  return Math.max(0, Math.round(offset + extraPx))
}

export function scrollElementVerticallyIntoView(
  target,
  {
    behavior = 'auto',
    offset = readAnchorScrollOffset(),
    root = null,
  } = {},
) {
  if (typeof window === 'undefined' || !(target instanceof Element)) return false

  const scrollRoot = getScrollRoot(target, root)
  if (!scrollRoot) return false

  const top = Math.max(0, Math.round(getElementTopWithinRoot(target, scrollRoot) - offset))

  if (isDocumentScroller(scrollRoot)) {
    const left =
      window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0
    window.scrollTo({ top, left, behavior })
    return true
  }

  const left = scrollRoot.scrollLeft || 0
  if (typeof scrollRoot.scrollTo === 'function') {
    scrollRoot.scrollTo({ top, left, behavior })
  } else {
    scrollRoot.scrollTop = top
    scrollRoot.scrollLeft = left
  }

  return true
}

export function findHashTarget(hash) {
  if (typeof document === 'undefined' || !hash) return null

  const raw = String(hash)
  const id = raw.startsWith('#') ? raw.slice(1) : raw
  const decoded = decodeURIComponent(id)
  if (!decoded) return null

  const byId = document.getElementById(decoded)
  if (byId) return byId

  if (!raw.startsWith('#')) return null

  try {
    return document.querySelector(raw)
  } catch {
    return null
  }
}

export function scrollHashVertically(hash, options = {}) {
  const target = findHashTarget(hash)
  if (!target) return false

  return scrollElementVerticallyIntoView(target, options)
}
