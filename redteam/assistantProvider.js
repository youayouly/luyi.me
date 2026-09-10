/**
 * promptfoo 自定义 provider：把每条测试用例发给 `/api/assistant`，取回 `data.reply`。
 *
 * 为什么不用 promptfoo 内置的 http provider，而要自己写一个：这个端点有三处“怪癖”，
 * 内置 provider 配起来很别扭，写成 provider 一处解决——
 *
 *  1. 请求体不是 `{prompt}`，是 `{ message, history, lang }`；
 *  2. **同源闸**（isSameSite）：必须带一个 host 跟目标一致的 `Origin`，否则 403；
 *  3. **每 IP 限速** 12 次/10 分钟：本地 dev 没有 Cloudflare，`clientIp()` 退到
 *     `x-forwarded-for`，所以每条用例换一个假 IP 就能一口气跑完整套而不撞 429。
 *     对**线上无效也无害**：线上 `clientIp()` 优先读 CF 写入的 `cf-connecting-ip`，
 *     客户端伪造不了——打 www.luyi.me 时这个开关绕不了限速，请配 --delay 小批量跑。
 *
 * 目标地址由 `PROMPTFOO_ASSISTANT_BASE` 决定，默认本地 dev：
 *     PROMPTFOO_ASSISTANT_BASE=http://localhost:8080   （默认）
 *     PROMPTFOO_ASSISTANT_BASE=https://www.luyi.me      （打线上，会花真额度，小批量）
 *
 * 用例的 message / history / lang 从 `context.vars` 读——这样攻击载荷不经过 nunjucks 渲染，
 * 载荷里就算带模板记号也不会被 promptfoo 提前吃掉（prompt 模板设成常量，见 config）。
 */

const BASE = (process.env.PROMPTFOO_ASSISTANT_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const HOST = (() => {
  try { return new URL(BASE).host } catch { return 'localhost:8080' }
})()

// 普通 Chrome UA：避开端点的爬虫闸（parseUa 的 bot 正则不会命中它）。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function spoofIp() {
  const o = () => 1 + Math.floor(Math.random() * 253)
  return `${o()}.${o()}.${o()}.${o()}`
}

class AssistantProvider {
  id() {
    return `lk-assistant:${HOST}`
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const message = vars.message != null ? String(vars.message) : String(prompt || '')
    const history = Array.isArray(vars.history) ? vars.history : []
    const body = { message, history }
    // 端点现在按消息本身自动判语言；只有个别用例想强制某一侧 prompt 时才带 lang。
    if (vars.lang === 'zh' || vars.lang === 'en') body.lang = vars.lang

    let res
    try {
      res = await fetch(`${BASE}/api/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE, // 过同源闸
          Referer: `${BASE}/guestbook`,
          'User-Agent': UA,
          'x-forwarded-for': spoofIp(), // 本地绕限速；线上无效
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      return { error: `请求发不出去（dev 起了吗？BASE=${BASE}）：${err.message}` }
    }

    let data = {}
    try {
      data = await res.json()
    } catch {
      return { error: `HTTP ${res.status}：响应不是 JSON` }
    }

    if (!res.ok || !data.ok) {
      return { error: `HTTP ${res.status}：${data.error || '无 reply'}` }
    }
    return { output: String(data.reply || ''), metadata: { model: data.model } }
  }
}

module.exports = AssistantProvider
