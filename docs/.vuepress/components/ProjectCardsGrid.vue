<template>
  <section class="lk-proj-cards" aria-label="Projects list cards">
    <div class="lk-proj-cards__body">
      <div class="lk-proj-cards__grid">
        <div
          v-for="(item, idx) in pagedItems"
          :key="item.title"
          class="lk-proj-cards__item"
        >
          <RouterLink
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

          <!-- 浮动分页：叠在最后一张卡片正中间，跟着列表滚动。是卡片（RouterLink）的兄弟
               节点而非子节点——按钮嵌进链接里会点哪儿都触发跳转。position:absolute 相对
               它俩共同的父级 .lk-proj-cards__item 定位，跟随卡片的实际高度居中，不用给卡片
               高度猜一个固定的负 margin。 -->
          <nav
            v-if="totalPages > 1 && idx === pagedItems.length - 1"
            class="lk-proj-cards__pager"
            aria-label="Projects pagination"
          >
            <button
              v-for="page in totalPages"
              :key="page"
              type="button"
              class="lk-proj-cards__pager-button"
              :class="{ 'is-active': page === currentPage }"
              :aria-current="page === currentPage ? 'page' : undefined"
              @click="currentPage = page"
            >
              {{ page }}
            </button>
          </nav>
        </div>
      </div>
    </div>

    <div v-if="filteredItems.length === 0" class="lk-proj-cards__empty">
      当前筛选下还没有项目。
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { projectItems, itemsAfterRole, applySort } from '../data/projectsCatalog.js'
import { useProjectsHub, syncHubRoleFromRoute } from '../composables/useProjectsHub.js'

const PAGE_SIZE = 4

const route = useRoute()
const hub = useProjectsHub()

const filteredItems = computed(() => itemsAfterRole(projectItems, hub.currentRole))

/** 无侧栏排序时固定：按更新时间从新到旧 */
const visibleItems = computed(() => applySort(filteredItems.value, 'recent'))

const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(visibleItems.value.length / PAGE_SIZE)))
const pagedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return visibleItems.value.slice(start, start + PAGE_SIZE)
})

watch(filteredItems, () => {
  currentPage.value = 1
})

watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

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
  /* 底部不留 padding：右列卡片列表要跟左侧 AI 助手栏（拉伸到同一 grid row 高度）
     视觉上齐平收尾，padding 会在两栏底边之间掺进一段只属于右栏的空隙，让 AI 助手
     卡片看起来比最后一张项目卡「多探出去一截」。整段的底部呼吸感改由
     .lk-proj-hub-fullbleed 的 padding-bottom 统一提供，两栏共享同一段留白。 */
  padding: 0.25rem 0 0;
}

.lk-proj-cards__body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.lk-proj-cards__grid {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  width: 100%;
}

.lk-proj-cards__item {
  position: relative;
}

/* 分页：贴在最后一张卡片底边、横向居中，视觉上嵌在卡片里面，不是列表下面另起一行。
   position:absolute 相对 .lk-proj-cards__item（卡片和分页共同的父级）定位，bottom 量的是
   item 自己的框，卡片高度变了不用跟着改数字。卡片 hover 时会 translateY(-3px) 上浮，但那是
   卡片自己的 transform、不影响这个绝对定位的兄弟节点——不跟着一起浮，底边间距就会在 hover
   时被吃掉，分页视觉上探出卡片下边缘。所以 hover 态在 item 上再镜像同一个位移，让分页跟卡片
   同步浮起。 */
.lk-proj-cards__pager {
  position: absolute;
  z-index: 5;
  left: 50%;
  bottom: 0.9rem;
  transform: translateX(-50%);
  transition: transform 0.2s ease;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.lk-proj-cards__item:hover .lk-proj-cards__pager {
  transform: translate(-50%, -3px);
}

.lk-proj-cards__pager-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(30, 41, 59, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.35);
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.lk-proj-cards__pager-button:hover {
  background: rgba(51, 65, 85, 0.75);
  transform: translateY(-1px);
}

.lk-proj-cards__pager-button.is-active {
  color: #fff;
  background: var(--lk-accent-strong, #111827);
  border-color: transparent;
  cursor: default;
}

[data-theme='light'] .lk-proj-cards__pager-button {
  color: #334155;
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(15, 23, 42, 0.12);
}

[data-theme='light'] .lk-proj-cards__pager-button.is-active {
  color: #fff;
  background: var(--lk-accent-strong, #111827);
}

.lk-proj-card {
  /* 卡片以前是 .lk-proj-cards__grid 的直接 flex 子级，flex 布局会自动把 <a> 从行内
     block 化；现在套了一层 .lk-proj-cards__item 做分页的定位容器，<a> 不再是 flex
     子级，必须显式声明 block，否则退回 <a> 默认的 inline，背景图/overflow 都会跟着错位。 */
  display: block;
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
