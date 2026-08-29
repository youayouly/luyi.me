<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { timelineItems } from '../data/aboutArticleFeed.js'

/* 站内跳转走 RouterLink，原生 <a> 的整页重载会让译文闪回中文，见 AboutArticleRecommend。 */
function linkTag(row) {
  return row.external ? 'a' : RouterLink
}

function linkProps(row) {
  return row.external ? { href: row.href } : { to: row.href }
}

/**
 * 按 category 把节点 dot 染上不同色调，长标题挤一团时颜色就是 readable 的"分类索引"。
 * 数据里若额外标 `important: true`，dot 升级为金色 + 双层光晕，强调里程碑事件。
 */
const CATEGORY_TONE = {
  projects: 'projects',
  project: 'projects',
  article: 'article',
  docs: 'docs',
  doc: 'docs',
  release: 'release',
  deploy: 'deploy',
  fix: 'release',
  feature: 'projects',
  ml: 'ml',
  embedded: 'embedded',
}

function toneOf(category) {
  if (!category) return 'default'
  const key = String(category).trim().toLowerCase()
  return CATEGORY_TONE[key] || 'default'
}

const sorted = computed(() =>
  [...timelineItems].sort((a, b) => String(b.date).localeCompare(String(a.date))),
)

function yearOf(d) {
  return String(d).slice(0, 4)
}

const rows = computed(() => {
  let prevYear = ''
  return sorted.value.slice(0, 10).map((item) => {
    const y = yearOf(item.date)
    const showYear = y !== prevYear
    prevYear = y
    return { ...item, showYear, year: y, tone: toneOf(item.category) }
  })
})
</script>

<template>
  <div class="lk-about-timeline">
    <h3 class="lk-about-timeline__heading">动态时间线</h3>
    <ul class="lk-about-timeline__list">
      <li
        v-for="(row, i) in rows"
        :key="i"
        class="lk-about-timeline__item"
        :class="[`is-tone-${row.tone}`, { 'is-important': row.important }]"
      >
        <div class="lk-about-timeline__rail" aria-hidden="true">
          <span class="lk-about-timeline__dot" />
        </div>
        <div class="lk-about-timeline__body">
          <span v-if="row.showYear" class="lk-about-timeline__year">{{ row.year }}</span>
          <time class="lk-about-timeline__date" :datetime="row.date">{{ row.date }}</time>
          <component
            :is="linkTag(row)"
            v-if="row.href"
            v-bind="linkProps(row)"
            class="lk-about-timeline__title"
            >{{ row.title }}</component
          >
          <span v-else class="lk-about-timeline__title lk-about-timeline__title--plain">{{ row.title }}</span>
          <span class="lk-about-timeline__cat" :class="`is-tone-${row.tone}`">{{ row.category }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lk-about-timeline {
  position: relative;
  min-width: 0;
  width: 100%;
  margin-left: 0;
  margin-right: 0;
  --lk-time-rail: rgba(33, 37, 41, 0.18);
  --lk-time-dot: var(--lk-accent, #343A40);
  --lk-time-year-bg: linear-gradient(135deg, #495057 0%, #212529 100%);
  /* 各 category 的色板 */
  --lk-tone-projects: #7c3aed;   /* 紫 */
  --lk-tone-article: #14b8a6;    /* 青 */
  --lk-tone-docs: #3b82f6;       /* 蓝 */
  --lk-tone-release: #ec4899;    /* 玫红 */
  --lk-tone-deploy: #f59e0b;     /* 橙 */
  --lk-tone-ml: #10b981;         /* 绿 */
  --lk-tone-embedded: #06b6d4;   /* 蓝绿 */
  --lk-tone-default: #64748b;    /* 中性灰 */
  --lk-tone-important: #f59e0b;  /* 重要：金色 */
}

.lk-about-timeline__heading {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: #000;
  letter-spacing: 0.05em;
  text-align: left;
}

.lk-about-timeline__list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0.25rem 0 0.25rem 1.5rem;
}

.lk-about-timeline__list::before {
  content: '';
  position: absolute;
  top: 0.35rem;
  bottom: 0.35rem;
  left: 1.7rem;
  width: 2px;
  background: var(--lk-time-rail);
  border-radius: 1px;
}

.lk-about-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 0.45rem;
  align-items: start;
  padding: 0.55rem 0;
  margin-left: 0;
  /* 单行所有元素都 min-width:0 + 强制断行；防止超长中英混排撑破容器右边 */
  min-width: 0;
}

.lk-about-timeline__item:first-child {
  padding-top: 0.15rem;
}

.lk-about-timeline__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 0.32rem;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  padding: 0.6rem 0.75rem 0.66rem;
  border-radius: 12px;
  border: 1px solid rgba(33, 37, 41, 0.10);
  background: rgba(253, 252, 250, 0.9);
  backdrop-filter: blur(8px) saturate(1.1);
  -webkit-backdrop-filter: blur(8px) saturate(1.1);
  /* 长标题强制断行（中英文混排 + URL 风格 token 都会 wrap） */
  word-break: break-word;
  overflow-wrap: anywhere;
  box-sizing: border-box;
  transition:
    background 0.22s ease-out,
    border-color 0.22s ease-out,
    box-shadow 0.22s ease-out,
    backdrop-filter 0.22s ease-out;
}

