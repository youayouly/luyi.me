<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { normPath } from '../utils/authGate.js'
import { ARTICLE_CATEGORIES } from '../data/articleCategories.js'

const route = useRoute()

const categories = ARTICLE_CATEGORIES

const showAside = computed(() => {
  const p = normPath(route.path)
  if (!p.startsWith('/article/')) return false
  // 文章区右侧分类卡按需求彻底关闭。
  if (p.startsWith('/article')) return false
  return true
})
</script>

<template>
  <Teleport v-if="showAside" to="body">
    <aside class="lk-article-categories" aria-label="文章分类">
      <div class="lk-article-categories__title">分类</div>
      <ul class="lk-article-categories__list">
        <li v-for="(item, i) in categories" :key="i" class="lk-article-categories__item">
          <RouterLink class="lk-article-categories__link" :to="item.to">
            <span class="lk-article-categories__name">{{ item.label }}</span>
            <span class="lk-article-categories__count">{{ item.count }}</span>
          </RouterLink>
        </li>
      </ul>
    </aside>
  </Teleport>
</template>

<style scoped>
/* Anchored to centered 42rem article column: 50% + half width + gap (matches .page-article-post) */
.lk-article-categories {
  position: fixed;
  z-index: 25;
  top: calc(var(--navbar-height, 3.6rem) + 1rem);
  left: calc(50% + 21rem + 1rem);
  right: auto;
  width: 13.5rem;
  max-height: calc(100vh - var(--navbar-height, 3.6rem) - 2rem);
  overflow-y: auto;
  padding: 0.85rem 0.7rem 0.95rem;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
}

.lk-article-categories__title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #64748b;
  margin: 0 0 0.55rem 0.4rem;
}

.lk-article-categories__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lk-article-categories__item {
  margin: 0;
  padding: 0;
}

.lk-article-categories__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.45rem;
  border-radius: 8px;
  text-decoration: none;
  color: #334155;
  font-size: 0.8125rem;
  line-height: 1.35;
}

.lk-article-categories__link:hover {
  background: rgba(74, 144, 217, 0.08);
  color: #4a90d9;
}

.lk-article-categories__name {
  flex: 1;
  min-width: 0;
}

.lk-article-categories__count {
  flex-shrink: 0;
  min-width: 1.5rem;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #64748b;
  background: #f0f0f0;
  border-radius: 6px;
  padding: 0.12rem 0.4rem;
}

[data-theme='dark'] .lk-article-categories {
  background: var(--vp-c-bg-soft, #1e293b);
  border-color: var(--vp-c-divider, rgba(148, 163, 184, 0.2));
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
}

[data-theme='dark'] .lk-article-categories__title {
  color: var(--vp-c-text-3, #94a3b8);
}

[data-theme='dark'] .lk-article-categories__link {
  color: var(--vp-c-text-2, #cbd5e1);
}

[data-theme='dark'] .lk-article-categories__count {
  background: rgba(148, 163, 184, 0.2);
  color: var(--vp-c-text-3, #94a3b8);
}

@media (max-width: 1280px) {
  .lk-article-categories {
    display: none;
  }
}
</style>
