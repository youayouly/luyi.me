<script setup>
/**
 * 侧栏「我 star 的仓库」卡片：与 FriendLinks / NoticeCard / SiteStatsCard 视觉统一。
 *
 * 数据来自 `npm run sync:stars` 生成的静态文件，**没有运行时请求**——
 * 这样节点在 SSR 输出里就存在，`pretranslate.mjs` 能扫到中文 description
 * 并进翻译词典；运行时 fetch 插入的节点会漏掉整套 i18n 流水线。
 */
import { computed } from 'vue'
import { starredRepos } from '../data/starredRepos.generated.js'
import { siteConfig } from '../site.config.js'

const props = defineProps({
  /** 最多显示几条；生成文件里可能比这多 */
  limit: { type: Number, default: 6 },
})

const allUrl = `https://github.com/${siteConfig.author.github}?tab=stars`
/** 本站自己的开源仓库，卡片底部 CTA 指向它 */
const repoUrl = siteConfig.repo ? `https://github.com/${siteConfig.repo}` : ''

const items = computed(() => starredRepos.slice(0, props.limit))

/** 12k / 1.4k / 980 —— 与 GitHub 自己的写法一致 */
function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`.replace('.0k', 'k')
  return String(n)
}

/** 语言色点：只覆盖常见几种，其余走中性色 */
const LANG_COLOR = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Vue: '#41b883',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
}
function langColor(lang) {
  return LANG_COLOR[lang] || '#94a3b8'
}
</script>

<template>
  <section class="lk-star" aria-label="我 star 的仓库">
    <h2 class="lk-star__title">
      ⭐ 我的 Star
      <a
        class="lk-star__all"
        :href="allUrl"
        target="_blank"
        rel="noopener noreferrer"
        title="在 GitHub 上查看全部"
      >全部</a>
    </h2>

    <p v-if="!items.length" class="lk-star__empty">暂无数据，运行 npm run sync:stars 生成</p>

    <ul v-else class="lk-star__list">
      <li v-for="r in items" :key="r.id">
        <a
          class="lk-star__row"
          :href="r.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="r.fullName"
        >
          <span class="lk-star__head">
            <span class="lk-star__name">{{ r.name }}</span>
            <span class="lk-star__count" aria-hidden="true">★ {{ formatStars(r.stars) }}</span>
          </span>
          <span v-if="r.desc" class="lk-star__desc">{{ r.desc }}</span>
          <span v-if="r.language" class="lk-star__lang">
            <span
              class="lk-star__dot"
              :style="{ background: langColor(r.language) }"
              aria-hidden="true"
            />
            {{ r.language }}
          </span>
        </a>
      </li>
    </ul>

    <a
      v-if="repoUrl"
      class="lk-star__cta"
      :href="repoUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="lk-star__cta-icon" aria-hidden="true">⭐</span>
      <span class="lk-star__cta-text">本站已开源，去点个 Star</span>
      <span class="lk-star__cta-arrow" aria-hidden="true">→</span>
    </a>
  </section>
</template>

<style scoped lang="scss">
.lk-star {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 16px;
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  box-shadow:
    0 2px 12px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  color: #0f172a;
}

.lk-star__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  padding-bottom: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.lk-star__all {
  flex: none;
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.5);
  text-decoration: none;

  &:hover {
    color: var(--vp-c-brand-1, #6d28d9);
  }
}

.lk-star__empty {
  margin: 0;
  font-size: 0.78rem;
  color: rgba(15, 23, 42, 0.55);
}

.lk-star__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lk-star__row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    background: rgba(109, 40, 217, 0.06);
    border-color: rgba(109, 40, 217, 0.16);
  }
}

.lk-star__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.lk-star__name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.3;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lk-star__count {
  flex: none;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: rgba(15, 23, 42, 0.5);
}

/* 两行截断：描述长短不一，不裁的话卡片高度会跳 */
.lk-star__desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 0.75rem;
  line-height: 1.45;
  color: rgba(15, 23, 42, 0.62);
}

.lk-star__lang {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: rgba(15, 23, 42, 0.5);
}

.lk-star__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

/* 底部 CTA：与列表用一条分隔线断开，避免被当成第 7 条 star */
.lk-star__cta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 9px 10px;
  border: 1px solid rgba(109, 40, 217, 0.2);
  border-radius: 10px;
  background: rgba(109, 40, 217, 0.06);
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b21b6;
  text-decoration: none;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    background: rgba(109, 40, 217, 0.12);
    border-color: rgba(109, 40, 217, 0.34);
  }
}

.lk-star__cta-text {
  flex: 1;
  min-width: 0;
}

.lk-star__cta-arrow {
  flex: none;
  transition: transform 0.18s ease;
}

.lk-star__cta:hover .lk-star__cta-arrow {
  transform: translateX(3px);
}

[data-theme='dark'] .lk-star__cta {
  background: rgba(109, 40, 217, 0.22);
  border-color: rgba(180, 140, 255, 0.34);
  color: #ddd6fe;

  &:hover {
    background: rgba(124, 58, 237, 0.34);
    border-color: rgba(196, 181, 253, 0.5);
  }
}

[data-theme='dark'] .lk-star {
  background: linear-gradient(
    160deg,
    rgba(12, 18, 52, 0.82) 0%,
    rgba(48, 18, 72, 0.8) 100%
  );
  border-color: rgba(180, 140, 255, 0.28);
  color: rgba(230, 235, 255, 0.92);
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
[data-theme='dark'] .lk-star__title {
  color: #fff;
  border-bottom-color: rgba(180, 140, 255, 0.22);
}
[data-theme='dark'] .lk-star__all {
  color: rgba(226, 232, 240, 0.6);

  &:hover {
    color: #c4b5fd;
  }
}
[data-theme='dark'] .lk-star__empty {
  color: rgba(226, 232, 240, 0.62);
}
[data-theme='dark'] .lk-star__row:hover {
  background: rgba(49, 46, 129, 0.35);
  border-color: rgba(196, 181, 253, 0.35);
}
[data-theme='dark'] .lk-star__name {
  color: #f1f5f9;
}
[data-theme='dark'] .lk-star__count,
[data-theme='dark'] .lk-star__lang {
  color: rgba(226, 232, 240, 0.55);
}
[data-theme='dark'] .lk-star__desc {
  color: rgba(226, 232, 240, 0.7);
}
</style>
