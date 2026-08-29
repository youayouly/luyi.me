<template>
  <section class="lk-notice" :class="{ 'lk-notice--embedded': embedded }" aria-label="站点公告">
    <h2 class="lk-notice__title">📢 公告</h2>
    <ul class="lk-notice__list">
      <li class="lk-notice__item">
        <span class="lk-notice__icon" aria-hidden="true">⚙️</span>
        <span class="lk-notice__text"><strong>框架核心：</strong>VuePress 2</span>
      </li>
      <li class="lk-notice__item">
        <span class="lk-notice__icon" aria-hidden="true">🛡️</span>
        <span class="lk-notice__text"><strong>安全保障：</strong>HTTPS</span>
      </li>
      <li class="lk-notice__item">
        <span class="lk-notice__icon" aria-hidden="true">📼</span>
        <span class="lk-notice__text"><strong>服务器：</strong>Vercel</span>
      </li>
      <li class="lk-notice__item">
        <span class="lk-notice__icon" aria-hidden="true">🎲</span>
        <span class="lk-notice__text"><strong>CDN 加速：</strong>Cloudflare CDN</span>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  embedded: { type: Boolean, default: false },
})
</script>

<style scoped>
.lk-notice {
  width: 100%;
  max-width: 260px;
  padding: 16px 16px 14px;
  background: linear-gradient(
    160deg,
    rgba(12, 18, 52, 0.82) 0%,
    rgba(48, 18, 72, 0.8) 100%
  );
  backdrop-filter: blur(22px) saturate(1.6);
  -webkit-backdrop-filter: blur(22px) saturate(1.6);
  border: 1px solid rgba(180, 140, 255, 0.28);
  border-radius: 24px;
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  color: rgba(230, 235, 255, 0.92);
}

.lk-notice--embedded {
  max-width: 100%;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  color: #0f172a;
}

.lk-notice__title {
  margin: 0 0 12px;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(180, 140, 255, 0.22);
  color: #fff;
}

.lk-notice--embedded .lk-notice__title {
  color: #0f172a;
  border-bottom-color: rgba(148, 163, 184, 0.35);
}

.lk-notice__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lk-notice__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(200, 210, 255, 0.88);
}

.lk-notice--embedded .lk-notice__item {
  color: #334155;
}

.lk-notice__icon {
  flex-shrink: 0;
  line-height: 1.4;
}

.lk-notice__text strong {
  color: rgba(196, 181, 253, 0.95);
  font-weight: 600;
}

.lk-notice--embedded .lk-notice__text strong {
  color: #4338ca;
}

/* Dark mode: match ProfileCard embedded palette */
[data-theme='dark'] .lk-notice--embedded {
  background: rgba(15, 23, 42, 0.62) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-notice--embedded .lk-notice__title {
  color: rgba(226, 232, 240, 0.98) !important;
  border-bottom-color: rgba(148, 163, 184, 0.35) !important;
}

[data-theme='dark'] .lk-notice--embedded .lk-notice__item {
  color: rgba(148, 163, 184, 0.98) !important;
}

[data-theme='dark'] .lk-notice--embedded .lk-notice__text strong {
  color: rgba(196, 181, 253, 0.98) !important;
}
</style>
