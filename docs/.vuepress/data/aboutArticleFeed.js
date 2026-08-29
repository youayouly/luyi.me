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
 * 按天从 `git log` 里挑真实发生过的里程碑手动摘要，同一天有多条就合并成一条——
 * AboutTimeline.vue 只取最新 10 条，条目太碎反而看着像重复。日期都是真实提交
 * 日期，不是拍脑袋填的；同一天出现两次是因为那天真的做了两件不相关的事。
 */
export const timelineItems = [
  {
    date: '2026-08-29',
    title: '留言板上线：友链墙、表情回应、地区标签、邮箱验证码、草稿自动保存一次做完',
    href: '/guestbook',
  },
  {
    date: '2026-08-29',
    title: '首页加 Star 本站仓库入口，仓库开源并接入发布同步脚本与密钥扫描',
  },
  {
    date: '2026-08-28',
    title: '修好浏览器内置翻译卡死、文章卡片误弹图片灯箱等一批线上问题',
  },
  {
    date: '2026-08-28',
    title: 'ApplyScribe RAG 项目接入外部同步，详情页换成真实实现',
    href: '/tech/ai-llm-rag.html',
  },
  {
    date: '2026-08-27',
    title: '语言入口收进设置面板，修好移动端汉堡按钮和文章工具条重叠',
  },
  {
    date: '2026-08-26',
    title: '站长单会话登录上线，构建期直出英文 HTML，首屏不再闪中文',
  },
  {
    date: '2026-08-24',
    title: '首屏同步译文，主题切换与项目详情跳转体验修复一批',
  },
  {
    date: '2026-08-23',
    title: '构建期页面翻译上线，修好因改名漏部署的翻译接口',
  },
  {
    date: '2026-08-21',
    title: '导航栏加运行时翻译开关，站点语言按浏览器自动识别',
  },
]
