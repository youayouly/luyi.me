/**
 * 地区代码 → 人话，中英两份。
 *
 * 留言板上的「来自 广东」就是查这张表。数据来自 Vercel 边缘注入的
 * `x-vercel-ip-country`（ISO 3166-1 alpha-2）和 `x-vercel-ip-country-region`
 * （ISO 3166-2 的省级代码，不带国家前缀）。
 *
 * 为什么带英文：地区是**运行时**数据，永远进不了构建期词典（`pretranslate.mjs`
 * 只扫构建产物里的中文），交给运行时翻译接口既慢又会把「广东」翻成奇怪的东西。
 * 所以照 SiteFooter / VisitedChinaFootprints 的老办法，自带中英两份跟着 pageLang 走。
 *
 * 表不求全：查不到就退回代码本身（`来自 XX`），不会显示空白，也不会报错。
 * 只到省 / 国家这一级 —— 城市和 IP 不外露，那是后台才看得到的东西。
 */

/** 中国大陆 34 个省级行政区 + 港澳台。 */
export const CN_REGIONS = {
  BJ: { zh: '北京', en: 'Beijing' },
  TJ: { zh: '天津', en: 'Tianjin' },
  HE: { zh: '河北', en: 'Hebei' },
  SX: { zh: '山西', en: 'Shanxi' },
  NM: { zh: '内蒙古', en: 'Inner Mongolia' },
  LN: { zh: '辽宁', en: 'Liaoning' },
  JL: { zh: '吉林', en: 'Jilin' },
  HL: { zh: '黑龙江', en: 'Heilongjiang' },
  SH: { zh: '上海', en: 'Shanghai' },
  JS: { zh: '江苏', en: 'Jiangsu' },
  ZJ: { zh: '浙江', en: 'Zhejiang' },
  AH: { zh: '安徽', en: 'Anhui' },
  FJ: { zh: '福建', en: 'Fujian' },
  JX: { zh: '江西', en: 'Jiangxi' },
  SD: { zh: '山东', en: 'Shandong' },
  HA: { zh: '河南', en: 'Henan' },
  HB: { zh: '湖北', en: 'Hubei' },
  HN: { zh: '湖南', en: 'Hunan' },
  GD: { zh: '广东', en: 'Guangdong' },
  GX: { zh: '广西', en: 'Guangxi' },
  HI: { zh: '海南', en: 'Hainan' },
  CQ: { zh: '重庆', en: 'Chongqing' },
  SC: { zh: '四川', en: 'Sichuan' },
  GZ: { zh: '贵州', en: 'Guizhou' },
  YN: { zh: '云南', en: 'Yunnan' },
  XZ: { zh: '西藏', en: 'Tibet' },
  SN: { zh: '陕西', en: 'Shaanxi' },
  GS: { zh: '甘肃', en: 'Gansu' },
  QH: { zh: '青海', en: 'Qinghai' },
  NX: { zh: '宁夏', en: 'Ningxia' },
  XJ: { zh: '新疆', en: 'Xinjiang' },
  HK: { zh: '香港', en: 'Hong Kong' },
  MO: { zh: '澳门', en: 'Macao' },
  TW: { zh: '台湾', en: 'Taiwan' },
}

/** 常见来源国家 / 地区。查不到就显示代码本身。 */
export const COUNTRIES = {
  CN: { zh: '中国', en: 'China' },
  HK: { zh: '中国香港', en: 'Hong Kong' },
  MO: { zh: '中国澳门', en: 'Macao' },
  TW: { zh: '中国台湾', en: 'Taiwan' },
  SG: { zh: '新加坡', en: 'Singapore' },
  JP: { zh: '日本', en: 'Japan' },
  KR: { zh: '韩国', en: 'South Korea' },
  US: { zh: '美国', en: 'United States' },
  CA: { zh: '加拿大', en: 'Canada' },
  GB: { zh: '英国', en: 'United Kingdom' },
  IE: { zh: '爱尔兰', en: 'Ireland' },
  DE: { zh: '德国', en: 'Germany' },
  FR: { zh: '法国', en: 'France' },
  NL: { zh: '荷兰', en: 'Netherlands' },
  CH: { zh: '瑞士', en: 'Switzerland' },
  SE: { zh: '瑞典', en: 'Sweden' },
  RU: { zh: '俄罗斯', en: 'Russia' },
  AU: { zh: '澳大利亚', en: 'Australia' },
  NZ: { zh: '新西兰', en: 'New Zealand' },
  MY: { zh: '马来西亚', en: 'Malaysia' },
  TH: { zh: '泰国', en: 'Thailand' },
  VN: { zh: '越南', en: 'Vietnam' },
  ID: { zh: '印尼', en: 'Indonesia' },
  PH: { zh: '菲律宾', en: 'Philippines' },
  IN: { zh: '印度', en: 'India' },
  BR: { zh: '巴西', en: 'Brazil' },
}

/**
 * 拼出「广东」「新加坡」这样的一小段。
 * 中国大陆优先显示省份（「来自 中国 广东」太啰嗦）；其余显示国家。
 *
 * @param {{country?: string, region?: string}} place
 * @param {'zh'|'en'} lang
 * @returns {string} 查不到就回代码本身，全空则回空串（调用方据此不渲染标签）
 */
export function formatPlace(place, lang = 'zh') {
  const country = String(place?.country || '').toUpperCase()
  const region = String(place?.region || '').toUpperCase()

  if (country === 'CN' && CN_REGIONS[region]) return CN_REGIONS[region][lang]
  if (COUNTRIES[country]) return COUNTRIES[country][lang]
  /* 港澳台的 country 本身就是 HK/MO/TW，上面那行已经覆盖 */
  return country || ''
}
