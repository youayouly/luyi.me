import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { viteBundler } from '@vuepress/bundler-vite'
import { defineUserConfig } from 'vuepress'
import { hopeTheme } from 'vuepress-theme-hope'
import { projectItems } from './data/projectsCatalog.js'
import { siteConfig } from './site.config.js'

const configDir = dirname(fileURLToPath(import.meta.url))
const docsRoot = join(configDir, '..')

function normPath(p) {
  return p.replace(/\\/g, '/')
}

function countArticleMarkdown(rootDir) {
  const readme = normPath(join(rootDir, 'README.md'))
  let n = 0

  const walk = (dir) => {
    let names
    try {
      names = readdirSync(dir)
    } catch {
      return
    }

    for (const name of names) {
      if (name.startsWith('.')) continue
      if (name === 'agents' || name === 'skills') continue

      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }

      if (st.isDirectory()) {
        walk(full)
        continue
      }

      if (
        name.endsWith('.md') &&
        !name.endsWith('_backup.md') &&
        !name.startsWith('test-') &&
        normPath(full) !== readme
      ) {
        n++
      }
    }
  }

  walk(rootDir)
  return n
}

const lkArticleCount = countArticleMarkdown(docsRoot)
const lkBuildTimeIso = new Date().toISOString()
const lkSiteYear = new Date().getFullYear()

/**
 * 页脚「已运行 X 年 X 天…」的起算时刻（**请改成你本人建站/首次上线**的本地时间）。
 * - 在下方改 `lkSiteOnlineSinceIso` 的默认值，或
 * - 构建/部署时设环境变量 `LK_SITE_ONLINE_SINCE=2024-03-20T00:00:00+08:00`（覆盖默认值）
 * 时区用 `+08:00` 与内地一致；不要用裸 `Z` 除非你真的按 UTC 记。
 * 未设 `LK_SITE_ONLINE_SINCE` 时默认用本仓库**最早一次提交**的日期（00:00 +08:00）——可改成你实际上线日。
 */
const lkSiteOnlineSinceIso =
  process.env.LK_SITE_ONLINE_SINCE || siteConfig.onlineSince

