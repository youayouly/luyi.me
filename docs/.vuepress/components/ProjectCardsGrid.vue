<template>
  <section class="lk-proj-cards" aria-label="Projects list cards">
    <div class="lk-proj-cards__grid">
      <RouterLink
        v-for="item in visibleItems"
        :key="item.title"
        :to="item.to"
        class="lk-proj-card"
        :aria-label="`${item.title}。${item.summary}`"
      >
        <img v-if="item.cover" class="lk-proj-card__bg" :src="item.cover" alt="" aria-hidden="true" />
        <div class="lk-proj-card__body">
          <header class="lk-proj-card__top">
            <div class="lk-proj-card__heading">
              <span class="lk-proj-card__role">{{ item.role }}</span>
              <h3 class="lk-proj-card__title">{{ item.title }}</h3>
            </div>
            <span class="lk-proj-card__arrow" aria-hidden="true">↗</span>
          </header>

          <div class="lk-proj-card__bottom">
            <span class="lk-proj-card__tag">{{ item.tag }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <div v-if="filteredItems.length === 0" class="lk-proj-cards__empty">
      当前筛选下还没有项目。
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { projectItems, itemsAfterRole, applySort } from '../data/projectsCatalog.js'
import { useProjectsHub, syncHubRoleFromRoute } from '../composables/useProjectsHub.js'

const route = useRoute()
const hub = useProjectsHub()

const filteredItems = computed(() => itemsAfterRole(projectItems, hub.currentRole))

/** 无侧栏排序时固定：按更新时间从新到旧 */
const visibleItems = computed(() => applySort(filteredItems.value, 'recent'))

onMounted(() => {
  syncHubRoleFromRoute(route)
})

watch(
  () => route.query.role,
  () => {
    syncHubRoleFromRoute(route)
  },
)
</script>

<style scoped>
.lk-proj-cards {
  padding: 0.25rem 0 1.25rem;
}

.lk-proj-cards__grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.lk-proj-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 168px;
  border: 1px solid rgba(33, 37, 41, 0.10);
  border-radius: 18px;
  color: rgba(241, 245, 249, 0.96);
  box-shadow: 0 2px 16px rgba(2, 6, 23, 0.18);
  transition:
    transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
    box-shadow 0.22s ease-out,
    border-color 0.22s ease-out;
  text-decoration: none;
}

.lk-proj-card__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  /* 略提亮，减少「发灰发脏」感 */
  filter: saturate(0.82) brightness(0.94) contrast(1.04);
  transition: filter 0.28s ease-out;
}

.lk-proj-card:hover .lk-proj-card__bg {
  filter: saturate(0.95) brightness(0.98) contrast(1.05);
}

.lk-proj-card__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 168px;
  padding: 1.35rem 1.5rem 1.25rem;
}

.lk-proj-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.lk-proj-card__heading {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.lk-proj-card__role {
  color: #ecfeff;
  font-size: 0.74rem;
  font-weight: 780;
  line-height: 1.35;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.72);
}

.lk-proj-card__title {
  color: #ffffff;
  font-size: 1.36rem;
  font-weight: 860;
  line-height: 1.22;
  margin: 0;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.82);
}

.lk-proj-card__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #0f172a;
  font-size: 1.5rem;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  flex-shrink: 0;
  transition:
    transform 0.32s cubic-bezier(0.2, 0.7, 0.2, 1),
    background 0.22s ease-out,
    color 0.22s ease-out,
    box-shadow 0.22s ease-out;
}

/* hover：箭头微动 + 颜色反转（与 article 卡片箭头方向一致：↗ → 强调态） */
.lk-proj-card:hover .lk-proj-card__arrow {
  transform: translate(3px, -3px) scale(1.05);
  background: var(--lk-accent-strong, #111827);
  color: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.32);
}

.lk-proj-card__bottom {
  display: flex;
  align-items: flex-end;
  margin-top: auto;
  padding-top: 0.25rem;
}

.lk-proj-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.34rem 0.8rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #334155;
  font-size: 0.78rem;
  font-weight: 760;
  line-height: 1;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.16);
}

.lk-proj-card:hover {
  transform: translateY(-3px);
  border-color: rgba(33, 37, 41, 0.32);
  box-shadow: 0 14px 34px rgba(2, 6, 23, 0.32);
}

.lk-proj-card,
.lk-proj-card:hover,
.lk-proj-card:focus,
.lk-proj-card:active,
.lk-proj-card *,
.lk-proj-card *:hover,
.lk-proj-card *:focus,
.lk-proj-card *:active {
  text-decoration: none !important;
  -webkit-text-decoration: none !important;
}

.lk-proj-cards__empty {
  padding: 3rem 2rem;
  text-align: center;
  color: rgba(203, 213, 225, 0.86);
  font-size: 0.95rem;
  background: rgba(30, 41, 59, 0.38);
  border: 2px dashed rgba(148, 163, 184, 0.32);
  border-radius: 12px;
  margin-top: 1rem;
}

@media (max-width: 719px) {
  .lk-proj-card__body {
    padding: 1.1rem;
  }

  .lk-proj-card__title {
    font-size: 1.12rem;
  }

  .lk-proj-card__arrow {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.25rem;
  }
}

[data-theme='light'] .lk-proj-card {
  border-color: rgba(15, 23, 42, 0.12);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

[data-theme='light'] .lk-proj-card:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}
</style>
