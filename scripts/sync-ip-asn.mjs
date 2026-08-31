#!/usr/bin/env node
/**
 * 拉 MaxMind GeoLite2-ASN（IPv4）CSV，转成一份按起始地址排好序的紧凑数组，
 * 写到 `lib/lk-ip-asn.generated.json`，给 `lib/lk-ip-intel.js` 在 Serverless
 * Function 里做纯本地二分查找用——不装 mmdb 解析库，也不在 /api/visit 里
 * 现查第三方接口（延迟 + 把访客 IP 发给第三方，两条都不想要）。
 *
 * 跟 sync-starred.mjs / sync-external-projects.mjs 同一个模式：构建期/手动
 * 拉一次远端数据，落成 *.generated.json，运行时零网络请求。
 *
 * 用法：
 *   npm run sync:ip-asn   # 需要 MAXMIND_LICENSE_KEY（.env.local 或环境变量）
 *
 * 免费申请 license key：https://www.maxmind.com/en/geolite2/signup
 * （账号本身也是免费的，MaxMind 只要求注册用途说明，几分钟能批下来。）
 *
 * 只处理 IPv4——这个博客体量下这次要抓的是「云主机段打首页」这类流量，
 * IPv4 已经覆盖了目测到的全部案例；IPv6 段数量更大、收益不成比例，先不做。
 *
 * ⚠️ 生成的文件会被整体覆盖，不要手改。ASN 网段会变，建议每隔几个月重新跑一次。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outFile = path.join(repoRoot, 'lib', 'lk-ip-asn.generated.json')

function loadLocalEnv() {
  const envLocal = path.join(repoRoot, '.env.local')
  if (!fs.existsSync(envLocal)) return
  for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadLocalEnv()

const KEY = process.env.MAXMIND_LICENSE_KEY
if (!KEY) {
  console.log('[ip-asn] 没有配置 MAXMIND_LICENSE_KEY，跳过——去 https://www.maxmind.com/en/geolite2/signup 免费申请一个，写进 .env.local')
  process.exit(0)
}

const DOWNLOAD_URL = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN-CSV&license_key=${KEY}&suffix=zip`

/** "1.2.3.0/24" -> [start, end]（含端点），纯数字，IPv4 最大值 4294967295 在 Number 安全范围内。 */
function cidrToRange(cidr) {
  const [ip, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null
  const base = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
  const size = 2 ** (32 - bits)
  return [base >>> 0, (base + size - 1) >>> 0]
}

/*
 * 667k 个网段里 (asn, org) 只有 ~78k 种不同组合——同一个 ASN 通常拆成好几个
 * CIDR 段，组织名重复率超过 8 倍。把 org 字符串抽成独立表、网段里只存下标，
 * 生成的文件从 ~38MB 降到几 MB，Serverless Function 冷启动时 require() 这份
 * JSON 的解析开销也跟着降下来。
 */
function parseCsv(text) {
  const lines = text.split('\n')
  const header = lines[0].split(',')
  const iNet = header.indexOf('network')
  const iAsn = header.indexOf('autonomous_system_number')
  const iOrg = header.indexOf('autonomous_system_organization')

  const asnKey = new Map() // "asn|org" -> index into asns[]
  const asns = []
  const ranges = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // MaxMind 的这份 CSV 组织名不带逗号/引号，直接 split 够用，不用上正经 CSV 解析。
    const cols = line.split(',')
    const range = cidrToRange(cols[iNet])
    if (!range) continue
    const asn = Number(cols[iAsn])
    const org = (cols[iOrg] || '').trim()

    const key = `${asn}|${org}`
    let idx = asnKey.get(key)
    if (idx === undefined) {
      idx = asns.length
      asns.push([asn, org])
      asnKey.set(key, idx)
    }
    ranges.push([range[0], range[1], idx])
  }
  return { asns, ranges }
}

async function main() {
  console.log('[ip-asn] 下载 GeoLite2-ASN-CSV…')
  const res = await fetch(DOWNLOAD_URL)
  if (!res.ok) {
    console.error(`[ip-asn] 下载失败：HTTP ${res.status}`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())

  const zip = new AdmZip(buf)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith('GeoLite2-ASN-Blocks-IPv4.csv'))
  if (!entry) {
    console.error('[ip-asn] 压缩包里没找到 GeoLite2-ASN-Blocks-IPv4.csv')
    process.exit(1)
  }

  const { asns, ranges } = parseCsv(entry.getData().toString('utf8'))
  ranges.sort((a, b) => a[0] - b[0])

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(
    outFile,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: ranges.length, asns, ranges }),
  )
  const mb = (fs.statSync(outFile).size / 1048576).toFixed(1)
  console.log(`[ip-asn] 写入 ${ranges.length} 条网段 / ${asns.length} 个 ASN，${mb} MB -> ${path.relative(repoRoot, outFile)}`)
}

main().catch((err) => {
  console.error('[ip-asn]', err)
  process.exit(1)
})
