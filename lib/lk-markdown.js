/**
 * 留言用的极简 Markdown 渲染器。
 *
 * 为什么不装 marked / markdown-it + DOMPurify：`api/` 全是零依赖 CommonJS
 * （理由见 lk-kv.js 的文件头），而留言只需要粗体、斜体、行内代码、代码块、
 * 引用、链接和换行这么几样。功能少一点，攻击面就小一整圈。
 *
 * ## 顺序是安全的关键
 *
 * **先把整段文本 HTML 转义，再往里面加标签**。这样访客写的 `<script>` 在任何
 * 规则跑之前就已经是 `&lt;script&gt;`，后面的正则只可能产出我们自己白名单里的
 * 那几个标签——不存在「漏过滤」的可能，因为根本没有「过滤」这一步。反过来
 * （先解析 Markdown 再清洗 HTML）才是需要 DOMPurify 的那条路。
 *
 * 链接只放行 http/https：`javascript:` / `data:` 一律降级成纯文本，并统一加
 * `rel="nofollow noopener noreferrer"` + `target="_blank"`。
 *
 * 渲染结果存进 Redis、前端用 v-html 渲染，所以这个文件是整条链路上唯一决定
 * 「访客能往页面里塞什么」的地方。改它之前先想清楚这一点。
 */

/** 单条留言的字符上限，和 api/guestbook.js 的校验保持一致。 */
const MAX_CHARS = 1000

/**
 * 挖走代码块 / 行内代码时用的占位符边界。
 * 用 U+0000：JSON 里能表示，但下面第一步就会把所有控制字符从原文里剔掉，
 * 所以访客无法伪造占位符去踩数组越界。
 */
const MARK = '\u0000'

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 只放行 http(s)，其余（javascript:、data:、vbscript:、协议相对）一律拒绝。
 * 传进来的 url 已经转义过，所以这里比对的是 `&amp;` 之类的形态，不影响协议判断。
 */
function safeUrl(url) {
  const raw = String(url).trim()
  if (!/^https?:\/\/[^\s]+$/i.test(raw)) return ''
  return raw
}

/**
 * 行内规则：代码 → 链接 → 粗体 → 斜体 → 删除线。
 * 行内代码最先挖走，否则写在代码里的 `**` 会被当成粗体。
 */
function renderInline(text) {
  const codes = []
  let out = text.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code)
    return `${MARK}c${codes.length - 1}${MARK}`
  })

  // [文字](链接)
  out = out.replace(/\[([^\]\n]{1,120})\]\(([^)\s]{1,300})\)/g, (whole, label, url) => {
    const href = safeUrl(url)
    if (!href) return whole
    return `<a href="${href}" target="_blank" rel="nofollow noopener noreferrer">${label}</a>`
  })

  // 裸链接。前面必须是行首或空白，避免把上一条规则产出的 href 再包一层。
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<]{4,300})/g, (whole, lead, url) => {
    const href = safeUrl(url)
    if (!href) return whole
    return `${lead}<a href="${href}" target="_blank" rel="nofollow noopener noreferrer">${href}</a>`
  })

  out = out
    .replace(/\*\*([^*\n]{1,200})\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]{1,200})\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]{1,200})~~/g, '<del>$1</del>')

  return out.replace(
    new RegExp(`${MARK}c(\\d+)${MARK}`, 'g'),
    (_, i) => `<code>${codes[Number(i)]}</code>`,
  )
}

/**
 * 把访客原文渲染成受控 HTML。
 * @param {string} input 未转义的原文
 * @returns {string} 只含 p / br / strong / em / del / code / pre / blockquote / a 的片段
 */
function renderMarkdown(input) {
  const source = escapeHtml(
    String(input || '')
      // 先剔掉控制字符：既清掉伪造占位符的可能，也顺手挡了零宽字符刷版
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u200b-\u200f]/g, '')
      .slice(0, MAX_CHARS),
  ).replace(/\r\n?/g, '\n')

  // 代码块整块挖走，里面的内容不参与任何行内规则。
  const blocks = []
  const withoutBlocks = source.replace(/```[a-z0-9+#-]*\n([\s\S]*?)```/gi, (_, code) => {
    blocks.push(code.replace(/\n$/, ''))
    return `${MARK}b${blocks.length - 1}${MARK}`
  })

  const blockOnly = new RegExp(`^${MARK}b(\\d+)${MARK}$`)
  const blockAny = new RegExp(`${MARK}b(\\d+)${MARK}`, 'g')

  const html = withoutBlocks
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const placeholder = para.match(blockOnly)
      if (placeholder) return `<pre><code>${blocks[Number(placeholder[1])]}</code></pre>`

      if (/^&gt;\s?/.test(para)) {
        const quoted = para
          .split('\n')
          .map((line) => line.replace(/^&gt;\s?/, ''))
          .join('\n')
        return `<blockquote>${renderInline(quoted).replace(/\n/g, '<br>')}</blockquote>`
      }

      return `<p>${renderInline(para).replace(/\n/g, '<br>')}</p>`
    })
    .join('')

  // 夹在段落中间的代码块占位符（例如「文字\n```code```」被切进同一段）也要还原。
  return html.replace(blockAny, (_, i) => `<pre><code>${blocks[Number(i)]}</code></pre>`)
}

/** 纯文本预览：邮件通知和后台列表用，不带任何标签。 */
function toPlainText(input) {
  return String(input || '')
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/[`*~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = { MAX_CHARS, escapeHtml, renderMarkdown, toPlainText }
