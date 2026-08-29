<script setup>
/**
 * 侧栏「友链」卡片：与 NoticeCard / SiteStatsCard 视觉风格统一。
 * 当前默认无邀请占位卡；空时只显示一行简短文案，保持卡片轻量。
 */
import { computed } from 'vue'
import { friendLinks } from '../data/friendLinks.js'

const links = computed(() =>
  friendLinks.map((f) => ({
    ...f,
    initial: (f.name || '?').trim().charAt(0),
  })),
)
</script>

<template>
  <section class="lk-fl" aria-label="友链">
    <h2 class="lk-fl__title">🔗 友链</h2>
    <p v-if="!links.length" class="lk-fl__empty">暂无友链</p>
    <ul v-else class="lk-fl__list">
      <li v-for="f in links" :key="f.id">
        <a
          class="lk-fl__row"
          :href="f.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="`访问 ${f.name} 的网站`"
        >
          <span class="lk-fl__avatar" aria-hidden="true">
            <img v-if="f.avatar" :src="f.avatar" :alt="`${f.name} 头像`" />
            <span v-else class="lk-fl__avatar-fallback">{{ f.initial }}</span>
          </span>
          <span class="lk-fl__meta">
            <span class="lk-fl__name">{{ f.name }}</span>
            <span v-if="f.desc" class="lk-fl__desc">{{ f.desc }}</span>
          </span>
        </a>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.lk-fl {
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

[data-theme='dark'] .lk-fl {
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

.lk-fl__title {
  margin: 0 0 10px;
  padding-bottom: 8px;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0f172a;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
}

[data-theme='dark'] .lk-fl__title {
  color: #fff;
  border-bottom-color: rgba(180, 140, 255, 0.22);
}

.lk-fl__empty {
  margin: 0.4rem 0 0.2rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: rgba(15, 23, 42, 0.58);
}

[data-theme='dark'] .lk-fl__empty {
  color: rgba(226, 232, 240, 0.62);
}

.lk-fl__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lk-fl__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.45rem;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.lk-fl__row:hover {
  background: rgba(245, 243, 255, 0.85);
  border-color: rgba(124, 58, 237, 0.3);
}

[data-theme='dark'] .lk-fl__row:hover {
  background: rgba(49, 46, 129, 0.35);
  border-color: rgba(196, 181, 253, 0.35);
}

.lk-fl__avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #ede9fe 0%, #c4b5fd 100%);
  color: #4c1d95;
  font-size: 0.85rem;
  font-weight: 800;
}

[data-theme='dark'] .lk-fl__avatar {
  background: linear-gradient(145deg, rgba(76, 29, 149, 0.55) 0%, rgba(30, 41, 59, 0.85) 100%);
  color: #e9d5ff;
}

.lk-fl__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.lk-fl__meta {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.lk-fl__name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-theme='dark'] .lk-fl__name {
  color: #f1f5f9;
}

.lk-fl__desc {
  font-size: 0.68rem;
  color: rgba(15, 23, 42, 0.58);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-theme='dark'] .lk-fl__desc {
  color: rgba(226, 232, 240, 0.66);
}
</style>
