# 外部 GitHub 项目接入 blog（项目板块）

把**独立仓库**挂到个人站 `/tech/` 项目列表：**不 merge 代码**，用 `blog-project.json` + 同步脚本 + 可选 AI 封面。

详细字段见 [`blog-project.schema.json`](../.vuepress/data/blog-project.schema.json)，复制模板见 [`blog-project.template.json`](./blog-project.template.json)，MultiFeed 实例如 [youayouly/news `blog-project.json`](https://github.com/youayouly/news/blob/main/blog-project.json)。

---

## 文档放哪？（维护者 vs 访客）

| 写什么 | 放哪 | 不要放哪 |
|--------|------|----------|
| **GitHub 项目 → blog 的接入流程**（本页全文） | `docs/projects/README.md` | 不要写在 `docs/tech/README.md`（那是访客项目 hub） |
| 速查表、1:1 文件对应 | [`EXTERNAL-PROJECTS.md`](./EXTERNAL-PROJECTS.md) | 不要写在 `docs/tech/<slug>.md` 正文（访客会看见） |
| 对外项目叙事（问题 / 功能 / 架构 / 截图） | `docs/tech/<slug>.md` 标记区**外** | 不要写端口、env、本机 URL |
| 搭建速查（命令 / 端口 / env） | `docs/tech/<slug>.md` 的 `<!-- sync-setup-start/end -->` | 脚本生成；浏览器里**仅登录后**显示 |

结论：**工作流文档和本 README 同级**，都在 `docs/projects/`；以后每个外部仓库都按下面「命名 + 检查清单」处理，不必再开新位置。

---

## 命名约定（以后外部项目统一用这套）

所有「对外键」用同一个 **`registry-id`**（kebab-case），四处必须一致：

| 用途 | 路径 / 字段 | 命名规则 | 示例 |
|------|-------------|----------|------|
| 注册表 | `docs/.vuepress/data/external-projects.registry.json` → `id` | `小写-连字符`，语义化 | `multifeed-news` |
| 外部 manifest | `<外部仓库根>/blog-project.json` → `id` | **与 registry `id` 相同** | `multifeed-news` |
| 详情页文件 | `docs/tech/<slug>.md` | **建议 `slug === id`** | `multifeed-news.md` |
| 卡片链接 | `blog-project.json` → `to` | `/tech/<slug>.html` | `/tech/multifeed-news.html` |
| 封面图 | `blog-project.json` → `cover` | `/gallery/proj-card-<id>-<timestamp>.png` | `/gallery/proj-card-multifeed-news-….png` |

**排序（新项目要排在列表前面时）**

- `sortDate`：写成接入当天（ISO `YYYY-MM-DD`）；全站按日期新→旧排序，新项自然在「博客发布工作流」等旧项之上。
- `featuredRank`：可选；`0` 表示精选排序时最靠前（与 `sortDate` 并用时，以列表页当前排序模式为准）。

**`registry-id` 取名建议**

- 用英文 kebab-case，跟仓库/产品简称相关，避免 `project1`。
- 一个外部仓库对应一个 `id`；不要与 `projectItems.manual.js` 里已有标题重复造成混淆。

---

## 新外部项目检查清单（每次都走这套）

1. 外部仓库根目录：添加 `blog-project.json`（从 [`blog-project.template.json`](./blog-project.template.json) 复制改）。
2. blog 仓库：`external-projects.registry.json` 增加一行（`id`、`repo`、`detailFile`、可选 `localPath`）。
3. blog 仓库：新建 `docs/tech/<id>.md`（含 `sync-setup` 标记对 + 标记区外写博客式正文）。
4. blog 仓库根目录执行：`npm run onboard:project -- <id>`（或分步 `sync:projects` → `gen:proj-cover` → 再 sync）。
5. 验证：`npm run build`；打开 `/tech/` 与 `/tech/<id>.html` 看卡片顺序与侧栏。

---

## 一次接入（推荐命令）

在 **blog 仓库根目录**（已配置 `SILICONFLOW_API_KEY` 于 `.env.local`）：

```bash
# 1. 外部仓库根目录已有 blog-project.json，且 id 与下面一致
# 2. 已在 docs/.vuepress/data/external-projects.registry.json 注册
# 3. 已创建 docs/tech/{slug}.md（含 <!-- sync-setup-start --> / <!-- sync-setup-end -->）

npm run onboard:project -- <registry-id>
```

示例：

```bash
npm run onboard:project -- multifeed-news
```

脚本会依次：`sync:projects` → 若无 `cover` 则 `gen:proj-cover` → 有 `localPath` 时回写外部 `blog-project.json` → 再 `sync:projects`。

---

## 分步手册（与 onboard 等价）

### A. 外部 GitHub 仓库

1. 复制模板为根目录 **`blog-project.json`**（`id`、`title`、`role`、`tag`、`summary`、`to`、`links`、`visibility`、`setup`）。
2. `role` 必须是 blog 已有中文角色（见 `projectsCatalog.js` 的 `roleMapping`）。
3. `to` 形如 `/tech/your-slug.html`，与 blog 详情页文件名一致。
4. Commit / push（公开库供 raw 拉取；私有库见下）。

### B. blog 仓库

1. **`docs/.vuepress/data/external-projects.registry.json`** 增加一项：

```json
{
  "id": "your-project-id",
  "repo": "youayouly/your-repo",
  "branch": "main",
  "manifestPath": "blog-project.json",
  "detailFile": "docs/tech/your-slug.md",
  "localPath": "../your-repo"
}
```

- 公开库可省略 `localPath`，manifest 从 GitHub raw 拉。
- 私有库：保留 `localPath` 或配置 `GITHUB_TOKEN`，否则 sync 失败。

2. 新建 **`docs/tech/your-slug.md`**（frontmatter 参考 `my-blog.md`），正文含：

```html
<!-- sync-setup-start -->
<!-- sync-setup-end -->
```

标记区外写产品叙事、架构、**截图**（访客看到的「项目里面」）。

3. **同步与封面**

```bash
npm run sync:projects
npm run gen:proj-cover -- your-project-id
```

将终端输出的 `/gallery/proj-card-...png` 写入外部仓库 **`blog-project.json` 的 `cover`**，push 外部仓库后：

```bash
npm run sync:projects
npm run build
```

或一步：`npm run onboard:project -- your-project-id`（需 `localPath` 才能自动回写外部 json 的 `cover`）。

4. **发布**：commit blog（含 `gallery` 新图、`externalProjectItems.generated.js`），push → Vercel 构建。

---

## 页面样式（hub vs 详情）

| 页面 | 路径 | `pageClass` | 侧栏 / TOC |
|------|------|-------------|------------|
| 项目列表 hub | `/tech/`（`docs/tech/README.md`） | `page-projects` | frontmatter `sidebar: false` |
| 项目详情 | `/tech/<slug>.html` | `page-article-post`（与文章相同） | `sidebar: true`、`toc: true`；样式与左栏目录 chrome 与文章详情共用 `index.scss` + `client.js` |

指向 `/article/` 的卡片使用 **`/tech/` 包装页**（摘要 +「阅读全文」），顶栏统一高亮「项目」。

---

## 三层内容分工

| 层级 | 放哪 | 谁更新 |
|------|------|--------|
| 卡片标题 / tag / 封面 | 外部 `blog-project.json` → sync | 外部改 json + `sync:projects` |
| 搭建速查 | `docs/tech/*.md` 标记区内 | `sync:projects` |
| 长文 / 截图 | 同文件标记区外 | 你手写 |

---

## 密钥（仅 blog 本地，勿提交 Git）

| 变量 | 用途 |
|------|------|
| `SILICONFLOW_API_KEY` | 项目卡片封面 `gen-proj-covers.mjs` |
| `DIFY_API_KEY` | 文章封面（另一套流程） |
| `GITHUB_TOKEN` | 私有仓库拉 manifest（可选） |

---

## 本站已有项目

只改 **`projectItems.manual.js`**，不需要外部 `blog-project.json`。

---

## 命令速查

| 命令 | 作用 |
|------|------|
| `npm run sync:projects` | 拉 manifest → 卡片 + 搭建标记区 |
| `npm run gen:proj-cover -- <slug>` | 仅生成一张 SiliconFlow 封面到 `gallery/` |
| `npm run onboard:project -- <id>` | 接入全流程（sync + 封面 + 再 sync） |
| `npm run build` | 构建验证 |
