import { reactive } from 'vue'

export const busuanziState = reactive({
  uv: '',
  pv: '',
  ready: false,
  /** Script failed to load (onerror) */
  loadFailed: false,
  /** Polling ended without filling both counters */
  pollSettled: false,
})

let pollTimer = null
let pollTries = 0
let waitMaxTimer = null

const POLL_MAX_TRIES = 60
const POLL_INTERVAL_MS = 400
/** Give up waiting for DOM text (blocked script / API mismatch) */
const BUSUANZI_MAX_WAIT_MS = 12000

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function clearWaitMax() {
  if (waitMaxTimer) {
    clearTimeout(waitMaxTimer)
    waitMaxTimer = null
  }
}

function settleMissingAsDash() {
  busuanziState.pollSettled = true
  busuanziState.ready = true
  if (!busuanziState.uv) busuanziState.uv = '—'
  if (!busuanziState.pv) busuanziState.pv = '—'
}

function finishIfBothOrGiveUp() {
  const hasUv = Boolean(busuanziState.uv)
  const hasPv = Boolean(busuanziState.pv)
  if (hasUv && hasPv) {
    clearPoll()
    clearWaitMax()
    busuanziState.pollSettled = true
    busuanziState.ready = true
    return true
  }
  return false
}

function startPolling() {
  if (pollTimer) return
  pollTries = 0
  clearWaitMax()
  waitMaxTimer = setTimeout(() => {
    waitMaxTimer = null
    if (finishIfBothOrGiveUp()) return
    clearPoll()
    settleMissingAsDash()
  }, BUSUANZI_MAX_WAIT_MS)

  pollTimer = setInterval(() => {
    pollTries += 1
    const uvEl = document.getElementById('busuanzi_value_site_uv')
    const pvEl = document.getElementById('busuanzi_value_site_pv')
    const uv = uvEl?.textContent?.trim() ?? ''
    const pv = pvEl?.textContent?.trim() ?? ''
    if (uv) {
      busuanziState.uv = Number(uv).toLocaleString('zh-CN')
      busuanziState.ready = true
    }
    if (pv) {
      busuanziState.pv = Number(pv).toLocaleString('zh-CN')
      busuanziState.ready = true
    }
    if (finishIfBothOrGiveUp()) return
    if (pollTries > POLL_MAX_TRIES) {
      clearPoll()
      clearWaitMax()
      settleMissingAsDash()
    }
  }, POLL_INTERVAL_MS)
}

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

export function ensureBusuanzi() {
  if (typeof document === 'undefined') return

  if (busuanziState.loadFailed) return

  // 本地开发 / 内网环境：不蒜子会返回全站汇总的巨大数字，
  // 直接走 dash 占位，避免误导真实访问量。
  if (isLocalHost()) {
    busuanziState.uv = '—'
    busuanziState.pv = '—'
    settleMissingAsDash()
    return
  }

  if (!document.getElementById('busuanzi_value_site_uv')) {
    const uv = document.createElement('span')
    uv.id = 'busuanzi_value_site_uv'
    uv.style.cssText =
      'position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0)'
    document.body.appendChild(uv)
  }
  if (!document.getElementById('busuanzi_value_site_pv')) {
    const pv = document.createElement('span')
    pv.id = 'busuanzi_value_site_pv'
    pv.style.cssText =
      'position:absolute;width:0;height:0;overflow:hidden;clip:rect(0,0,0,0)'
    document.body.appendChild(pv)
  }

  if (!document.getElementById('busuanzi-js')) {
    const s = document.createElement('script')
    s.id = 'busuanzi-js'
    s.async = true
    s.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
    s.onload = () => startPolling()
    s.onerror = () => {
      busuanziState.loadFailed = true
      clearPoll()
      clearWaitMax()
      busuanziState.uv = '—'
      busuanziState.pv = '—'
      settleMissingAsDash()
    }
    document.head.appendChild(s)
  } else {
    startPolling()
  }
}
