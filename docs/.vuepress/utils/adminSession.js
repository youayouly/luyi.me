/**
 * 后台会话（服务端校验版）。
 *
 * 密码不再进 bundle：登录把账号密码 POST 给 `/api/login`，服务端比对
 * LK_SITE_USER / LK_SITE_PASS，通过后下发 HttpOnly cookie。前端拿不到 token，
 * 也不需要拿——同源请求会自动带上。
 *
 * `lk_private_ok`（sessionStorage）退化成一个**乐观 UI 标记**：让刷新后
 * 后台入口不闪，真正的判定以 `GET /api/login` 为准，校验失败会立刻清掉。
 */

const LOGIN_ENDPOINT = '/api/login'
const HINT_COOKIE = 'lk_admin_hint'

/**
 * 有没有必要去问服务端。`lk_admin` 是 HttpOnly、JS 读不到，所以服务端另外下发了
 * 一个不含机密的 `lk_admin_hint`。没有它就一定没有会话，直接省掉一次 Serverless
 * 调用——LoginGate 每个页面都挂载，不省的话每个匿名访客都要白打一次。
 */
export function hasSessionHint() {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some((part) => {
    const [name, value] = part.split('=')
    return name.trim() === HINT_COOKIE && (value || '').trim() === '1'
  })
}

/**
 * 服务端说「这台设备没有会话」时要顺手把 hint 抹掉。
 *
 * hint 现在同时是 `readAuthed()` 的乐观标记（见 authGate.js），留着的话下次进页面
 * 又会先把后台入口画出来、再被校验打回去 —— 就成了反方向的闪。
 * 正常登出由服务端 `Set-Cookie` 清；这条是给「被顶下线 / 会话过期」那两种情况兜底。
 */
export function clearSessionHint() {
  if (typeof document === 'undefined') return
  document.cookie = `${HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

/**
 * @returns {Promise<{ authed: boolean, session: object|null, logins: object[], unavailable?: boolean }>}
 */
export async function fetchAdminSession() {
  try {
    const res = await fetch(LOGIN_ENDPOINT, { credentials: 'same-origin' })
    if (res.status === 503) return { authed: false, session: null, logins: [], unavailable: true }
    const data = await res.json().catch(() => ({}))
    return {
      authed: Boolean(data.authed),
      session: data.session || null,
      logins: Array.isArray(data.logins) ? data.logins : [],
    }
  } catch {
    // 网络抖动不该把人踢下线，交给调用方决定（我们的做法是保持现状）。
    return { authed: false, session: null, logins: [], unavailable: true }
  }
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, replaced?: object|null, unavailable?: boolean }>}
 */
export async function loginAdmin(username, password) {
  let res
  try {
    res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'login', username, password }),
    })
  } catch {
    return { ok: false, error: '网络错误，请稍后重试。' }
  }

  const data = await res.json().catch(() => ({}))
  /*
   * 这两条不是「密码错了」，而是「服务端没配好」。分开报，否则站长会一直
   * 以为自己记错密码——线上曾经就是 LK_SITE_USER/LK_SITE_PASS 根本没设。
   */
  if (res.status === 503 || data.needsKv) {
    return {
      ok: false,
      unavailable: true,
      error: '会话存储未配置：Vercel 上缺 KV_REST_API_URL / KV_REST_API_TOKEN。',
    }
  }
  if (res.status === 500) {
    return {
      ok: false,
      unavailable: true,
      /* 服务端给了具体原因就照实显示，否则大概率是环境变量没配。 */
      error: data.error
        ? `服务端出错：${data.error}`
        : '服务端未配置：Vercel 上缺 LK_SITE_USER / LK_SITE_PASS 环境变量。',
    }
  }
  if (res.status === 404) {
    return { ok: false, unavailable: true, error: '/api/login 未部署（记得提交根目录 api/）。' }
  }
  if (res.status === 429) {
    return { ok: false, throttled: true, error: data.error || '失败次数过多，请稍后再试。' }
  }
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'Username or password is incorrect.' }
  }
  return {
    ok: true,
    session: data.session || null,
    replaced: data.replaced || null,
    logins: Array.isArray(data.logins) ? data.logins : [],
  }
}

export async function logoutAdmin() {
  try {
    await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    })
  } catch {
    /* 本地标记照样清掉 */
  }
}
