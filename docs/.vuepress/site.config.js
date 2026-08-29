/**
 * 站点身份配置 —— fork 本仓库后**只需要改这一个文件**。
 *
 * 为什么放在 `docs/.vuepress/` 而不是仓库根：这个文件同时被
 * 构建期的 `config.js`（Node）和浏览器端的 `navPrefs.js` / 组件 import，
 * 放在 Vite root 之内才不会踩 `server.fs.allow` 的限制。
 *
 * 只放**身份与开关**，不放密钥。所有密钥走 `process.env`（见 .env.example）。
 */
export const siteConfig = {
  /** <html lang> 与 VuePress lang */
  lang: 'zh-CN',
  /** 站点标题；也是 <title> 里 `页面名 | 站点名` 的后半段 */
  title: 'Luke 的空间',
  description: '关于产品、技术、留学与生活的个人站点',
  /** 线上域名，用于 canonical / 分享卡片；不带协议 */
  domain: 'luyi.me',
  /** 本站开源仓库 owner/name；Star 卡片底部的 CTA 指向它 */
  repo: 'youayouly/luyi.me',

  /** 头像同时用作 favicon 与 Hope 主题 logo */
  avatar: '/gallery/avatar-luke-capybara.png',

  author: {
    name: 'Luke',
    /** GitHub 用户名；star 卡片、社交按钮都读它 */
    github: 'youayouly',
    email: 'youayouly@gmail.com',
    wechatId: 'youayouly1',
    wechatQr: '/wechat-qr.png',
    bilibili: 'https://space.bilibili.com/',
    qq: 'https://qm.qq.com/',
  },

  /**
   * 页脚「已运行 X 年 X 天」的起算时刻。
   * 环境变量 `LK_SITE_ONLINE_SINCE` 优先级更高（见 config.js）。
   */
  onlineSince: '2026-03-27T00:00:00+08:00',

  /** 导航栏主链接；与 navPrefs.js 的 navbarPageOptions 是两件事（那个管可见性开关） */
  nav: [
    { text: '首页', href: '/' },
    { text: '项目', href: '/tech/' },
    { text: '文章', href: '/article/' },
    { text: '关于我', href: '/about' },
  ],

  analytics: {
    /**
     * Cloudflare Web Analytics token。
     * 留空则 config.js 不注入 beacon 脚本 —— 目前上游填的是占位串，等于没启用。
     */
    cloudflareToken: '',
  },
}

export default siteConfig
