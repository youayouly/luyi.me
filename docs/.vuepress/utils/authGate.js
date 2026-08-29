import { computed, ref } from 'vue'

import { hasSessionHint } from './adminSession.js'

export const STORAGE_KEY = 'lk_private_ok'
/** 登录态变化时派发（同 tab 内 sessionStorage 无 storage 事件） */
export const AUTH_STATE_EVENT = 'lk-auth-state'

export function normPath(p) {
  let x = (p || '/').replace(/\/+$/, '') || '/'
  x = x.replace(/\.html$/i, '')
  return x
}

/**
 * Public: `/`, About, Projects (`/tech/`), Articles (`/article/`).
 * Protected: `/home`, Study, Album, etc.
 */
export function isPublicPath(path) {
  const p = normPath(path)
  if (p === '/' || p === '/index') return true
  if (p === '/about' || p.startsWith('/about/')) return true
  if (p === '/tech' || p.startsWith('/tech/')) return true
  if (p === '/article' || p.startsWith('/article/')) return true
  return false
}

/**
 * 首帧就要知道「这台设备是不是登录态」。
 *
 * 只看 sessionStorage 是不够的：**它随标签页关闭一起清空**。所以「登录后直接关页面、
 * 下次再进来」时本地标记没了，后台入口先按未登录渲染，等 `verifyServerSession()` 打完
 * `GET /api/login` 才补上 —— 表现就是设置入口先没有、然后突然冒出来。
 *
 * 会话 cookie `lk_admin` 是 HttpOnly，JS 读不到，但服务端同时下发了一个不含机密的
 * `lk_admin_hint`，有效期和会话一致。用它当乐观标记，首帧就能把后台入口画出来；
 * 服务端校验只负责**往下修正**（被顶下线 / 过期时清掉）。
 *
 * 伪造 hint 换不到任何权限：写接口一律要 HttpOnly token 或账号密码，伪造只会拿到 401。
 * 客户端这道门本来也只是「别把入口画给游客看」，不是安全边界。
 */
export function readAuthed() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1') {
      return true
    }
  } catch {
    /* 隐私模式下读不到就当没有，接着看 cookie */
  }
  return hasSessionHint()
}

export const authedRef = ref(readAuthed())

export function syncAuthedFromStorage() {
  authedRef.value = readAuthed()
}

/** Persist session and refresh reactive login flag (for components). */
export function setAuthed(flag) {
  try {
    if (flag) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore quota / private mode */
  }
  authedRef.value = readAuthed()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(AUTH_STATE_EVENT, { detail: { authed: authedRef.value } }),
    )
  }
}

/** Use in Vue components; router guard should call readAuthed() directly. */
export function useIsLoggedIn() {
  return computed(() => authedRef.value)
}
