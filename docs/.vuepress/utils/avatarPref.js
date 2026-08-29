import { computed, ref } from 'vue'

export const AVATAR_PREF_KEY = 'lk-avatar-src'
export const AVATAR_PREF_EVENT = 'lk-avatar-changed'
export const AVATAR_HISTORY_KEY = 'lk-avatar-history'
/** 设置面板发这个事件让 LoginGate 打开头像编辑器（编辑器本体留在 LoginGate 里）。 */
export const OPEN_AVATAR_MODAL_EVENT = 'lk-open-avatar-modal'
export const DEFAULT_AVATAR = '/gallery/avatar-luke-capybara.png'

export const avatarChoices = [
  { src: '/gallery/avatar-luke-capybara.png', label: '卡皮巴拉切纸（默认）' },
  { src: '/gallery/avatar-luke-2026.png', label: '动漫女孩 2026' },
  { src: '/gallery/avatar-bread-light.svg', label: '浅色三角形' },
  { src: '/gallery/avatar-bread.svg', label: '深色三角形' },
  { src: '/gallery/avatar-bread-backup.svg', label: '动漫面包(备份)' },
  { src: '/avatar.png', label: '历史动漫头像' },
  { src: '/gallery/avatar-2026-04-14.png', label: '历史头像 1' },
  { src: '/gallery/avatar-old-backup.jpg', label: '历史头像 2' },
]

function readAvatarHistory() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(AVATAR_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => item?.src) : []
  } catch {
    return []
  }
}

function isDataUrl(src) {
  return typeof src === 'string' && src.startsWith('data:image/')
}

function normalizeAvatar(src) {
  const known = [
    ...avatarChoices.map((item) => item.src),
    ...readAvatarHistory().map((item) => item.src),
  ]
  return known.includes(src) || isDataUrl(src) ? src : DEFAULT_AVATAR
}

export function readAvatar() {
  if (typeof window === 'undefined') return DEFAULT_AVATAR
  try {
    const raw = window.localStorage.getItem(AVATAR_PREF_KEY)
    return normalizeAvatar(raw || DEFAULT_AVATAR)
  } catch {
    return DEFAULT_AVATAR
  }
}

export function writeAvatar(src) {
  if (typeof window === 'undefined') return
  const next = normalizeAvatar(src)
  try {
    window.localStorage.setItem(AVATAR_PREF_KEY, next)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(AVATAR_PREF_EVENT, { detail: { src: next } }))
}

export const avatarSrcRef = ref(DEFAULT_AVATAR)
export const avatarHistoryRef = ref([])

export function syncAvatarFromStorage() {
  avatarSrcRef.value = readAvatar()
  avatarHistoryRef.value = readAvatarHistory()
}

export function useAvatarSrc() {
  return computed(() => avatarSrcRef.value)
}

export function useAvatarOptions() {
  return computed(() => [...avatarChoices, ...avatarHistoryRef.value])
}

export function addAvatarUpload(src) {
  if (typeof window === 'undefined' || !isDataUrl(src)) return
  const label = `Uploaded ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  const next = [
    { src, label },
    ...readAvatarHistory().filter((item) => item.src !== src),
  ].slice(0, 8)
  try {
    window.localStorage.setItem(AVATAR_HISTORY_KEY, JSON.stringify(next))
    window.localStorage.setItem(AVATAR_PREF_KEY, src)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(AVATAR_PREF_EVENT, { detail: { src } }))
}