/** `docs/tech/` 下技术/项目文档页（不含 README 索引） */
function countTechMarkdown(techDir) {
  const readme = normPath(join(techDir, 'README.md'))
  let n = 0
  let names
  try {
    names = readdirSync(techDir)
  } catch {
    return 0
  }
  for (const name of names) {
    if (!name.endsWith('.md') || name.endsWith('_backup.md') || name.startsWith('test-')) continue
    const full = join(techDir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    if (normPath(full) === readme) continue
    n++
  }
  return n
}

const lkTechCount = countTechMarkdown(join(docsRoot, 'tech'))

function buildTechSidebar() {
  const children = projectItems
    .filter((item) => {
      const link = item.to.replace(/\.html$/, '')
      return link.startsWith('/tech/') && link !== '/tech'
    })
    .map((item) => ({
      text: item.title,
      link: item.to.includes('.html') ? item.to : `${item.to}.html`,
    }))

  return [
    { text: '项目列表', link: '/tech/' },
    ...children,
  ]
}

/** 强制 /tech/<slug> 详情启用与文章相同的 Hope 侧栏 + pageClass（hub README 仍 sidebar:false） */
function lkTechDetailPagesPlugin() {
  const techSidebar = buildTechSidebar()
  return {
    name: 'lk-tech-detail-pages',
    extendsPage(page) {
      const rel = (page.filePathRelative || '').replace(/\\/g, '/')
      if (!rel.startsWith('tech/') || rel === 'tech/README.md') return
      // 显式侧栏数组（与 /article/ 配置一致）；仅 sidebar:true 时 Hope 对 /tech 前缀常匹配失败
      page.frontmatter.sidebar = techSidebar
      page.frontmatter.toc = page.frontmatter.toc !== false
      page.frontmatter.pageClass = 'page-article-post'
    },
  }
}

function lkBuildTracePlugin() {
  return {
    name: 'lk-build-trace',
    extendsPage: async (page) => {
      if (process.env.LK_BUILD_TRACE === '1') {
        const rel = page.filePathRelative ?? '(virtual)'
        console.error(`[lk-build] extendsPage -> ${rel}  route=${page.path}`)
      }
    },
  }
}

/*
 * `vuepress dev` 只起 Vite，不认 Vercel 的 `api/*.js`，所以本地点翻译只会拿到 404
 * （按钮变红了、文字一个没换，就是这个原因）。这里在开发服务器上把同一批 handler
 * 挂回 `/api/*`，用最小的 Vercel 兼容层补上 `req.body` / `res.status().json()`。
 * 线上仍然走 Vercel Functions，这个插件只在 dev 生效。
 */
function lkDevApiPlugin() {
  const apiDir = join(configDir, '../../api')

  function sendJson(res, code, payload) {
    if (res.writableEnded) return
    res.statusCode = code
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
  }

  /* handler 是按 Vercel 的 req/res 写的，这里补上它用到的那几个方法。 */
  function shimResponse(res) {
    res.status = (code) => {
      res.statusCode = code
      return res
    }
    res.json = (payload) => sendJson(res, res.statusCode || 200, payload)
    res.send = (payload) => {
      if (payload && typeof payload === 'object') return sendJson(res, res.statusCode || 200, payload)
      if (res.writableEnded) return res
      res.end(payload == null ? '' : String(payload))
      return res
    }
    return res
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  return {
    name: 'lk-dev-api',
    apply: 'serve',
    configureServer(server) {
      const require = createRequire(import.meta.url)

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/')) return next()

        const route = url.split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
        if (!/^[a-z0-9-]+$/i.test(route)) return next()

        const file = join(apiDir, `${route}.js`)
        if (!existsSync(file)) return next()

        try {
          // 删掉缓存：改完 handler 不用重启 dev server。
          delete require.cache[require.resolve(file)]
          /*
           * handler 现在会 require 根目录 `lib/`（lk-kv / lk-admin-auth / lk-ua）。
           * 只清 handler 自己的缓存不够——它拿到的还是上一版的 lib，表现是
           * 「明明改好了却报 xxx is not a function」。这里把 lib/ 下的缓存一起清掉。
           */
          const libDir = join(configDir, '../../lib')
          for (const cached of Object.keys(require.cache)) {
            if (cached.startsWith(libDir)) delete require.cache[cached]
          }
          const handler = require(file)
          const fn = typeof handler === 'function' ? handler : handler?.default
          if (typeof fn !== 'function') return next()

          const raw = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req)
          req.body = raw
          req.query = Object.fromEntries(new URL(url, 'http://localhost').searchParams)
          await fn(req, shimResponse(res))
          if (!res.writableEnded) res.end()
        } catch (error) {
          console.error(`[lk-dev-api] /api/${route} failed:`, error)
          sendJson(res, 500, { ok: false, error: error?.message || 'dev api handler failed' })
        }
      })
    },
  }
}

