# luyi.me

个人博客站点 — VuePress 2 + [vuepress-theme-hope](https://theme-hope.vuejs.press/)，部署在 Vercel。
线上：**<https://luyi.me>**

这不是一个通用模板，是一个真实在跑的站点，开源出来供参考。下面几处是我觉得值得看的部分。

---

## 中英双语首屏：构建期翻译，运行时零 API

绝大多数「双语站」是在浏览器里边跑边翻，代价是打开页面先看几秒中文。这里换了个做法：**构建结束后直接把 HTML 改写成英文**。

```
/about 页面切换语言
  运行时逐句翻译   12–20 s
  本方案            73 ms   （0 次运行时 API 调用）
```

流程在 `scripts/pretranslate.mjs`：

1. `vuepress build` 之后扫描 `dist/**/*.html`，抽出所有中文文本节点
2. 只翻译词典里没有的那些，写入 `docs/.vuepress/public/i18n/en.json`（提交进仓库）
3. 用词典把每个页面的中文节点**就地改写成英文**，浏览器第一帧就是英文
4. 把 `{英文: 中文}` 反向表内联进页面，切回中文不需要任何请求

因为词典是提交进仓库的，**没有 API key 也能构建**——只是新增的中文不会被翻译，其余照常。

有两个坑值得单独说：

- **hydration 会把英文打回中文。** 静态节点不会，但组件渲染的节点（导航栏、站名、推荐卡片）会被客户端 bundle 里的中文覆盖。实测冷启动下 26 个节点在 hydration 时变回中文，要等词典网络请求回来才改正——中间有约 3 秒中文。所以 `scripts/lib/i18n-boot.mjs` 生成的引导脚本会保留一个 `MutationObserver`，用内联的反向表在节点变化的同一帧换回来。
- **`<title>` 在 `<body>` 外**，两次遍历都扫不到，得单独处理；而且 VuePress 路由切换时会追加第二个 `<title>` 标签。细节写在 `CLAUDE.md` 的 *First-paint translation* 一节，`tests/i18n-first-paint.test.mjs` 守着这些不变量。

## 浏览器内发版

写完文章不用回终端。管理端登录后，`PublishFab.vue` 把文章排进 `localStorage` 队列，一次推送经 GitHub Contents API 提交——**不写本地工作区，也不需要本地装 git**。封面由 AI 生成（`/api/cover`，可选 SiliconFlow / Dify / Cloudflare 等后端）。

## 自建访客统计

替掉了 busuanzi。`docs/api/visit.js` + `lib/lk-visit-classify.js`：

- 四道闸按成本从低到高排：同源校验 → 爬虫识别 → 每 IP 限流 → 画像基数上限
- 超限时返回 `{ok:true}` 而不是 429 —— 429 等于告诉刷的人该换 IP 了
- 人机判定给 0–100 分，用 UA + 地区 + 路径 + 时间，**故意不看 IP**：站点在 Cloudflare 后面，拿到的是边缘节点，同一台手机几分钟内会跳好几个 IP
- 访客标识是 `sha256(ip + '|' + ua)` 截断，没有跟踪 cookie，地理信息来自 Vercel 请求头，无第三方调用

## 布局守卫测试

`tests/*.test.mjs` 不渲染任何东西——它们把源文件当**文本**读，断言特定的类名、CSS 属性、代码模式还在。改个 `lk-` 类名就会红，然后你得决定是恢复不变量还是有意识地改测试。听起来粗暴，但它挡住过好几次「顺手重构」引发的塌版。

---

## 本地运行

```bash
npm install
npm run dev        # localhost:8080
```

**一个 key 都不填也能跑完整的双语站。** 缺少配置时各功能会静默降级而不是报错：访客统计 no-op、后台登录返回未配置、翻译走已提交的词典。

要启用发布、封面生成、访客统计，把 `.env.example` 复制成 `.env.local` 再填。

```bash
npm run build           # 生产构建（含 API 复制 + 英文改写）
npm run pretranslate:check   # 看还有多少中文没进词典
npm run sync:stars      # 拉 GitHub star 列表
node tests/about-quark-layout.test.mjs   # 单跑一个守卫测试
```

没有 test runner，也没有 `npm test`——测试是普通的 `node:assert` 脚本，直接 `node` 跑。

## Fork 之后改哪里

**`docs/.vuepress/site.config.js` 一个文件**：站名、描述、域名、头像、社交链接、导航项、Cloudflare token。其余地方都从它读，源码里没有硬编码的个人信息。

内容在 `docs/`：`article/` 文章、`tech/` 项目、`about.md` 关于页。文章列表目前是 `ArticleIndexList.vue` 里的一个手写数组（见 `CLAUDE.md` 的说明，那里记着这块的历史包袱）。

## 更细的说明

`CLAUDE.md` 是给 AI 编码助手写的仓库指南，但它其实是这个项目最完整的技术文档——每个设计决定都记了「为什么是这样」和「以前那样为什么不行」。想深入看某个子系统，从那里翻。

## 许可

代码可自由参考取用。`docs/` 下的文章正文与 `docs/.vuepress/public/gallery/` 里的图片是个人内容，请勿直接转载。
