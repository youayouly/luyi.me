/**
 * 访客上报 + 后台读日志。
 *
 * 上报走 `navigator.sendBeacon`：浏览器在页面卸载/切走时也保证发出去，而且
 * 不占用 fetch 的并发额度，不会跟首屏资源抢带宽。sendBeacon 不可用时退回
 * `fetch(..., { keepalive: true })`。
 *
 * 服务端已经按 (访客, 路径) 做了 30 秒去重，所以这里只做最基本的同页面防抖：
 * 同一次会话里连续两次相同 path 不重复发。
 */

import { getDeviceFingerprint } from './deviceFingerprint.js'

const ENDPOINT = '/api/visit'
const LOG_ENDPOINT = '/api/visitor-log'

let lastPath = ''

function isLocalHost() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname || ''
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.startsWith('192.168.') ||
    h.startsWith('10.')
  )
}

/**
 * 上报一次访问。
 * @param {string} path 当前路由路径
 * @param {{ owner?: boolean }} [opts] owner=true 表示这是站长自己（后台会标出来）
 */
export function reportVisit(path, opts = {}) {
  if (typeof window === 'undefined') return
  // 本地开发不往线上库里灌脏数据。
  if (isLocalHost()) return

  const clean = String(path || window.location.pathname).split('#')[0]
  if (clean === lastPath) return
  lastPath = clean

  /*
   * 同步读取，不 await——见 deviceFingerprint.js 头注释：sendBeacon 必须留在
   * 触发它的这个同步调用链里，中间插一次 await 在 Safari 上会导致后续的
   * SPA 内部跳转经常发不出这次上报（首次整页加载不受影响，因为那次本来就
   * 有更宽松的时间窗）。指纹算好之前的头几次访问会没有 fp，之后自然补上。
   */
  const fp = getDeviceFingerprint()

  const payload = JSON.stringify({
    path: clean,
    ref: document.referrer || '',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    owner: Boolean(opts.owner),
    fp,
  })

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* 统计失败永远不该影响浏览 */
  }
}

/** 后台「访客」分区读明细。依赖 HttpOnly 会话 cookie，同源自动带上。 */
export async function fetchVisitorLog(limit = 100) {
  const res = await fetch(`${LOG_ENDPOINT}?limit=${limit}`, {
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

/** 清空全部访客统计。 */
export async function clearVisitorLog() {
  const res = await fetch(LOG_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'clear' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}
