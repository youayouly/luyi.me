/**
 * 访客地理位置：先信 Cloudflare，再信 Vercel。放 `lib/` 的原因见 lk-kv.js 顶部注释。
 *
 * ## 为什么不能直接用 x-vercel-ip-*
 *
 * 站点挂在 Cloudflare 后面，Vercel 看到的 TCP 对端是 **CF 边缘节点**，不是访客本人。
 * `x-vercel-ip-country` / `-country-region` / `-city` 都是按那个 IP 查出来的，于是：
 *
 * - 2026-09-10：站长人在新加坡，留言板上显示「来自 日本」（`country: JP, region: 13`），
 *   同一条请求的 `x-vercel-id` 却是 `sin1` —— 位置来自被地理库标成东京的 CF 节点。
 * - 2026-08-31：访客日志里 CF 节点被标成 `country: US`，region / city 全空。
 *
 * 这跟 `lk-ua.js#clientIp()` 当初取到 CF 边缘 IP 是同一个坑的另一半：那次修的是
 * 「谁来了」，这次修的是「从哪来」。
 *
 * ## 怎么修
 *
 * Cloudflare 是按 `cf-connecting-ip`（真实访客 IP）算的位置，结果放在 `cf-ipcountry`
 * 里，所以那个头在就以它为准。省 / 市要 Cloudflare 的 **Add visitor location headers**
 * 这条 Managed Transform（Rules → Settings → Managed Transforms，免费版也有，默认关）
 * 打开之后才有 `cf-region-code` / `cf-ipcity`。
 *
 * luyi.me 这个 zone 的实际状态（2026-09-10 在 dash 上逐项确认过）：
 * Network → IP Geolocation **开**（所以 `cf-ipcountry` 一直都有），
 * 上面那条 Managed Transform 本来是**关**的，当天为了让省级显示（placeNames.js 里
 * 那张 34 省的表）真正用得上才打开；同页另外 6 条托管转换保持关闭。
 * 要是哪天省 / 市又空了，先回那一页看这条是不是被关掉了。
 *
 * 两边国家不一致时，Vercel 那份省 / 市讲的是 CF 节点所在地，一并作废 —— 宁可只显示
 * 「新加坡」，也不要把东京安到访客头上。
 *
 * 没有 `cf-ipcountry`（本地开发、直连 Vercel、或者 zone 关了 IP Geolocation）就原样退回
 * Vercel 那份：直连时它本来就是准的，走 CF 而拿不到就只剩这一个来源，比整个空着强。
 */

/** Vercel 的 x-vercel-ip-* 是 URI 编码过的（城市名会有中文 / 空格），解不开就用原值。 */
function header(req, name) {
  const raw = req && req.headers ? req.headers[name] : ''
  if (!raw) return ''
  const s = Array.isArray(raw) ? raw[0] : raw
  try {
    return decodeURIComponent(String(s)).slice(0, 60)
  } catch {
    return String(s).slice(0, 60)
  }
}

/**
 * XX = Cloudflare 查不到，T1 = Tor 出口，A1/A2 = 匿名代理 / 卫星。
 * 这几个都不是地点，当作没拿到。
 */
const CF_NOT_A_PLACE = new Set(['XX', 'T1', 'A1', 'A2'])

function cfCountry(req) {
  const code = header(req, 'cf-ipcountry').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || CF_NOT_A_PLACE.has(code)) return ''
  return code
}

/**
 * 解析一次访问的地理位置。
 *
 * @param {import('http').IncomingMessage} req
 * @param {{ withCity?: boolean }} [opts] withCity 只有后台访客日志需要；留言板存到省为止。
 * @returns {{ country: string, region: string, city: string }}
 */
function resolvePlace(req, opts) {
  const withCity = Boolean(opts && opts.withCity)
  const vercel = {
    country: header(req, 'x-vercel-ip-country').trim().toUpperCase(),
    region: header(req, 'x-vercel-ip-country-region'),
    city: withCity ? header(req, 'x-vercel-ip-city') : '',
  }

  const cf = cfCountry(req)
  if (!cf) return vercel

  /* Managed Transform 开了才有，没有就空着，不拿 Vercel 的省份顶。 */
  const cfRegion = header(req, 'cf-region-code')
  const cfCity = withCity ? header(req, 'cf-ipcity') : ''

  if (vercel.country && vercel.country === cf) {
    /* 两边一致：CF 节点跟访客同国，Vercel 的省 / 市至少不会跨国跑偏，留着当补充。 */
    return { country: cf, region: cfRegion || vercel.region, city: cfCity || vercel.city }
  }

  /* 不一致 = Vercel 那份是按 CF 节点算的，省 / 市跟着一起丢掉。 */
  return { country: cf, region: cfRegion, city: cfCity }
}

module.exports = { resolvePlace, readGeoHeader: header }
