/**
 * 留言板的访客身份：昵称、联系方式、头像。
 *
 * 这里**没有登录**。参考站（Typecho + Handsome 那套）也一样：填什么就信什么，
 * 头像是按填的东西猜出来的——
 *
 * - 一串数字 → 当成 QQ 号，取 `q1.qlogo.cn` 的 QQ 头像
 * - 像邮箱 → 取 Cravatar（Gravatar 的国内镜像，协议完全兼容，墙内不会卡）
 * - 都不像 → 不给头像 URL，前端用昵称首字渲染一个色块
 *
 * 所以身份是**自称**的，任何人都能填别人的昵称。这不是疏漏，是这类留言板的
 * 常态；真正的防线是限速、长度上限和站长能删。唯一要保证的是：自称站长的人
 * 不能拿到站长的样式——`owner` 标记只由服务端在 verifyAdmin 通过后写入。
 *
 * ## 邮箱怎么存
 *
 * 头像只需要 md5，所以默认**只存 md5**，不存明文。
 * 只有访客勾了「回复邮件提醒」时才额外存一份明文——不存就没法发信。
 * 明文那份任何接口都不往外吐，后台列表里也只显示 `u***@qq.com`。
 */

const crypto = require('crypto')

/** QQ 号：5~11 位，不以 0 开头。 */
const QQ_RE = /^[1-9][0-9]{4,10}$/
/** 邮箱只做粗校验：真要验证得发信，这里只是决定"要不要当邮箱看待"。 */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,64}\.[a-z]{2,18}$/i

const NICK_MAX = 24
const CONTACT_MAX = 64

/** 控制字符 + 零宽字符：昵称里最容易被用来刷版和伪装的两类。 */
const INVISIBLE_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f\u2060\ufeff]/g

function cleanNick(raw) {
  return String(raw || '')
    .replace(INVISIBLE_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICK_MAX)
}

function md5(input) {
  return crypto.createHash('md5').update(String(input)).digest('hex')
}

/**
 * 把访客填的「邮箱 / QQ 号」解析成身份信息。
 * @param {string} raw
 * @returns {{kind: 'qq'|'email'|'none', qq: string, email: string, emailHash: string, avatar: string}}
 */
function parseContact(raw) {
  const value = String(raw || '')
    .replace(INVISIBLE_RE, '')
    .trim()
    .slice(0, CONTACT_MAX)

  if (QQ_RE.test(value)) {
    return {
      kind: 'qq',
      qq: value,
      email: `${value}@qq.com`,
      emailHash: md5(`${value}@qq.com`),
      avatar: `https://q1.qlogo.cn/g?b=qq&nk=${value}&s=100`,
    }
  }

  if (EMAIL_RE.test(value)) {
    const email = value.toLowerCase()
    const hash = md5(email)
    /* QQ 邮箱直接走 QQ 头像，比 Gravatar 命中率高得多。 */
    const qqMail = email.match(/^([1-9][0-9]{4,10})@qq\.com$/)
    return {
      kind: 'email',
      qq: qqMail ? qqMail[1] : '',
      email,
      emailHash: hash,
      avatar: qqMail
        ? `https://q1.qlogo.cn/g?b=qq&nk=${qqMail[1]}&s=100`
        : `https://cravatar.cn/avatar/${hash}?s=100&d=retro`,
    }
  }

  return { kind: 'none', qq: '', email: '', emailHash: '', avatar: '' }
}

/** 后台列表用：`abc***@qq.com`，够认人又不至于把地址整个亮出来。 */
function maskEmail(email) {
  const value = String(email || '')
  const at = value.indexOf('@')
  if (at <= 0) return ''
  const name = value.slice(0, at)
  const domain = value.slice(at)
  const head = name.slice(0, Math.min(3, name.length))
  return `${head}***${domain}`
}

/** 留言 id：时间戳 + 随机，按字典序也是时间序，方便排查。 */
function newId() {
  return `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`
}

module.exports = {
  CONTACT_MAX,
  NICK_MAX,
  cleanNick,
  maskEmail,
  md5,
  newId,
  parseContact,
}
