<template>
  <div
    class="lk-stats"
    :class="{
      'lk-stats--footer': variant === 'footer',
      'lk-stats--embedded': embedded,
    }"
    role="region"
    aria-label="网站信息"
  >
    <div class="lk-stats__head">
      <svg class="lk-stats__head-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M4 14l4-4 4 3 4-6 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="lk-stats__title">网站信息</span>
    </div>

    <ul class="lk-stats__list">
      <li class="lk-stats__row">
        <span class="lk-stats__key">文章数目</span>
        <span class="lk-stats__val">{{ articleCount }}</span>
      </li>
      <li v-if="showVisitorStats" class="lk-stats__row">
        <span class="lk-stats__key">本站访客数</span>
        <span class="lk-stats__val">
          <span
            v-if="!busuanziState.uv && !busuanziState.pollSettled && !busuanziState.loadFailed"
            class="lk-stats__spin"
            aria-label="加载中"
          />
          <template v-else>{{ busuanziState.uv || '—' }}</template>
        </span>
      </li>
      <li v-if="showVisitorStats" class="lk-stats__row">
        <span class="lk-stats__key">本站总浏览量</span>
        <span class="lk-stats__val">
          <span
            v-if="!busuanziState.pv && !busuanziState.pollSettled && !busuanziState.loadFailed"
            class="lk-stats__spin"
            aria-label="加载中"
          />
          <template v-else>{{ busuanziState.pv || '—' }}</template>
        </span>
      </li>
      <li class="lk-stats__row">
        <span class="lk-stats__key">最后更新时间</span>
        <span class="lk-stats__val lk-stats__val--muted" data-lk-no-translate>{{ lastUpdateRelative }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { busuanziState, ensureBusuanzi } from '../utils/busuanziClient.js'
import { readVisitorStatsEnabled, VISITOR_STATS_EVENT } from '../utils/visitorStatsPref.js'
import { formatRelativeTime } from '../utils/relativeTimeZh.js'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'

defineProps({
  /** sidebar: 与 Profile 同系深色面板；footer: 页脚浅色紧凑块 */
  variant: {
    type: String,
    default: 'sidebar',
    validator: (v) => v === 'sidebar' || v === 'footer',
  },
  /** 嵌入侧栏控制面板：扁平、全宽 */
  embedded: { type: Boolean, default: false },
})

const articleCount = __LK_ARTICLE_COUNT__
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

<style scoped>
/* 与 ProfileCard 同系的深色玻璃面板，无阴影，侧栏窄宽度下纵向排布 */
.lk-stats {
  width: 100%;
  max-width: 260px;
  padding: 18px 16px 16px;
  background: linear-gradient(
    160deg,
    rgba(12, 18, 52, 0.82) 0%,
    rgba(48, 18, 72, 0.8) 100%
  );
  backdrop-filter: blur(22px) saturate(1.6);
  -webkit-backdrop-filter: blur(22px) saturate(1.6);
  border: 1px solid rgba(180, 140, 255, 0.28);
  border-radius: 24px;
  color: rgba(230, 235, 255, 0.92);
}

.lk-stats--embedded {
  max-width: 100%;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  color: #0f172a;
}

.lk-stats--embedded .lk-stats__head {
  border-bottom-color: rgba(148, 163, 184, 0.35);
}

.lk-stats--embedded .lk-stats__head-icon {
  color: #4a90d9;
}

.lk-stats--embedded .lk-stats__title {
  color: #0f172a;
}

.lk-stats--embedded .lk-stats__row + .lk-stats__row {
  border-top-color: rgba(148, 163, 184, 0.25);
}

.lk-stats--embedded .lk-stats__key {
  color: #64748b;
}

.lk-stats--embedded .lk-stats__val {
  color: #0f172a;
}

.lk-stats--embedded .lk-stats__val--muted {
  color: #475569;
}

.lk-stats--embedded .lk-stats__spin {
  border-color: rgba(74, 144, 217, 0.35);
  border-top-color: #4a90d9;
}

.lk-stats__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(180, 140, 255, 0.22);
}

.lk-stats__head-icon {
  color: #93c5fd;
  flex-shrink: 0;
}

.lk-stats__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.02em;
}

.lk-stats__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.lk-stats__row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: 0.75rem;
  line-height: 1.35;
  padding: 8px 0;
}

.lk-stats__row + .lk-stats__row {
  border-top: 1px solid rgba(180, 140, 255, 0.14);
}

.lk-stats__key {
  color: rgba(196, 181, 253, 0.85);
  font-weight: 500;
}

.lk-stats__key::after {
  content: none;
}

.lk-stats__val {
  font-weight: 700;
  color: #fff;
  min-height: 1.15em;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 0.9rem;
}

.lk-stats__val--muted {
  font-weight: 500;
  color: rgba(200, 210, 255, 0.78);
  font-size: 0.78rem;
  line-height: 1.4;
}

.lk-stats__spin {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(147, 197, 253, 0.35);
  border-top-color: #93c5fd;
  border-radius: 50%;
  animation: lk-stats-spin 0.7s linear infinite;
}

@keyframes lk-stats-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Dark mode: match ProfileCard embedded palette for sidebar embedded */
[data-theme='dark'] .lk-stats--embedded {
  background: rgba(15, 23, 42, 0.62) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  color: rgba(226, 232, 240, 0.98) !important;
  box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__head {
  border-bottom-color: rgba(148, 163, 184, 0.35) !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__head-icon {
  color: #93c5fd !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__title {
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__key {
  color: rgba(196, 181, 253, 0.95) !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__val {
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-stats--embedded .lk-stats__val--muted {
  color: rgba(148, 163, 184, 0.98) !important;
}

/* 页脚：流式布局、浅色、无阴影，与返回顶部按钮错开由外层 padding 负责 */
.lk-stats--footer {
  max-width: 260px;
  width: auto;
  margin: 0;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  color: #334155;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.lk-stats--footer .lk-stats__head {
  border-bottom-color: rgba(15, 23, 42, 0.08);
  margin-bottom: 8px;
  padding-bottom: 8px;
}

.lk-stats--footer .lk-stats__head-icon {
  color: #4a90d9;
}

.lk-stats--footer .lk-stats__title {
  color: #1e293b;
  font-size: 0.82rem;
}

.lk-stats--footer .lk-stats__row {
  padding: 6px 0;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
}

.lk-stats--footer .lk-stats__row + .lk-stats__row {
  border-top-color: rgba(15, 23, 42, 0.06);
}

.lk-stats--footer .lk-stats__key {
  color: #64748b;
  font-size: 0.72rem;
}

.lk-stats--footer .lk-stats__key::after {
  content: none;
}

.lk-stats--footer .lk-stats__val {
  color: #0f172a;
  font-size: 0.8rem;
  justify-content: flex-end;
}

.lk-stats--footer .lk-stats__val--muted {
  color: #475569;
  font-size: 0.72rem;
  text-align: right;
  max-width: 100%;
}

.lk-stats--footer .lk-stats__spin {
  border-color: rgba(74, 144, 217, 0.35);
  border-top-color: #4a90d9;
}
</style>
