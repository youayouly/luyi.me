---
title: 产品经理作品集改造 PRD：把博客变成求职入口
description: 从招聘方视角重构个人站，把技术博客、案例文章和简历信息整理成产品经理作品集。
date: 2026-04-22T05:35:00.000Z
pageClass: page-article-post
comment: false
toc: true
---

# 产品经理作品集改造 PRD：把博客变成求职入口

这篇文章是我对本站下一阶段的产品化改造说明：如果我用这个博客去投产品经理岗位，招聘方打开页面时，不应该先被大量技术随笔、留学记录和相册分散注意力，而应该先看到一个清晰的候选人叙事。

核心目标只有一句话：

> 让招聘方在 90 秒内理解：我想投什么岗位、我有什么产品能力、我做过哪些能证明产品思维的项目。

## 1. 当前问题

现在的网站更像一个完整的个人空间：

- 有 About Me
- 有 Articles
- 有 Projects
- 有 Study Abroad
- 有 Album

这些内容很真实，也能体现技术和生活面，但对产品经理招聘方来说，第一屏信息不够聚焦。招聘方最关心的是：

1. 你目标岗位是什么？
2. 你是否理解用户问题？
3. 你是否能做需求拆解和优先级判断？
4. 你是否能把方案推进到结果？
5. 你有没有可以细看的 case study？

所以改造方向不是删除博客，而是在博客之上加一个更明确的「招聘入口」。

## 2. 产品目标

新增一个 PM Portfolio 层，建议路径为：

```text
/pm/
```

这个页面承担投递入口的角色，原有博客继续保留，作为补充证据。

目标：

- 展示 Product Manager / APM / AI Product 方向定位。
- 用 2-3 个案例证明产品思维。
- 把技术博客翻译成 PM 能力证据。
- 提供清晰的简历下载和联系方式。
- 后续可以通过配置文件调整展示内容。

非目标：

- 不重做整个站点。
- 不删除 Study Abroad / Album / Articles。
- 不为了好看堆动画。
- 不编造不存在的数据指标。

## 3. 招聘方视角的信息架构

推荐结构：

```text
/pm/
  产品经理求职入口页

/pm/cases/<slug>.html
  案例详情页

/about
  保留个人介绍

/article/
  保留文章流
```

当 recruiter mode 打开时，导航优先展示：

```text
PM Portfolio / Case Studies / Writing / About / Contact
```

普通模式下，仍保留现在的完整个人站导航。

## 4. PM 首页模块

### Hero

第一屏必须解决三个问题：

- 我是谁？
- 我投什么岗位？
- 我凭什么值得继续看？

建议文案结构：

```text
Lu Yi / Luke
Product Manager Intern / APM / AI Product PM

Product-minded builder focused on AI tools, developer workflows, and education technology.
```

首屏 CTA：

- Download Resume
- View Case Studies
- Contact

### PM 能力摘要

不要只写「会沟通、会学习、热爱产品」，而要把能力和证据绑在一起。

建议分组：

| 能力 | 证据 |
| --- | --- |
| Product Discovery | 能把模糊工作流痛点拆成明确问题 |
| Product Design | 能把需求转成页面结构、流程和 PRD |
| Product Delivery | 能做 MVP 范围、发布检查和验收标准 |
| Technical Fluency | 理解前端、AI API、静态站部署和自动化 |

### Featured Case Studies

首页不需要塞满所有项目，只放 2-3 个最像产品案例的项目。

推荐案例：

1. **Blog Publishing Workflow**
   - 用户：个人内容创作者
   - 问题：文章发布、封面、删除、历史查看需要重复手工操作
   - 证明点：流程设计、批量操作、失败状态、内容管理体验

2. **AI Cover Generation Workflow**
   - 用户：需要快速发布文章的人
   - 问题：AI 封面生成质量不稳定，失败回退容易误导发布
   - 证明点：AI 产品边界、错误处理、人工确认、可控性

3. **Study Abroad Information Planner**
   - 用户：准备港英新申请的学生
   - 问题：信息分散，难以比较地区、费用、语言和时间线
   - 证明点：信息架构、决策路径、内容可信度

## 5. Case Study 模板

每个详情页都应该用同一套结构，方便招聘方快速扫描：

```text
1. Context
2. Target User
3. Problem Statement
4. My Role
5. Goals and Constraints
6. Process
7. Key Decisions
8. Solution
9. Result / Validation
10. Reflection
```

最重要的是 Key Decisions。产品经理作品集不能只写「我做了什么」，还要写：

- 有哪些替代方案？
- 为什么选这个？
- 放弃了什么？
- 如果重新做，会优先改哪里？

## 6. 后台/配置需求

第一阶段不用做完整 CMS，用本地数据文件即可。

建议新增：

```text
docs/.vuepress/data/pmPortfolio.js
```

核心字段：

```js
export const pmPortfolio = {
  meta: {
    recruiterMode: true,
    language: 'en',
    lastUpdated: '2026-04-22',
  },
  hero: {
    name: 'Lu Yi / Luke',
    targetRoles: ['Product Manager Intern', 'APM', 'AI Product PM'],
    headline: 'Product-minded builder focused on AI tools, developer workflows, and education technology.',
    resumeUrl: '/resume-luke.pdf',
    contactEmail: 'youayouly@gmail.com',
  },
  cases: [],
  selectedWriting: [],
  contact: {},
}
```

后续后台可调项：

- 是否开启 recruiter mode
- Hero 文案
- 目标岗位
- 案例排序
- 推荐文章
- 简历链接
- 联系方式
- 是否隐藏 Study Abroad / Album 等非求职优先入口

## 7. 验收标准

第一阶段 MVP：

- `/pm/` 页面可以独立访问。
- 首屏能看到姓名、目标岗位、定位语、简历和联系入口。
- 至少展示 2 个 case card。
- 每个 case card 包含 problem、role、output/result。
- Selected Writing 不复用完整文章列表，而是精选 3-5 篇。
- 移动端 375px 宽度下没有文字溢出。
- `npm.cmd run build` 通过。

第二阶段：

- 至少完成 2 个案例详情页。
- 每个案例包含 2 个以上产品决策。
- 指标区分 real / proxy / planned。
- 每个案例底部有返回 PM Portfolio 和 Contact CTA。

## 8. 下一步

我会先做 `/pm/` 独立入口，而不是直接替换现有 About。

这样做的好处是：

- 投递时可以直接发 `/pm/`。
- 平时博客仍然完整。
- 后续 recruiter mode 可以慢慢加。
- 不会因为一次重构把现有站点弄乱。

这次改造的关键不是「更漂亮」，而是让现有经历形成一条招聘方能读懂的证据链：

```text
定位清楚 -> 能力有证据 -> 案例有决策 -> 结果不造假 -> 联系路径短
```

