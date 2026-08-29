/**
 * 首屏语言的守卫测试。
 *
 * 背景（实测线上，4×CPU + 4G、冷缓存）：构建期已经把 dist 换成英文了，首屏确实
 * 0 个中文，但 hydration 会把主题组件渲染的文本 patch 回中文（首页 26 处），
 * 而运行时那条路要等 `/i18n/en.json`（46KB，慢网 4.4s）—— 中间整整 3 秒中文。
 * 修法是把内联的「译文 -> 原文」表倒过来当正查表：数据本来就在 HTML 里，查表同步、零请求。
 *
 * 另外 `<title>` 在 <body> 外面，两边的遍历都扫不到，所以单独走一条路。
 *
 * 和其它守卫测试一样，这里读的是源码文本 —— 改名 / 重构会让它报错，
 * 看断言信息决定是恢复不变量还是有意更新它。
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractTranslatableStrings, localizeHtml } from '../scripts/lib/html-text-nodes.mjs'
import { renderBootScript } from '../scripts/lib/i18n-boot.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

const DICT = {
  文章: 'Articles',
  'Luke 的空间': "Luke's space",
  你好: 'Hello',
}

/* ---------- <title> ---------- */

{
  const html =
    '<html lang="zh-CN"><head><meta charset="utf-8"><title>文章 | Luke 的空间</title></head>' +
    '<body><h1>文章</h1><p>你好</p></body></html>'
  const { html: out, rev } = localizeHtml(html, DICT)

  assert.match(out, /<title>Articles \| Luke's space<\/title>/, '<title> 必须一起换成英文，它是标签页上唯一露在外面的文案')
  assert.equal(
    rev["Articles | Luke's space"],
    '文章 | Luke 的空间',
    '整条标题要进反查表：切回中文时 document.title 没有节点可以存原文',
  )

  const strings = extractTranslatableStrings(html)
  assert.ok(strings.has('Luke 的空间'), '标题里的站点名要进词典扫描，否则永远没人翻它')
}

{
  // 首页：页面标题和站点名相同，VuePress 不再拼成「X | X」，只有一段。
  const html = '<html><head><title>Luke 的空间</title></head><body><p>你好</p></body></html>'
  const { html: out } = localizeHtml(html, DICT)
  assert.match(out, /<title>Luke's space<\/title>/, '单段标题要走整串查表，不能因为没有分隔符就放弃')
}

{
  const html = '<html><head><title>Luke 的空间</title></head><body><p>你好</p></body></html>'
  const { html: out } = localizeHtml(html, { 你好: 'Hello' })
  assert.match(out, /<title>Luke 的空间<\/title>/, '词典里没有的标题要原样留着，交给运行时兜底')
}

/* ---------- 首屏脚本 ---------- */

{
  const script = renderBootScript({ Articles: '文章' }, 'en')

  assert.match(
    script,
    /if\(L!=='zh'\)\{D=\{\};for\(var k in R\)D\[R\[k\]\]=k\}/,
    '英文访客要把反查表倒过来用：hydration 改回中文时靠它当帧换回英文，不用等词典',
  )
  assert.match(script, /B\.stop=function\(\)\{B\.done=true;O\.disconnect\(\)\}/, 'pageTranslate 切中文时要能让首屏脚本收手，否则两边互相盖')
  assert.match(script, /characterData:true/, 'hydration 改文本走的是 characterData，只看 childList 会全漏')
  assert.ok(
    !/if\(L!=='zh'\)return/.test(script),
    '英文访客不能再直接 return —— 那正是 hydration 之后 3 秒中文的原因',
  )

  /* 浏览器内置翻译：Edge 译成中文，中文正是本表的 key，两边互相改会把标签页转死。 */
  assert.match(
    script,
    /r\.type==='characterData'\)\{if\(X\(r\.target\.parentElement\)\)\{B\.stop\(\);return\}/,
    'Edge 改的是 characterData，让路的判断只挂在 addedNodes 分支等于没挂',
  )
  assert.match(script, /_msthash/, 'Microsoft Translator 两个标记属性都要认')
  assert.match(
    script,
    /indexOf\('translated-'\)>=0\)\{B\.stop\(\);return\}/,
    'Google 翻译不打属性，靠 <html> 上的 translated-ltr 认',
  )
  assert.match(
    script,
    /if\(A\)\{/,
    '熔断只能在 DOMContentLoaded 之后生效：解析期回调本来就密，会误伤中文访客',
  )
  assert.match(
    script,
    /DOMContentLoaded',function\(\)\{A=1;/,
    '熔断的 armed 标志要在 DOMContentLoaded 里置上，否则永远不生效',
  )
}

/* ---------- 运行时 ---------- */

{
  const source = read('docs/.vuepress/utils/pageTranslate.js')

  assert.match(source, /const bootForward = new Map\(\)/, '内联的「原文 -> 译文」表是不等网络的那一档')
  assert.match(source, /bootForward\.set\(rev\[key\], key\)/, 'adoptBootReverse 要顺手把正查表建起来')
  assert.match(source, /function makeLookup\(target\)/, '三档查表顺序要收在一个地方，同步那条路每帧都要用')
  assert.match(source, /startTitleObserver/, 'VuePress 每次路由都会重写 document.title，得盯着 <head>')
  assert.match(source, /stopBootObserver\(\)/, '切回中文前必须停掉首屏脚本的 observer')
  assert.match(source, /restoreTitle\(\)/, '切回中文要连标题一起还原')
  assert.match(
    source,
    /function dedupeTitleElements\(\)/,
    'VuePress 认不出英文 <title>，路由切换时会再 append 一个，不收口标签页就一直停在上一页',
  )

  /* 与浏览器内置翻译共处：让路要让干净，漏一根线就还是会卡死。 */
  assert.match(
    source,
    /function startTranslatorSentinel\(\)/,
    'Edge 主要改 characterData，主 observer 只看 childList，得有个属性哨兵先发现',
  )
  assert.match(
    source,
    /attributeFilter: MS_TRANSLATOR_ATTRS/,
    '哨兵必须用 attributeFilter，否则全文属性变更都要生成记录',
  )
  assert.match(
    source,
    /function applyTitle\(target, lookup\) \{[\s\S]{0,200}?if \(stoodDown\) return/,
    '<title> 是浏览器翻译的目标，applyTitle 不闭嘴就是另一条死循环',
  )
  assert.match(
    source,
    /stoodDown = true[\s\S]{0,400}?stopTitleObserver\(\)/,
    'standDown 要连 title observer 一起停',
  )
  assert.match(
    source,
    /if \(noteObserverBurst\('页面标题'\)\) return[\s\S]{0,40}?if \(externalTranslatorActive\(\)\)/,
    '<title> 那条链要先熔断再检测：标题常在正文打上 _msttexthash 之前就被翻，先做全文 querySelector 等于每轮白花一次',
  )
}

{
  const home = read('docs/README.md')
  const frontmatter = home.slice(0, home.indexOf('---', 3))
  assert.ok(
    !/^title:/m.test(frontmatter),
    '首页不要写 title：页面标题和站点名相同，写了标签页就变成「Luke 的空间 | Luke 的空间」',
  )
}

console.log('i18n-first-paint: ok')
