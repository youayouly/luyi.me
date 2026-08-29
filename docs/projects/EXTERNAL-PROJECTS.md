# 外部项目速查

> **完整流程、命名、检查清单** → [`README.md`](./README.md)（维护者主文档，与本文同级）。  
> **JSON 模板** → [`blog-project.template.json`](./blog-project.template.json)。

## 1:1:1:1 对应

| 位置 | 键 |
|------|-----|
| `<外部仓库>/blog-project.json` | `id` |
| `docs/.vuepress/data/external-projects.registry.json` | 同 `id` |
| `docs/.vuepress/data/externalProjectItems.generated.js` | 脚本生成（勿手改） |
| `docs/tech/{id}.md` | 长文；`<!-- sync-setup-start/end -->` 内由 `sync:projects` 更新 |

## 一条命令接入

```bash
npm run onboard:project -- <registry-id>
```

## 三层内容

| 层级 | 位置 | 访客 |
|------|------|------|
| 卡片 | 外部 `blog-project.json` → sync | 可见 |
| 搭建速查 | `docs/tech/*.md` 标记区内 | 仅登录后 |
| 叙事 / 截图 | 标记区外 | 可见 |

## 本站手改项目

只改 `projectItems.manual.js`，**不需要**外部 `blog-project.json`。