export default defineUserConfig({
  pagePatterns: [
    '**/*.md',
    '!.vuepress',
    '!agents/**',
    '!skills/**',
    '!**/*_backup.md',
    '!**/test-*.md',
  ],
  plugins: [lkBuildTracePlugin(), lkTechDetailPagesPlugin()],
  bundler: viteBundler({
    viteOptions: {
      plugins: [lkDevApiPlugin()],
      define: {
        __LK_ARTICLE_COUNT__: JSON.stringify(lkArticleCount),
        __LK_TECH_COUNT__: JSON.stringify(lkTechCount),
        __LK_BUILD_TIME_ISO__: JSON.stringify(lkBuildTimeIso),
        __LK_SITE_YEAR__: JSON.stringify(lkSiteYear),
        __LK_SITE_ONLINE_SINCE_ISO__: JSON.stringify(lkSiteOnlineSinceIso),
        __LK_PUBLISH_API_URL__: JSON.stringify(process.env.LK_PUBLISH_API_URL || ''),
      },
    },
  }),
  lang: siteConfig.lang,
  title: siteConfig.title,
  description: siteConfig.description,

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: siteConfig.avatar }],
    ['meta', { name: 'theme-color', content: '#343a40' }],
    // 告诉浏览器深色由本站自己处理（导航栏那个开关），别再自动反色。
    // 不声明的话 Chrome 会把本站当成'只有浅色的老站'，在系统深色下自行生成一版
    // 算法深色——连首屏背景图一起反色。darkmode 仍是 'toggle'：默认浅色、只认站内开关。
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    // 提前预热翻译词典，让切换语言/路由时不至于先闪中文（默认英文）
    ['link', { rel: 'prefetch', href: '/i18n/en.json' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href:
          'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap',
      },
    ],
    // Cloudflare Web Analytics — 免费国家级别访客来源统计。
    // 只有 site.config.js 里填了真实 token 才注入；留空则整条不下发，
    // 避免像之前那样常年挂着 REPLACE_WITH_YOUR_CF_TOKEN 白请求一个脚本。
    ...(siteConfig.analytics?.cloudflareToken
      ? [
          [
            'script',
            {
              defer: '',
              src: 'https://static.cloudflareinsights.com/beacon.min.js',
              'data-cf-beacon': JSON.stringify({ token: siteConfig.analytics.cloudflareToken }),
            },
          ],
        ]
      : []),
  ],

  theme: hopeTheme({
    logo: siteConfig.avatar,
    darkmode: 'toggle',
    pure: false,
    appearance: 'light',
    // 全局禁用 Hope 主题正文底部的「最近更新 / 贡献者」两行（PC + 移动端均生效）
    lastUpdated: false,
    contributors: false,
    navbar: [
      { text: '首页', link: '/' },
      { text: '项目', link: '/tech/' },
      { text: '文章', link: '/article/' },
      { text: '留言板', link: '/guestbook' },
      { text: '关于我', link: '/about' },
    ],

    sidebar: {
      '/about': false,
      '/about.html': false,
      '/stats/': false,
      '/stats.html': false,
      '/tech': buildTechSidebar(),
      '/tech/': buildTechSidebar(),
      '/study/': [
        {
          text: '留学',
          children: [
            { text: '总览', link: '/study/' },
            { text: '中国香港', link: '/study/hk' },
            { text: '英国', link: '/study/uk' },
            { text: '新加坡', link: '/study/singapore' },
          ],
        },
      ],
      '/travel/': 'structure',
      '/article/': [
        { text: '文章列表', link: '/article/' },
        { text: 'Projects 作品集分页', link: '/article/pm-projects-pagination-galaxy.html' },
        { text: '产品经理作品集 PRD', link: '/article/pm-portfolio-prd.html' },
        { text: 'AI Key Router 路由系统', link: '/article/ai-key-router-one-api-zcode-ccswitch.html' },
        { text: 'Git 发布流程图', link: '/article/git-release-map.html' },
        { text: 'OpenClaw 本地搭建', link: '/article/openclaw.html' },
        { text: 'AI 基础设施笔记', link: '/article/langchain.html' },
        { text: 'AI 提示词模板', link: '/article/ai模板.html' },
        { text: '边缘 AI 草图', link: '/article/edge-ai-sketch.html' },
        { text: 'VuePress 架构笔记', link: '/article/vuepress-stack-notes.html' },
      ],
      '/': 'structure',
    },

    plugins: {
      redirect: {
        config: {
          '/article.html': '/article/',
          '/stats': '/stats/',
          '/stats.html': '/stats/',
          '/home': '/',
          '/home.html': '/',
          '/comments/': '/article/',
          '/comments': '/article/',
        },
      },
      activeHeaderLinks: false,
      comment: false,
      // 卡片封面（首页短文推荐、文章列表、项目卡片）整张卡就是一个链接，
      // 而 photo-swipe 默认选择器 `[vp-content] :not(a) > img:not([no-view])`
      // 只排除「直接挂在 <a> 下」的图，封面外面包了一层 <span> 就漏了进来：
      // 点封面会先弹出灯箱，再跟着路由跳走。补一条 `:not(a img)`，
      // 链接内部的图一律只跳转、不放大；正文里的图不受影响。
      photoSwipe: {
        selector: '[vp-content] :not(a) > img:not([no-view]):not(a img)',
      },
    },
  }),
})
