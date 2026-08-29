/**
 * 发信。目前只有一个用途：留言被回复时提醒对方。
 *
 * 用 Resend 的 REST API，不装 SDK——理由和 lk-kv.js 一样，`api/` 保持零依赖。
 *
 * **没配 RESEND_API_KEY 时静默跳过，不报错。** 留言本身必须能存下去：
 * 发信失败绝不能让访客看到「留言失败」。所有调用点都只看返回值、不 catch，
 * 因为这里从不抛。
 *
 * 需要的环境变量：
 * - `RESEND_API_KEY`  Resend 的 API Key
 * - `LK_MAIL_FROM`    发件人，形如 `Luke <noreply@luyi.me>`，域名要在 Resend 验证过
 */

const ENDPOINT = 'https://api.resend.com/emails'

function mailReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LK_MAIL_FROM)
}

/**
 * @param {{to: string, subject: string, html: string, text?: string}} message
 * @returns {Promise<{sent: boolean, id?: string, skipped?: string, error?: string}>}
 *   成功时带上 Resend 的邮件 id：排查「到底发没发出去」时可以直接
 *   `GET https://api.resend.com/emails/<id>` 查投递状态。
 */
async function sendMail(message) {
  if (!mailReady()) return { sent: false, skipped: 'no-mail-config' }
  if (!message || !message.to) return { sent: false, skipped: 'no-recipient' }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.LK_MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text || undefined,
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { sent: false, error: `${res.status} ${detail.slice(0, 120)}` }
    }
    const data = await res.json().catch(() => ({}))
    return { sent: true, id: data && data.id ? String(data.id) : '' }
  } catch (err) {
    return { sent: false, error: String((err && err.message) || err).slice(0, 120) }
  }
}

module.exports = { mailReady, sendMail }
