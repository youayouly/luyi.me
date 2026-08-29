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

const rows = computed(() =>
  [...timelineItems].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10),
)
</script>

<template>
  <div class="lk-about-timeline">
    <h3 class="lk-about-timeline__heading">动态时间线</h3>
    <ul class="lk-about-timeline__list">
      <li v-for="(row, i) in rows" :key="i" class="lk-about-timeline__item">
        <time class="lk-about-timeline__date" :datetime="row.date">{{ row.date }}</time>
        <component
          :is="linkTag(row)"
          v-if="row.href"
          v-bind="linkProps(row)"
          class="lk-about-timeline__title"
          >{{ row.title }}</component
        >
        <span v-else class="lk-about-timeline__title lk-about-timeline__title--plain">{{ row.title }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/*
 * 简化版：不要连接线 + 圆点 + 分类色块，改成「一张卡片、逐行日期+标题」，
 * 参照常见博客的「更新日志」侧栏做法。旧版每条都是独立小卡片、靠竖线串起来，
 * 条目一多线和点反而显得杂乱。
 */
.lk-about-timeline {
  position: relative;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0.9rem 1rem 0.6rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
}

.lk-about-timeline__heading {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: #000;
  letter-spacing: 0.05em;
  text-align: left;
}

.lk-about-timeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lk-about-timeline__item {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  padding: 0.55rem 0;
  min-width: 0;
  border-top: 1px solid rgba(33, 37, 41, 0.08);
}

.lk-about-timeline__item:first-child {
  padding-top: 0.1rem;
  border-top: none;
}

.lk-about-timeline__date {
  font-size: 0.68rem;
  color: rgba(33, 37, 41, 0.55);
  font-family: var(--lk-font-mono, monospace);
}

.lk-about-timeline__title {
  display: block;
  width: 100%;
  font-size: 0.84rem;
  font-weight: 700;
  color: #000;
  text-decoration: none;
  line-height: 1.45;
  /* 长标题强制断行（中英文混排 + URL 风格 token 都会 wrap） */
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
  transition: color 0.18s ease-out;
}

.lk-about-timeline__title:hover {
  color: var(--vp-c-brand-1, #6d28d9);
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

.lk-about-timeline__title--plain:hover {
  color: #000;
}

[data-theme='dark'] .lk-about-timeline {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(222, 226, 230, 0.16);
}

[data-theme='dark'] .lk-about-timeline__heading,
[data-theme='dark'] .lk-about-timeline__title {
  color: #fff;
}

[data-theme='dark'] .lk-about-timeline__title--plain:hover {
  color: #fff;
}

[data-theme='dark'] .lk-about-timeline__title:hover {
  color: #c4b5fd;
}

[data-theme='dark'] .lk-about-timeline__date {
  color: rgba(226, 232, 240, 0.6);
}

[data-theme='dark'] .lk-about-timeline__item {
  border-top-color: rgba(222, 226, 230, 0.14);
}
</style>
