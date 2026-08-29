/**
 * Upstash Redis (REST) 的最小封装。
 *
 * 为什么放在 `lib/` 而不是 `docs/api/`：
 * `scripts/copy-api.mjs` 会把 `docs/api/*.js` 整个拍到根目录 `api/`，而 `api/` 下的
 * 每个文件都会被 Vercel 当成一个 Serverless Function。共享代码放进去会变成一个
 * 没有 handler 的「函数」。放在 `api/` 外面，靠相对 require 引入，@vercel/nft 会
 * 自动把它打进依赖里。
 *
 * 用 fetch 直连 REST API，不装 `@upstash/redis`：本仓库的 api/ 全是零依赖 CommonJS，
 * 加一个 ESM 包会把这套约定破坏掉，而我们只用到 LPUSH/LTRIM/INCR/SADD 这几个命令。
 */

/** Vercel 的 Upstash 集成会注入 KV_* 或 UPSTASH_* 两套之一，都认。 */
function kvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  return { url: url.replace(/\/+$/, ''), token }
}

/** 没配环境变量时所有调用都要安静地降级，而不是让页面 500。 */
function kvReady() {
  const { url, token } = kvConfig()
  return Boolean(url && token)
}

async function kvFetch(pathname, body) {
  const { url, token } = kvConfig()
  if (!url || !token) throw new Error('KV is not configured')

  const res = await fetch(`${url}${pathname}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`KV ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * 单条命令：kvCmd('LPUSH', 'key', 'value') -> result
 */
async function kvCmd(...args) {
  const out = await kvFetch('/', args.map(String))
  if (out && out.error) throw new Error(String(out.error))
  return out ? out.result : null
}

/**
 * 批量命令：kvPipeline([['INCR','pv'], ['LPUSH','log','x']]) -> [result, result]
 * 一次往返做完多个写入，访客上报这种高频路径必须走这个。
 */
async function kvPipeline(commands) {
  if (!commands.length) return []
  const out = await kvFetch(
    '/pipeline',
    commands.map((cmd) => cmd.map(String)),
  )
  if (!Array.isArray(out)) throw new Error('Unexpected pipeline response')
  return out.map((item) => {
    if (item && item.error) throw new Error(String(item.error))
    return item ? item.result : null
  })
}

module.exports = { kvReady, kvCmd, kvPipeline }
