<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

/* 站内跳转走 RouterLink，原生 <a> 的整页重载会让译文闪回中文，见 AboutArticleRecommend。 */
function linkTag(project) {
  return project.external ? 'a' : RouterLink
}

function linkProps(project) {
  return project.external ? { href: project.link } : { to: project.link }
}

const activeRole = ref('pm')

const projectGroups = [
  {
    id: 'pm',
    name: '产品经理',
    summary: '把需求、流程、信息架构和交付节奏整理成可被招聘方快速理解的作品表达。',
    labels: ['需求拆解', '信息架构', '流程设计', '体验优化'],
    projects: [
      {
        id: 'pm-blog-publishing',
        title: '博客发布工作流',
        subtitle: '把重复发布动作整理成顺手的产品流程',
        description: '把文章创建、发布、删除和状态确认串成一条更稳定的使用链路，减少手动操作带来的摩擦。',
        tags: ['发布流程', '批量操作', '状态可见', '本地持久化'],
        link: '/article/git-release-map.html',
      },
      {
        id: 'pm-ai-cover',
        title: 'AI 封面生成链路',
        subtitle: '让封面质量和失败反馈都更可控',
        description: '围绕封面生成体验补齐生成、测试、落地与异常处理，让内容生产更稳定。',
        tags: ['AI 生成', '异常处理', '素材沉淀', '内容效率'],
        link: '/article/ai-key-router-one-api-zcode-ccswitch.html',
      },
      {
        id: 'pm-study-planner',
        title: '留学信息规划器',
        subtitle: '把个人研究整理成可复用的决策支持',
        description: '把学校、申请和生活信息重新组织成更容易比较和筛选的内容结构。',
        tags: ['教育产品', '决策支持', '内容组织', '信息对比'],
        link: '/study/',
      },
    ],
  },
  {
    id: 'frontend',
    name: '前端体验',
    summary: '关注页面结构、动效反馈、组件编排与跨端阅读体验。',
    labels: ['界面设计', '交互动效', '响应式', '组件化'],
    projects: [
      {
        id: 'fe-vuepress-blog',
        title: 'VuePress 个人站',
        subtitle: '统一文章、项目与资料页的前端承载层',
        description: '用 VuePress 搭建多页面内容站点，并通过组件和样式覆盖形成统一视觉语言。',
        tags: ['VuePress', '页面结构', '组件注册', '暗色模式'],
        link: '/article/vuepress-stack-notes.html',
      },
      {
        id: 'fe-projects-page',
        title: 'Projects 页面改版',
        subtitle: '把项目展示做成更容易扫读的入口页',
        description: '通过层级、分组与标签，让项目页更适合作为作品集入口，而不是简单堆卡片。',
        tags: ['作品集', '信息层级', '视觉节奏', '浏览效率'],
        link: '/article/pm-projects-pagination-galaxy.html',
      },
    ],
  },
  {
    id: 'ai',
    name: 'AI 工程',
    summary: '围绕模型接入、推理链路与 AI 应用落地做工程化实践。',
    labels: ['模型接入', '推理流程', '工具集成', '稳定性'],
    projects: [
      {
        id: 'ai-router',
        title: 'AI Key Router',
        subtitle: '统一多模型调用与密钥管理',
        description: '整理多模型调用、供应商切换和密钥管理逻辑，让 AI 基础设施使用更稳定。',
        tags: ['模型路由', '多供应商', '接口设计', '配置管理'],
        link: '/article/ai-key-router-one-api-zcode-ccswitch.html',
      },
      {
        id: 'ai-rag',
        title: 'LLM RAG 助手',
        subtitle: '提升长文档问答的可追溯性',
        description: '围绕检索增强生成搭建更可信的回答流程，减少纯模型记忆带来的漂移。',
        tags: ['RAG', '检索增强', '知识库', '问答流程'],
        link: '/tech/ai-llm-rag.html',
      },
    ],
  },
]

const activeGroup = computed(
  () => projectGroups.find((group) => group.id === activeRole.value) || projectGroups[0],
)

const totalProjects = computed(() =>
  projectGroups.reduce((count, group) => count + group.projects.length, 0),
)
</script>

