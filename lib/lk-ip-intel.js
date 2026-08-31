/**
 * IP -> ASN/组织名 的纯本地查询，数据来自 `lib/lk-ip-asn.generated.json`
 * （`scripts/sync-ip-asn.mjs` 生成，见该文件头注释）。
 *
 * 放 `lib/` 的原因见 lk-kv.js 顶部注释。之所以是「本地查表」而不是调第三方
 * IP 情报 API：运行时零延迟、零外部请求，也不用把访客 IP 发给第三方——跟
 * 这个项目一贯的隐私取向一致。代价是数据只在跑 `npm run sync:ip-asn` 那一刻
 * 是新的，ASN 网段变动不会实时反映，隔几个月重新生成一次就够。
 *
 * 没配 `MAXMIND_LICENSE_KEY` 时 generated.json 不存在，这里必须整体降级成
 * 「查不到」而不是抛错——跟其它可选集成（DIFY_API_KEY、RESEND_API_KEY…）
 * 一个套路：没配就跳过对应功能，不能让别的路径也跟着炸。
 */

let ranges = [] // 排好序的 [start, end, asnIndex] 数组
let asns = [] // [asn, org][]，ranges 里的下标指进来——见 sync-ip-asn.mjs 头注释里的去重说明
try {
  // eslint-disable-next-line global-require
  const data = require('./lk-ip-asn.generated.json')
  ranges = Array.isArray(data.ranges) ? data.ranges : []
  asns = Array.isArray(data.asns) ? data.asns : []
} catch {
  // 没跑过 npm run sync:ip-asn（或没配 MAXMIND_LICENSE_KEY）：文件不存在，
  // 降级成「查不到」，不是错误——跟其它可选集成同一个态度。
}

function ipToInt(ip) {
  const parts = String(ip || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/** 二分查找命中区间的下标；查不到返回 -1。 */
function findRangeIndex(target) {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [start, end] = ranges[mid]
    if (target < start) hi = mid - 1
    else if (target > end) lo = mid + 1
    else return mid
  }
  return -1
}

/** @returns {{asn: number, org: string} | null} */
function lookupAsn(ip) {
  if (!ranges.length) return null
  const target = ipToInt(ip)
  if (target == null) return null
  const idx = findRangeIndex(target)
  if (idx === -1) return null
  const [, , asnIndex] = ranges[idx]
  const entry = asns[asnIndex]
  if (!entry) return null
  const [asn, org] = entry
  return { asn, org }
}

/*
 * 知名云/主机托管厂商关键字。命中即认为这段 IP 大概率不是家庭/移动宽带，
 * 而是脚本/爬虫常驻的云主机——这次排查里手动认出来的 AWS/GCP/DigitalOcean
 * 就是这里要覆盖的典型案例。故意只覆盖常见的，认不出就不猜（跟 lk-ua.js
 * 的厂商识别同一个态度）。
 */
const CLOUD_ORG_RE =
  /AMAZON|AWS|GOOGLE|MICROSOFT|AZURE|DIGITALOCEAN|DIGITAL OCEAN|OVH|HETZNER|LINODE|AKAMAI|ORACLE|ALIBABA|ALIYUN|TENCENT|VULTR|CLOUDFLARE|FASTLY|SCALEWAY|CONTABO|LEASEWEB|CHOOPA/i

function isCloudOrg(org) {
  return Boolean(org) && CLOUD_ORG_RE.test(org)
}

module.exports = { lookupAsn, isCloudOrg }
