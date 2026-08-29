<template>
  <nav class="lk-pm-nav" aria-label="作品集与内容入口">
    <div class="lk-pm-nav__card">
      <div class="lk-pm-nav__meta">
        <p class="lk-pm-nav__name">Luke</p>
        <p class="lk-pm-nav__tagline">AI + Embedded PM</p>
      </div>
      <ul class="lk-pm-nav__list" role="list">
        <li>
          <RouterLink class="lk-pm-nav__btn" :to="{ path: '/tech/', query: { role: 'all' } }">
            查看全部项目
          </RouterLink>
        </li>
        <li>
          <RouterLink class="lk-pm-nav__btn" to="/article/pm-portfolio-prd.html">PRD合集</RouterLink>
        </li>
        <li>
          <RouterLink class="lk-pm-nav__btn" to="/article/">技术博客</RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>

<style scoped>
.lk-pm-nav {
  width: 100%;
  max-width: 280px;
  box-sizing: border-box;
}

.lk-pm-nav__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 14px 16px;
  border-radius: 12px;
  box-sizing: border-box;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.42);
}

[data-theme='light'] .lk-pm-nav__card {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(15, 23, 42, 0.1);
}

.lk-pm-nav__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.lk-pm-nav__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

[data-theme='light'] .lk-pm-nav__name {
  color: #0f172a;
}

.lk-pm-nav__tagline {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.35;
  color: rgba(226, 232, 240, 0.78);
}

[data-theme='light'] .lk-pm-nav__tagline {
  color: #64748b;
}

.lk-pm-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lk-pm-nav__btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(30, 41, 59, 0.4);
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

[data-theme='light'] .lk-pm-nav__btn {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.6);
  border-color: rgba(15, 23, 42, 0.08);
}

.lk-pm-nav__btn:hover {
  border-color: rgba(125, 211, 252, 0.4);
  background: rgba(30, 41, 59, 0.58);
  text-decoration: none;
}

[data-theme='light'] .lk-pm-nav__btn:hover {
  background: rgba(248, 250, 252, 0.98);
}

.lk-pm-nav__btn:focus-visible {
  outline: 2px solid rgba(125, 211, 252, 0.75);
  outline-offset: 2px;
}

.lk-pm-nav__btn,
.lk-pm-nav__btn:hover,
.lk-pm-nav__btn:focus,
.lk-pm-nav__btn:active {
  text-decoration: none !important;
}

@media (max-width: 959px) {
  .lk-pm-nav {
    max-width: none;
  }
}
</style>