<template>
  <main class="lk-projects">
    <section class="lk-projects__hero">
      <div class="lk-projects__hero-copy">
        <p class="lk-projects__eyebrow">项目作品集</p>
        <h1 class="lk-projects__title">按方向整理我的项目表达</h1>
        <p class="lk-projects__subtitle">
          先看产品判断，再看前端体验，最后补 AI 工程细节，让整个页面更像作品集，而不是杂乱的项目清单。
        </p>
        <div class="lk-projects__hero-meta">
          <span>{{ projectGroups.length }} 个方向</span>
          <span>{{ totalProjects }} 个项目</span>
        </div>
      </div>
    </section>

    <section class="lk-projects__layout">
      <aside class="lk-projects__sidebar" aria-label="项目方向">
        <div class="lk-projects__sidebar-card">
          <p class="lk-projects__sidebar-kicker">方向筛选</p>
          <div class="lk-projects__role-list">
            <button
              v-for="group in projectGroups"
              :key="group.id"
              type="button"
              class="lk-projects__role-button"
              :class="{ 'is-active': activeRole === group.id }"
              @click="activeRole = group.id"
            >
              <span class="lk-projects__role-name">{{ group.name }}</span>
              <span class="lk-projects__role-total">{{ group.projects.length }}</span>
            </button>
          </div>
        </div>

        <div class="lk-projects__sidebar-card">
          <p class="lk-projects__sidebar-kicker">{{ activeGroup.name }}</p>
          <div class="lk-projects__label-cloud">
            <span
              v-for="label in activeGroup.labels"
              :key="label"
              class="lk-projects__label-pill"
            >
              {{ label }}
            </span>
          </div>
        </div>
      </aside>

      <section class="lk-projects__content">
        <header class="lk-projects__section-head">
          <div>
            <p class="lk-projects__section-kicker">{{ activeGroup.name }}</p>
            <h2 class="lk-projects__section-title">{{ activeGroup.name }}项目</h2>
          </div>
          <p class="lk-projects__section-summary">{{ activeGroup.summary }}</p>
        </header>

        <div class="lk-projects__cards">
          <article
            v-for="project in activeGroup.projects"
            :key="project.id"
            class="lk-projects__card"
          >
            <div class="lk-projects__card-head">
              <div>
                <h3 class="lk-projects__card-title">{{ project.title }}</h3>
                <p class="lk-projects__card-subtitle">{{ project.subtitle }}</p>
              </div>
              <component
                :is="linkTag(project)"
                v-bind="linkProps(project)"
                class="lk-projects__card-link"
                >查看</component
              >
            </div>

            <p class="lk-projects__card-description">{{ project.description }}</p>

            <div class="lk-projects__card-tags">
              <span v-for="tag in project.tags" :key="tag" class="lk-projects__card-tag">
                {{ tag }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.lk-projects {
  width: min(1320px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 36px 0 64px;
  color: var(--vp-c-text-1, #111827);
}

.lk-projects__hero {
  position: relative;
  overflow: hidden;
  margin-bottom: 30px;
  padding: 34px 32px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 30px;
  background:
    radial-gradient(circle at top left, rgba(240, 180, 41, 0.22), transparent 30%),
    radial-gradient(circle at top right, rgba(88, 160, 255, 0.18), transparent 34%),
    linear-gradient(145deg, rgba(255, 250, 240, 0.92), rgba(245, 247, 252, 0.98));
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

.lk-projects__hero-copy {
  max-width: 760px;
}

.lk-projects__eyebrow,
.lk-projects__section-kicker,
.lk-projects__sidebar-kicker {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #9a6b11;
}

.lk-projects__title {
  margin: 0;
  font-size: clamp(2.2rem, 4vw, 3.55rem);
  line-height: 1.08;
}

.lk-projects__subtitle {
  max-width: 620px;
  margin: 16px 0 0;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--vp-c-text-2, #4b5563);
}

.lk-projects__hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.lk-projects__hero-meta span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 0.92rem;
  font-weight: 600;
}

.lk-projects__layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.lk-projects__sidebar {
  position: sticky;
  top: calc(var(--navbar-height, 3.5rem) + 20px);
  display: grid;
  gap: 16px;
}

.lk-projects__sidebar-card,
.lk-projects__content,
.lk-projects__card {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
}

.lk-projects__sidebar-card {
  padding: 18px;
}

.lk-projects__role-list {
  display: grid;
  gap: 10px;
}

.lk-projects__role-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.96);
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease;
}

.lk-projects__role-button:hover,
.lk-projects__role-button.is-active {
  transform: translateY(-1px);
  border-color: rgba(215, 159, 38, 0.46);
  background: linear-gradient(135deg, rgba(255, 232, 173, 0.72), rgba(255, 255, 255, 0.94));
  box-shadow: 0 14px 28px rgba(215, 159, 38, 0.14);
}

.lk-projects__role-name {
  font-size: 0.96rem;
  font-weight: 700;
}

.lk-projects__role-total {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  font-size: 0.8rem;
  font-weight: 700;
}

.lk-projects__label-cloud,
.lk-projects__card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.lk-projects__label-pill,
.lk-projects__card-tag {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(255, 244, 214, 0.9);
  border: 1px solid rgba(215, 159, 38, 0.26);
  color: #7c5600;
  font-size: 0.82rem;
  font-weight: 600;
}

.lk-projects__content {
  padding: 22px;
}

.lk-projects__section-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 420px);
  gap: 18px;
  align-items: start;
  margin-bottom: 20px;
}

