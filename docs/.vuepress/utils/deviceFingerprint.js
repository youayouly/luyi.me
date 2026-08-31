/**
 * 只用来回答一个问题：「这台设备是不是我自己的」——不是给每个访客建档案的
 * 通用指纹库。canvas/WebGL 渲染细节因硬件+驱动+字体渲染管线而异，比 UA
 * 稳定得多：UA 里的系统版本号每次升级就变（iPhone 尤其明显，见
 * lib/lk-visit-classify.js 的注释），但 canvas/WebGL 指纹通常能扛过好几次
 * 系统小版本升级不变。
 *
 * 数据去向：这个哈希会跟着每次访问一起发到 `/api/visit`。服务端只在两处用它
 * （见 `docs/api/visit.js` / `lib/lk-visit-classify.js`）：(1) 站长登录状态下
 * 访问时，把这次的哈希记进 `lk:owner`；(2) 判定一条陌生访问是不是站长时，拿
 * 它跟 `lk:owner` 里登记过的哈希比对。**陌生访客的哈希不会被拿去建立可跨会话
 * 追踪的档案**——`lk:visitors`（访客个体画像）、`sessionKey()`（会话归并）都
 * 不用这个字段，命中不了 owner 的哈希就跟没算过一样，只留在 800 条滚动明细
 * 里、跟 UA/设备信息一个待遇，不会被单独聚合。
 */

let cachedPromise = null
let cachedValue = ''

function canvasSignal() {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 220
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(0, 0, 100, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('lk-fp 指纹 😀 0123', 2, 12)
    ctx.strokeStyle = 'rgba(120, 20, 200, 0.6)'
    ctx.beginPath()
    ctx.arc(150, 20, 15, 0, Math.PI * 2)
    ctx.stroke()
    return canvas.toDataURL()
  } catch {
    return ''
  }
}

function webglSignal() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return ''
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (!dbg) return ''
    const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
    const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
    return `${vendor}|${renderer}`
  } catch {
    return ''
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function compute() {
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) return ''
    const parts = [
      canvasSignal(),
      webglSignal(),
      String(window.screen?.colorDepth || ''),
      String(navigator.hardwareConcurrency || ''),
    ]
    const raw = parts.join('||')
    // 两个信号都拿不到（比如隐私模式 canvas 读不出真实像素）就别硬凑一个哈希，
    // 那样反而会把一堆完全不同的设备撞成同一个空值。
    if (!parts[0] && !parts[1]) return ''
    return (await sha256Hex(raw)).slice(0, 32)
  } catch {
    return ''
  }
}

/*
 * 同步读取，绝不 await——上报走 sendBeacon，必须在触发它的那个事件回调里
 * 原样同步调用，不能被任何异步操作（哪怕只是几毫秒的 canvas/WebGL/哈希计算）
 * 插在中间。之前 reportVisit 里 `await` 过这个值，实测在 Safari 上一旦不是
 * 首次整页加载（而是 SPA 内部路由跳转），beacon 经常直接发不出去——具体是
 * WebKit 哪一层的限制没深挖，但「同步调用」本来就是 sendBeacon 唯一被保证
 * 可靠的用法，没理由为了指纹字段去冒这个险。
 *
 * 所以这里只负责在后台把计算跑起来、缓存结果；第一次调用时大概率还没算完，
 * 拿到的是空字符串，那次上报就没有指纹——一次会话里后续的每次导航都会命中
 * 缓存，绝大多数访问仍然带得上。
 */
export function getDeviceFingerprint() {
  if (!cachedPromise) {
    cachedPromise = compute().then((v) => {
      cachedValue = v
      return v
    })
  }
  return cachedValue
}
