/**
 * API 凭据存储工具
 *
 * 与 authGate.js 分离，专用于发布 API 的用户名/密码存储。
 * 登录成功后由 LoginGate.vue 写入，PublishFab.vue 读取。
 *
 * 安全说明：账号密码存储在 sessionStorage 中，存在 XSS 风险。
 * 个人站点可接受此风险；真正的权限控制在服务端环境变量。
 */

export const CREDS_USER_KEY = 'lk_api_user'
export const CREDS_PASS_KEY = 'lk_api_pass'

/**
 * 读取 API 凭据
 * @returns {{ user: string, pass: string }}
 */
export function readSiteApiCreds() {
  if (typeof sessionStorage === 'undefined') {
    return { user: '', pass: '' }
  }
  try {
    const user = sessionStorage.getItem(CREDS_USER_KEY) || ''
    const pass = sessionStorage.getItem(CREDS_PASS_KEY) || ''
    return { user, pass }
  } catch {
    return { user: '', pass: '' }
  }
}

/**
 * 写入 API 凭据（登录成功后调用）
 * @param {string} user
 * @param {string} pass
 */
export function writeSiteApiCreds(user, pass) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CREDS_USER_KEY, user || '')
    sessionStorage.setItem(CREDS_PASS_KEY, pass || '')
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * 清除 API 凭据（退出登录时调用）
 */
export function clearSiteApiCreds() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(CREDS_USER_KEY)
    sessionStorage.removeItem(CREDS_PASS_KEY)
  } catch {
    /* ignore */
  }
}