/* hover：磨砂背景变得更清晰 + 微阴影抬起，文字不变色（克制） */
.lk-about-timeline__item:hover .lk-about-timeline__body {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(33, 37, 41, 0.20);
  box-shadow:
    0 6px 18px rgba(15, 23, 42, 0.08),
    0 1px 3px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(2px) saturate(1.1);
  -webkit-backdrop-filter: blur(2px) saturate(1.1);
}

/* hover 时圆点稍微变实心（额外的物理反馈） */
.lk-about-timeline__item:hover .lk-about-timeline__dot {
  background: var(--lk-time-dot);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-time-dot) 16%, transparent);
}

.lk-about-timeline__year {
  align-self: flex-start;
  margin-bottom: 0.12rem;
  padding: 0.12rem 0.48rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  color: #fff;
  background: var(--lk-time-year-bg);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);
  font-family: var(--lk-font-mono, monospace);
  letter-spacing: 0.02em;
}

.lk-about-timeline__date {
  font-size: 0.68rem;
  color: #000;
}

.lk-about-timeline__title {
  display: block;
  width: 100%;
  font-size: 0.84rem;
  font-weight: 700;
  color: #000;
  text-decoration: none;
  line-height: 1.45;
  /* 多行允许，长 token 内部断行 */
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
  transition: color 0.22s ease-out;
}

/* Light：与卡片浅色底对齐，纯黑字更干净 */
.lk-about-timeline__title:hover {
  color: #000;
  text-decoration: none;
}

.lk-about-timeline__title,
.lk-about-timeline__title:hover,
.lk-about-timeline__title:focus,
.lk-about-timeline__title:active {
  text-decoration: none !important;
}

.lk-about-timeline__title--plain {
  cursor: default;
}

/* 分类标签：按 tone 上色，做"小色块"式的视觉索引 */
.lk-about-timeline__cat {
  align-self: flex-start;
  margin-top: 0.05rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--lk-tone-default);
  background: color-mix(in srgb, var(--lk-tone-default) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--lk-tone-default) 30%, transparent);
}