.lk-projects__section-title {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.2rem);
  line-height: 1.15;
}

.lk-projects__section-summary {
  margin: 26px 0 0;
  font-size: 0.96rem;
  line-height: 1.75;
  color: var(--vp-c-text-2, #4b5563);
}

.lk-projects__cards {
  display: grid;
  gap: 18px;
}

.lk-projects__card {
  padding: 20px;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.lk-projects__card:hover {
  transform: translateY(-2px);
  border-color: rgba(215, 159, 38, 0.34);
  box-shadow: 0 26px 48px rgba(15, 23, 42, 0.09);
}

.lk-projects__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.lk-projects__card-title {
  margin: 0;
  font-size: 1.28rem;
  line-height: 1.25;
}

.lk-projects__card-subtitle {
  margin: 8px 0 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--vp-c-text-2, #6b7280);
}

.lk-projects__card-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 78px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  text-decoration: none;
  font-size: 0.88rem;
  font-weight: 700;
  transition:
    transform 0.22s ease,
    background 0.22s ease,
    color 0.22s ease;
}

.lk-projects__card-link:hover {
  transform: translateY(-1px);
  background: #d79f26;
  color: #1f1600;
  text-decoration: none;
}

.lk-projects__card-link,
.lk-projects__card-link:hover,
.lk-projects__card-link:focus,
.lk-projects__card-link:active {
  text-decoration: none !important;
}

.lk-projects__card-description {
  margin: 16px 0 0;
  font-size: 0.95rem;
  line-height: 1.82;
  color: var(--vp-c-text-2, #4b5563);
}

[data-theme='dark'] .lk-projects {
  color: #eef2ff;
}

[data-theme='dark'] .lk-projects__hero {
  border-color: rgba(148, 163, 184, 0.16);
  background:
    radial-gradient(circle at top left, rgba(240, 180, 41, 0.2), transparent 30%),
    radial-gradient(circle at top right, rgba(88, 160, 255, 0.18), transparent 34%),
    linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(12, 18, 30, 0.98));
  box-shadow: 0 26px 64px rgba(0, 0, 0, 0.34);
}

[data-theme='dark'] .lk-projects__eyebrow,
[data-theme='dark'] .lk-projects__section-kicker,
[data-theme='dark'] .lk-projects__sidebar-kicker {
  color: #f4c95d;
}

[data-theme='dark'] .lk-projects__subtitle,
[data-theme='dark'] .lk-projects__section-summary,
[data-theme='dark'] .lk-projects__card-subtitle,
[data-theme='dark'] .lk-projects__card-description {
  color: rgba(226, 232, 240, 0.78);
}

[data-theme='dark'] .lk-projects__hero-meta span,
[data-theme='dark'] .lk-projects__sidebar-card,
[data-theme='dark'] .lk-projects__content,
[data-theme='dark'] .lk-projects__card {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.9);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.24);
}

[data-theme='dark'] .lk-projects__role-button {
  border-color: rgba(148, 163, 184, 0.12);
  background: rgba(30, 41, 59, 0.9);
}

[data-theme='dark'] .lk-projects__role-button:hover,
[data-theme='dark'] .lk-projects__role-button.is-active {
  border-color: rgba(244, 201, 93, 0.38);
  background: linear-gradient(135deg, rgba(84, 57, 4, 0.66), rgba(30, 41, 59, 0.96));
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.28);
}

[data-theme='dark'] .lk-projects__role-total {
  background: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .lk-projects__label-pill,
[data-theme='dark'] .lk-projects__card-tag {
  background: rgba(109, 76, 0, 0.32);
  border-color: rgba(244, 201, 93, 0.22);
  color: #ffd978;
}

[data-theme='dark'] .lk-projects__card-link {
  background: #f5f7ff;
  color: #101827;
}

[data-theme='dark'] .lk-projects__card-link:hover {
  background: #f4c95d;
  color: #1f1600;
}

@media (max-width: 959px) {
  .lk-projects__layout {
    grid-template-columns: 1fr;
  }

  .lk-projects__sidebar {
    position: static;
    order: 2;
  }

  .lk-projects__content {
    order: 1;
  }

  .lk-projects__section-head {
    grid-template-columns: 1fr;
  }

  .lk-projects__section-summary {
    margin-top: 0;
  }
}

@media (max-width: 719px) {
  .lk-projects {
    width: min(100vw - 20px, 1320px);
    padding: 20px 0 44px;
  }

  .lk-projects__hero,
  .lk-projects__content,
  .lk-projects__sidebar-card,
  .lk-projects__card {
    border-radius: 22px;
  }

  .lk-projects__hero {
    padding: 26px 18px;
  }

  .lk-projects__content,
  .lk-projects__sidebar-card,
  .lk-projects__card {
    padding: 18px;
  }

  .lk-projects__card-head {
    flex-direction: column;
  }
}
</style>
