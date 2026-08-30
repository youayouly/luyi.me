/**
 * 发布时用到的两个小工具：给没填标签的文章猜几个标签，把字符串安全地写进 YAML
 * frontmatter。两边都被 docs/api/publish.js 和 docs/api/publish-batch.js 共用，
 * 所以放 lib/ 不放 docs/api/——原来 guessTags 只在 publish-batch.js 里，
 * publish.js（单篇发布）反而没有，两条路径长出了不一样的行为。
 */

/** 发布表单目前没有标签输入框，先按标题+摘要关键词粗猜几个，比空着强。 */
function guessTags(title, excerpt) {
  const text = `${title} ${excerpt}`.toLowerCase()
  if (text.includes('agent') || text.includes('mcp') || text.includes('infra')) return ['Agent', 'Infra']
  if (text.includes('prompt') || text.includes('模板')) return ['Prompt', 'Workflow']
  if (text.includes('openclaw') || text.includes('langchain') || text.includes('大模型')) return ['AI', 'Local']
  return ['Article']
}

/**
 * frontmatter 里的字符串值一律双引号包起来再转义——不加引号的话，标题/摘要里随便一个
 * `: ` 或者一行开头的 `#`、`[`、`{` 都可能被 YAML 解析器当成结构而不是纯文本，
 * 轻则页面标题变奇怪，重则整篇文章的 frontmatter 解析失败。
 */
function yamlString(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`
}

module.exports = { guessTags, yamlString }