.lk-about-timeline__cat.is-tone-projects {
  color: var(--lk-tone-projects);
  background: color-mix(in srgb, var(--lk-tone-projects) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-projects) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-article {
  color: var(--lk-tone-article);
  background: color-mix(in srgb, var(--lk-tone-article) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-article) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-docs {
  color: var(--lk-tone-docs);
  background: color-mix(in srgb, var(--lk-tone-docs) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-docs) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-release {
  color: var(--lk-tone-release);
  background: color-mix(in srgb, var(--lk-tone-release) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-release) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-deploy {
  color: var(--lk-tone-deploy);
  background: color-mix(in srgb, var(--lk-tone-deploy) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-deploy) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-ml {
  color: var(--lk-tone-ml);
  background: color-mix(in srgb, var(--lk-tone-ml) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-ml) 35%, transparent);
}
.lk-about-timeline__cat.is-tone-embedded {
  color: var(--lk-tone-embedded);
  background: color-mix(in srgb, var(--lk-tone-embedded) 14%, transparent);
  border-color: color-mix(in srgb, var(--lk-tone-embedded) 35%, transparent);
}

.lk-about-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 1.45rem;
}

.lk-about-timeline__item:first-child .lk-about-timeline__rail {
  padding-top: 1.9rem;
}

.lk-about-timeline__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-bg, #fff);
  border: 2px solid var(--lk-time-dot);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-bg, #fff) 88%, transparent);
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.22s ease;
  z-index: 1;
}

/* 不同 tone 的 dot：边框 = tone 主色，悬停时 dot 实心 + 同色光晕 */
.lk-about-timeline__item.is-tone-projects .lk-about-timeline__dot { border-color: var(--lk-tone-projects); }
.lk-about-timeline__item.is-tone-article  .lk-about-timeline__dot { border-color: var(--lk-tone-article); }
.lk-about-timeline__item.is-tone-docs     .lk-about-timeline__dot { border-color: var(--lk-tone-docs); }
.lk-about-timeline__item.is-tone-release  .lk-about-timeline__dot { border-color: var(--lk-tone-release); }
.lk-about-timeline__item.is-tone-deploy   .lk-about-timeline__dot { border-color: var(--lk-tone-deploy); }
.lk-about-timeline__item.is-tone-ml       .lk-about-timeline__dot { border-color: var(--lk-tone-ml); }
.lk-about-timeline__item.is-tone-embedded .lk-about-timeline__dot { border-color: var(--lk-tone-embedded); }

.lk-about-timeline__item.is-tone-projects:hover .lk-about-timeline__dot { background: var(--lk-tone-projects); box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-projects) 22%, transparent); }
.lk-about-timeline__item.is-tone-article:hover  .lk-about-timeline__dot { background: var(--lk-tone-article);  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-article) 22%, transparent); }
.lk-about-timeline__item.is-tone-docs:hover     .lk-about-timeline__dot { background: var(--lk-tone-docs);     box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-docs) 22%, transparent); }
.lk-about-timeline__item.is-tone-release:hover  .lk-about-timeline__dot { background: var(--lk-tone-release);  box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-release) 22%, transparent); }
.lk-about-timeline__item.is-tone-deploy:hover   .lk-about-timeline__dot { background: var(--lk-tone-deploy);   box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-deploy) 22%, transparent); }
.lk-about-timeline__item.is-tone-ml:hover       .lk-about-timeline__dot { background: var(--lk-tone-ml);       box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-ml) 22%, transparent); }
.lk-about-timeline__item.is-tone-embedded:hover .lk-about-timeline__dot { background: var(--lk-tone-embedded); box-shadow: 0 0 0 4px color-mix(in srgb, var(--lk-tone-embedded) 22%, transparent); }

/* 重要节点：金色双层光晕 + dot 略大，无需 hover 也能一眼看到 */
.lk-about-timeline__item.is-important .lk-about-timeline__dot {
  width: 12px;
  height: 12px;
  background: var(--lk-tone-important);
  border-color: var(--lk-tone-important);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--lk-tone-important) 26%, transparent),
    0 0 0 7px color-mix(in srgb, var(--lk-tone-important) 12%, transparent);
}

[data-theme='dark'] .lk-about-timeline {
  --lk-time-rail: rgba(222, 226, 230, 0.18);
  --lk-time-dot: #DEE2E6;
  --lk-time-year-bg: linear-gradient(135deg, #495057 0%, #ADB5BD 100%);
}

[data-theme='dark'] .lk-about-timeline__heading,
[data-theme='dark'] .lk-about-timeline__title,
[data-theme='dark'] .lk-about-timeline__title:hover,
[data-theme='dark'] .lk-about-timeline__date,
[data-theme='dark'] .lk-about-timeline__cat {
  color: #fff;
}

[data-theme='dark'] .lk-about-timeline__body {
  border-color: rgba(222, 226, 230, 0.10);
  background: rgba(15, 23, 42, 0.86);
}

[data-theme='dark'] .lk-about-timeline__item:hover .lk-about-timeline__body {
  background: rgba(15, 23, 42, 0.94);
  border-color: rgba(222, 226, 230, 0.20);
  box-shadow:
    0 8px 22px rgba(0, 0, 0, 0.35),
    0 1px 3px rgba(0, 0, 0, 0.2);
}

[data-theme='dark'] .lk-about-timeline__item:hover .lk-about-timeline__title {
  color: #fff;
}

/* 黑暗模式下 cat tag 略提亮（保持可读性） */
[data-theme='dark'] .lk-about-timeline__cat {
  filter: brightness(1.15);
}
</style>
