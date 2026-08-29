/**
 * 相对时间。这类字符串每分钟都在变，构建期词典永远收不到、localStorage 缓存也
 * 永远命中不了，只能靠运行时 API 兜底——那等于每次扫描都白发一次请求。
 * 所以这里直接按语言拼，节点再挂 data-lk-no-translate 让翻译层跳过。
 * 同款做法见 SiteFooter 的运行时长计数器。
 *
 * @param {string} iso
 * @param {boolean} [english]
 */
export function formatRelativeTime(iso, english = false) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Date.now() - t
  const sec = Math.floor(diff / 1000)
  // 阈值取 60 而不是 45：否则 45~59 秒会显示成「0 分钟前 / 0 min ago」
  if (sec < 60) return english ? 'just now' : '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return english ? `${min} min ago` : `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return english ? `${hr} hr ago` : `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return english ? `${day} d ago` : `${day} 天前`
  const mon = Math.floor(day / 30)
  if (mon < 12) return english ? `${mon} mo ago` : `${mon} 个月前`
  const year = Math.floor(mon / 12)
  return english ? `${year} yr ago` : `${year} 年前`
}

/** @deprecated 用 formatRelativeTime(iso, english)，中文站内旧调用保留 */
export function formatRelativeTimeZh(iso) {
  return formatRelativeTime(iso, false)
}
