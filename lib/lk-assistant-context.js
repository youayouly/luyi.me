/**
 * 给 AI 问答助手用的 system prompt 拼装。放 `lib/` 的原因见 lk-kv.js 顶部注释。
 *
 * 只做「轻量 grounding」：把文章标题/摘要/标签和一段站点简介塞进 system prompt，
 * 不做向量检索——articles 数量个位数到几十篇，直接全量塞够用，真长了再考虑摘要/截断。
 *
 * 站点简介是手写的一小段（中英各一份），没有从 site.config.js / AboutMePage.vue
 * 里 import——那两个是 ESM（`export const`），这个文件要给 CommonJS 的
 * docs/api/assistant.js require，混不了。跟 translate-page.js 的 prompt 和
 * scripts/lib/translate-core.cjs 重复一份是同一种取舍：手改时记得一起改。
 */

const articles = require('./lk-article-brief.generated.json')

/** system prompt 别无限长——省 token，也避免个别超长摘要把上下文挤爆。 */
const MAX_ARTICLES = 40
const MAX_EXCERPT_CHARS = 120

const SITE_BLURB = {
  zh:
    '站点：「Luke 的空间」（luyi.me），作者 Luke 的个人博客。' +
    'Luke 目前在新加坡国立大学（NUS）攻读硕士，日常往返新加坡和中国内地，' +
    '关注产品、技术和跨文化体验，在嵌入式、前端和 AI 工具方向做项目实践，' +
    '博客内容涵盖技术笔记、产品复盘和留学生活。',
  en:
    "Site: \"Luke's Space\" (luyi.me), Luke's personal blog. " +
    "Luke is pursuing a master's degree at the National University of Singapore (NUS), " +
    'commuting between Singapore and mainland China. He works on product, tech, and ' +
    'cross-cultural topics, with hands-on projects in embedded systems, frontend, and AI ' +
    'tooling. The blog covers technical notes, product retrospectives, and study-abroad life.',
}

const INSTRUCTIONS = {
  zh:
    '你是这个个人博客网站里嵌入的 AI 问答助手。你可以回答两类问题：' +
    '（1）关于这个博客本身、作者或下面列出的文章的问题——请基于给出的资料回答，' +
    '资料里没有的细节就说不确定，不要编造；' +
    '（2）访客问的其他通用问题——按你的知识正常回答，不必强行扯回博客。' +
    '回答用中文，简洁，一般几句话之内，除非对方明确要更详细的解释。',
  en:
    'You are an AI assistant embedded in this personal blog site. You can answer two kinds ' +
    "of questions: (1) questions about the blog itself, its author, or the articles listed " +
    'below — answer from the given material, and say you are not sure rather than making ' +
    'things up when a detail is missing; (2) other general questions from visitors — answer ' +
    'normally from your own knowledge, no need to force it back to the blog. Reply in ' +
    'English, concisely, usually within a few sentences unless the visitor asks for more detail.',
}

function clampExcerpt(text) {
  const s = String(text || '')
  return s.length > MAX_EXCERPT_CHARS ? `${s.slice(0, MAX_EXCERPT_CHARS)}…` : s
}

function formatArticles(lang) {
  const list = articles.slice(0, MAX_ARTICLES)
  if (!list.length) return ''
  const header = lang === 'en' ? 'Articles on this blog:' : '本博客的文章列表：'
  const lines = list.map((a) => {
    const tags = Array.isArray(a.tags) && a.tags.length ? ` [${a.tags.join(', ')}]` : ''
    return `- ${a.title}${tags} — ${clampExcerpt(a.excerpt)} (${a.href})`
  })
  return [header, ...lines].join('\n')
}

/** target: 'zh' | 'en'，其它值落到 en。 */
function buildSystemPrompt(target) {
  const lang = target === 'zh' ? 'zh' : 'en'
  return [INSTRUCTIONS[lang], SITE_BLURB[lang], formatArticles(lang)].filter(Boolean).join('\n\n')
}

module.exports = { buildSystemPrompt }
