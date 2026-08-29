<script setup>
import { RouterLink } from 'vue-router'
import { ARTICLE_CATEGORIES } from '../data/articleCategories.js'

const categories = ARTICLE_CATEGORIES
</script>

<template>
  <div class="lk-about-categories">
    <div class="lk-about-categories__title">分类</div>
    <ul class="lk-about-categories__list">
      <li v-for="(item, i) in categories" :key="i" class="lk-about-categories__item">
        <RouterLink class="lk-about-categories__row" :to="item.to">
          <span class="lk-about-categories__name">{{ item.label }}</span>
          <span class="lk-about-categories__count">{{ item.count }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lk-about-categories {
  position: sticky;
  top: calc(var(--navbar-height, 3.6rem) + 0.75rem);
  padding: 0.85rem 0.95rem 0.95rem 0.65rem;
  margin-left: 0;
  margin-right: 0;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
}

.lk-about-categories__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #0a0a0a;
  margin: 0 0 0.55rem 0.35rem;
}

.lk-about-categories__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lk-about-categories__item {
  margin: 0;
  padding: 0;
}

.lk-about-categories__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.42rem 0.55rem;
  margin: 0.1rem 0;
  border-radius: 8px;
  text-decoration: none;
  color: #0a0a0a;
  font-size: 0.8125rem;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.lk-about-categories__row:hover {
  background: rgba(99, 102, 241, 0.09);
  color: #1d4ed8;
}

.lk-about-categories__row:focus-visible {
  outline: 2px solid rgba(74, 144, 217, 0.55);
  outline-offset: 1px;
}

.lk-about-categories__name {
  flex: 1;
  min-width: 0;
}

.lk-about-categories__count {
  flex-shrink: 0;
  min-width: 1.5rem;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #0a0a0a;
  background: #e5e7eb;
  border-radius: 6px;
  padding: 0.12rem 0.4rem;
}

[data-theme='dark'] .lk-about-categories {
  background: #141414;
  border-color: rgba(248, 250, 252, 0.12);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
}

[data-theme='dark'] .lk-about-categories__title {
  color: #f8fafc;
}

[data-theme='dark'] .lk-about-categories__row {
  color: #f8fafc;
}

[data-theme='dark'] .lk-about-categories__row:hover {
  background: rgba(147, 197, 253, 0.12);
  color: #bfdbfe;
}

[data-theme='dark'] .lk-about-categories__count {
  background: rgba(248, 250, 252, 0.12);
  color: #f1f5f9;
}
</style>
