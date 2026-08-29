/**
 * 访客 IP / 地理位置（可接自建 API）
 *
 * 默认使用 ipwho.is（免密钥 HTTPS）。生产环境建议改为自建后端代理，避免第三方限流。
 *
 * 自定义地理接口：在部署前设置全局变量（例如在 client.js 最顶部）：
 *   window.__LK_VISITOR_GEO_URL__ = 'https://your-api.com/geo'
 * 约定响应 JSON：{ country, region, city, ip?, latitude?, longitude? }（字段可选）
 */

const OWNER_LAT = 22.3193
const OWNER_LNG = 114.1694

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function timeTipByHour(h) {
  if (h >= 0 && h < 5) return '夜深了，早点休息，尽量少熬夜。'
  if (h >= 5 && h < 9) return '早上好，新的一天加油。'
  if (h >= 9 && h < 12) return '上午好，阅读愉快。'
  if (h >= 12 && h < 14) return '中午好，记得按时吃饭。'
  if (h >= 14 && h < 18) return '下午好，喝杯茶歇一歇。'
  if (h >= 18 && h < 22) return '晚上好，欢迎常来坐坐。'
  return '夜深了，早点休息，尽量少熬夜。'
}

/**
 * @returns {Promise<{ ip: string, placeLine: string, distanceKm: number | null, tip: string }>}
 */
export async function fetchVisitorSnapshot() {
  const now = new Date()
  const tip = timeTipByHour(now.getHours())

  const customUrl =
    typeof window !== 'undefined' && window.__LK_VISITOR_GEO_URL__
      ? String(window.__LK_VISITOR_GEO_URL__).trim()
      : ''

  let ip = '—'
  let country = ''
  let region = ''
  let city = ''
  let lat = null
  let lon = null

  try {
    if (customUrl) {
      const r = await fetch(customUrl, { credentials: 'omit' })
      if (r.ok) {
        const j = await r.json()
        ip = j.ip || j.query || ip
        country = j.country || j.country_name || ''
        region = j.region || j.regionName || j.region_name || ''
        city = j.city || ''
        lat = typeof j.latitude === 'number' ? j.latitude : j.lat ?? null
        lon = typeof j.longitude === 'number' ? j.longitude : j.lon ?? null
      }
    } else {
      const r = await fetch('https://ipwho.is/', { credentials: 'omit' })
      if (r.ok) {
        const j = await r.json()
        if (j.success !== false) {
          ip = j.ip || ip
          country = j.country || ''
          region = j.region || ''
          city = j.city || ''
          lat = typeof j.latitude === 'number' ? j.latitude : null
          lon = typeof j.longitude === 'number' ? j.longitude : null
        }
      }
    }
  } catch {
    /* 网络失败时保持占位 */
  }

  const parts = [country, region, city].filter(Boolean)
  const placeLine =
    parts.length > 0 ? `来自 ${parts.join(' ')} 的朋友` : '来自 未知地区 的朋友'

  let distanceKm = null
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon))
    distanceKm = haversineKm(lat, lon, OWNER_LAT, OWNER_LNG)

  return { ip, placeLine, distanceKm, tip }
}
