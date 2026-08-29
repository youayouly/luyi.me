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
 */
export const timelineItems = [
  {
    date: '2026-04-22',
    title: 'Projects 页面完成 PM 作品集前置、岗位项目分页和星系背景升级',
    href: '/tech/',
    category: 'Projects',
  },
  {
    date: '2026-04-22',
    title: '发布 Projects 分页与星系背景迭代记录',
    href: '/article/pm-projects-pagination-galaxy.html',
    category: 'Article',
  },
  {
    date: '2026-04-22',
    title: '发布 PM Portfolio PRD 与 AI Key 路由两篇文章',
    href: '/article/pm-portfolio-prd.html',
    category: 'Article',
  },
  {
    date: '2026-04-21',
    title: '整理 Git / Release 操作说明，补齐发布流水线文档',
    href: '/article/git-release-map.html',
    category: 'Docs',
  },
  {
    date: '2026-04-21',
    title: '修复生成封面随文章一起发布，避免 Vercel 找不到图片',
    category: 'Release',
  },
  {
    date: '2026-04-21',
    title: '收敛 blog-v1：删除测试短文，保留可发布文章索引',
    category: 'Article',
  },
  {
    date: '2026-04-20',
    title: '提交封面图片资源，解决云端构建缺失文件问题',
    category: 'Deploy',
  },
  {
    date: '2026-04-12',
    title: 'Edge AI 部署流水线的几笔记录',
    href: '/article/edge-ai-sketch.html',
    category: 'Article',
  },
  {
    date: '2026-04-02',
    title: '用 VuePress 2 搭静态个人站',
    href: '/article/vuepress-stack-notes.html',
    category: 'Article',
  },
]
