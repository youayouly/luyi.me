<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ARTICLE_CATEGORIES } from '../data/articleCategories.js'
import { busuanziState, ensureBusuanzi } from '../utils/busuanziClient.js'
import { readVisitorStatsEnabled, VISITOR_STATS_EVENT } from '../utils/visitorStatsPref.js'
import { formatRelativeTime } from '../utils/relativeTimeZh.js'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'

const articleCount = __LK_ARTICLE_COUNT__
const techCount = __LK_TECH_COUNT__
const buildTimeIso = __LK_BUILD_TIME_ISO__

/* 每分钟都在变的字符串，走翻译 API 只会白烧配额，所以按语言直接拼，
 * 对应节点带 data-lk-no-translate。 */
const lastUpdateRelative = computed(() =>
  formatRelativeTime(buildTimeIso, pageLang.value !== SOURCE_LANG),
)
const showVisitorStats = ref(readVisitorStatsEnabled())

onMounted(() => {
  if (showVisitorStats.value) ensureBusuanzi()
  if (typeof window !== 'undefined') {
    window.addEventListener(VISITOR_STATS_EVENT, () => {
      showVisitorStats.value = readVisitorStatsEnabled()
      if (showVisitorStats.value) ensureBusuanzi()
    })
  }
})
</script>

<template>
  <section class="lk-stats-big" aria-label="站点统计">
    <header class="lk-stats-big__head">
      <span class="lk-stats-big__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path
            d="M4 14l4-4 4 3 4-6 4 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <h2 class="lk-stats-big__title">统计</h2>
    </header>

    <ul class="lk-stats-big__metrics" role="list">
      <li class="lk-stats-big__metric">
        <span class="lk-stats-big__metric-key">文章</span>
        <span class="lk-stats-big__metric-val">{{ articleCount }}</span>
        <span class="lk-stats-big__metric-hint">全站 Markdown 篇数（构建时统计）</span>
      </li>
      <li class="lk-stats-big__metric">
        <span class="lk-stats-big__metric-key">项目 / 技术页</span>
        <span class="lk-stats-big__metric-val">{{ techCount }}</span>
        <span class="lk-stats-big__metric-hint">docs/tech 下内容页（不含 README）</span>
      </li>
      <li v-if="showVisitorStats" class="lk-stats-big__metric">
        <span class="lk-stats-big__metric-key">本站访客数</span>
        <span class="lk-stats-big__metric-val">
          <span
            v-if="!busuanziState.uv && !busuanziState.pollSettled && !busuanziState.loadFailed"
            class="lk-stats-big__spin"
            aria-label="加载中"
          />
          <template v-else>{{ busuanziState.uv || '—' }}</template>
        </span>
      </li>
      <li v-if="showVisitorStats" class="lk-stats-big__metric">
        <span class="lk-stats-big__metric-key">总浏览量</span>
        <span class="lk-stats-big__metric-val">
          <span
            v-if="!busuanziState.pv && !busuanziState.pollSettled && !busuanziState.loadFailed"
            class="lk-stats-big__spin"
            aria-label="加载中"
          />
          <template v-else>{{ busuanziState.pv || '—' }}</template>
        </span>
      </li>
      <li class="lk-stats-big__metric lk-stats-big__metric--wide">
        <span class="lk-stats-big__metric-key">最后更新</span>
        <span class="lk-stats-big__metric-val lk-stats-big__metric-val--muted" data-lk-no-translate>{{ lastUpdateRelative }}</span>
      </li>
    </ul>

    <div class="lk-stats-big__cats">
      <h3 class="lk-stats-big__cats-title">主题分类</h3>
      <p class="lk-stats-big__cats-lead">下列为内容导航标签；篇数为栏目维护值，与全站篇数统计口径不同。</p>
      <ul class="lk-stats-big__cats-list">
        <li v-for="(row, i) in ARTICLE_CATEGORIES" :key="i" class="lk-stats-big__cats-item">
          <RouterLink class="lk-stats-big__cats-link" :to="row.to">
            <span class="lk-stats-big__cats-name">{{ row.label }}</span>
            <span class="lk-stats-big__cats-count">{{ row.count }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.lk-stats-big {
  width: 100%;
  min-width: 0;
  padding: 1.1rem 1.15rem 1.2rem;
  border-radius: 22px;
  box-sizing: border-box;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.92) 0%, rgba(239, 246, 255, 0.88) 42%, rgba(224, 242, 254, 0.75) 100%);
  border: 1px solid rgba(59, 130, 246, 0.18);
  box-shadow:
    0 14px 40px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.lk-stats-big__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.28);
}

.lk-stats-big__icon {
  display: flex;
  color: #2563eb;
}

.lk-stats-big__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.lk-stats-big__metrics {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 0.75rem;
}

.lk-stats-big__metric {
  margin: 0;
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.lk-stats-big__metric--wide {
  grid-column: 1 / -1;
}

.lk-stats-big__metric-key {
  font-size: 0.72rem;
  font-weight: 650;
  color: #64748b;
  text-transform: none;
}

.lk-stats-big__metric-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.lk-stats-big__metric-val--muted {
  font-size: 0.95rem;
  font-weight: 650;
  color: #475569;
}

.lk-stats-big__metric-hint {
  font-size: 0.65rem;
  line-height: 1.35;
  color: #94a3b8;
}

.lk-stats-big__spin {
  display: inline-block;
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid rgba(37, 99, 235, 0.25);
  border-top-color: rgba(37, 99, 235, 0.85);
  border-radius: 50%;
  animation: lk-stats-big-spin 0.7s linear infinite;
  vertical-align: -0.15em;
}

@keyframes lk-stats-big-spin {
  to {
    transform: rotate(360deg);
  }
}

.lk-stats-big__cats {
  padding-top: 0.35rem;
  border-top: 1px solid rgba(148, 163, 184, 0.22);
}

.lk-stats-big__cats-title {
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
  font-weight: 750;
  color: #0f172a;
}

.lk-stats-big__cats-lead {
  margin: 0 0 0.55rem;
  font-size: 0.68rem;
  line-height: 1.45;
  color: #64748b;
}

.lk-stats-big__cats-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: min(52vh, 22rem);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.lk-stats-big__cats-item {
  margin: 0;
}

.lk-stats-big__cats-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.38rem 0.45rem;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  font-size: 0.78rem;
}

.lk-stats-big__cats-link:hover {
  background: rgba(59, 130, 246, 0.08);
}

.lk-stats-big__cats-name {
  color: #1d4ed8;
  font-weight: 650;
}

.lk-stats-big__cats-count {
  font-weight: 700;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.35);
  font-size: 0.72rem;
}

[data-theme='dark'] .lk-stats-big {
  background: linear-gradient(165deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%);
  border-color: rgba(125, 211, 252, 0.2);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
}

[data-theme='dark'] .lk-stats-big__title,
[data-theme='dark'] .lk-stats-big__metric-val,
[data-theme='dark'] .lk-stats-big__cats-title {
  color: #f1f5f9;
}

[data-theme='dark'] .lk-stats-big__metric {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(148, 163, 184, 0.2);
}

[data-theme='dark'] .lk-stats-big__cats-name {
  color: #93c5fd;
}
</style>
