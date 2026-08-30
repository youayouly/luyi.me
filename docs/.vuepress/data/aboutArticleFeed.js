/**
 * About page article recommendations and timeline.
 *
 * Keep this list aligned with the public article index.
 */
export const recommendedArticles = [
  {
    title: 'Projects 作品集分页：把岗位、项目和文章串成招聘入口',
    href: '/article/pm-projects-pagination-galaxy.html',
    date: '2026-04-22',
    excerpt: '记录 PM 作品集前置、项目按岗位分页、文章分页，以及 SiliconFlow 星系背景本地化。',
    categories: ['PM', 'Projects'],
    cover: '/gallery/home-rec-projects-pagination.png',
  },
  {
    title: '产品经理作品集改造 PRD：把博客变成求职入口',
    href: '/article/pm-portfolio-prd.html',
    date: '2026-04-22',
    excerpt: '从招聘方视角重构个人站，把技术博客、案例文章和简历信息整理成产品经理作品集。',
    categories: ['PM', 'Portfolio'],
    cover: '/gallery/home-rec-portfolio-prd.png',
  },
  {
    title: 'AI Key 路由：SiliconFlow、DeepSeek、Qwen、One API、ZCode 和 CCSwitch',
    href: '/article/ai-key-router-one-api-zcode-ccswitch.html',
    date: '2026-04-22',
    excerpt: '把模型供应商 Key、One API 中转平台和 Claude Code 适配工具串成一套可维护的 AI 开发调用链。',
    categories: ['AI', 'Infra'],
    cover: '/gallery/home-rec-ai-key-router.png',
  },
  {
    title: 'Git 发布流水线：从本地改动到 Vercel Release',
    href: '/article/git-release-map.html',
    date: '2026-04-21',
    excerpt: '把暂存、提交、同步、推送、部署和排错拆成稳定模块，方便以后回看每段时间到底在做什么。',
    categories: ['Git', 'Release'],
    cover: '/gallery/home-rec-git-release.png',
  },
  {
    title: 'Edge AI 部署流水线的几笔记录',
    href: '/article/edge-ai-sketch.html',
    date: '2026-04-12',
    excerpt: '从模型导出、量化到设备端推理验证，整理一条最小可走的检查清单。',
    categories: ['Embedded', 'ML'],
    cover: '/gallery/article-cover-edge-ai-silicon-landscape-1776832435287.png',
  },
]

/**
 * Timeline items are intentionally broader than article recommendations:
 * articles, batch publish/delete operations, and release fixes can all appear
 * here so the About page works like a compact project activity log.
 *
 * 从 `git log` 里核实真实发生过的里程碑手动摘要，AboutTimeline.vue 取最新 20 条。
 * 时间越近颗粒度越细（按天，同一天多条就合并成一条）；月份一旧、单条提交的价值
 * 就跟着掉——2026-04 一个月就有 333 个提交，逐条列没人看得完，就收成 1-2 条
 * 月度摘要，`date` 直接写 `YYYY-MM`（<time datetime> 认这个格式，排序也照样按
 * 字符串比较正常工作，因为更短的前缀天然排在同月具体日期之前）。
 *
 * 2026-06、2026-07 没有条目是真的没提交，不是漏统计。
 *
 * 2026-08-29 那次"刷新数据"把 2026-04 的老条目整个删掉重写，是当时漏了合并，
 * 不是故意收窄覆盖范围——这里补回来，顺带把 04-19～04-29 那波之前完全没进过
 * 时间线的首页/项目页大改版也补上，和 2026-05、2026-03 一起收成月度摘要。
 */
export const timelineItems = [
  {
    date: '2026-08-29',
    title: '留言板上线：友链墙、表情回应、邮箱验证码等功能一次做完',
    href: '/guestbook',
  },
  {
    date: '2026-08-29',
    title: '仓库开源，首页加 Star 入口',
  },
  {
    date: '2026-08-28',
    title: '修复浏览器翻译卡死、图片灯箱误弹等线上问题',
  },
  {
    date: '2026-08-28',
    title: 'ApplyScribe RAG 项目接入外部同步',
    href: '/tech/ai-llm-rag.html',
  },
  {
    date: '2026-08-27',
    title: '语言入口收进设置面板，修好移动端按钮重叠',
  },
  {
    date: '2026-08-26',
    title: '站长单会话登录上线，首屏不再闪中文',
  },
  {
    date: '2026-08-24',
    title: '首屏同步译文，修复主题切换体验问题',
  },
  {
    date: '2026-08-23',
    title: '构建期页面翻译上线',
  },
  {
    date: '2026-08-21',
    title: '导航栏加翻译开关，语言按浏览器自动识别',
  },
  {
    date: '2026-05',
    title: '专攻移动端浏览器兼容两周，about 页地图收尾，后台管理面板整合',
  },
  {
    date: '2026-04',
    title: '首页与项目页大改版：三栏收成两栏、AI 生成封面、地图升级 3D 地球',
    href: '/tech/',
  },
  {
    date: '2026-04',
    title: '陆续发布 5 篇文章，Projects 页加上岗位分页',
    href: '/article/',
  },
  {
    date: '2026-03',
    title: '博客首次上云，第一版首页布局上线',
  },
]
