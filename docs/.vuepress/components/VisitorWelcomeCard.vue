<template>
  <section class="lk-welcome" aria-label="欢迎来访者">
    <h2 class="lk-welcome__title">
      <span class="lk-welcome__icon" aria-hidden="true">👋</span>
      欢迎你
    </h2>
    <div class="lk-welcome__body" aria-live="polite">
      <p v-if="visitor.loading" class="lk-welcome__line lk-welcome__line--muted">
        正在识别你来自哪里…
      </p>
      <template v-else>
        <p v-if="visitor.regionText" class="lk-welcome__place">
          来自 <strong>{{ visitor.regionText }}</strong> 的朋友
        </p>
        <p v-else class="lk-welcome__place">你好，欢迎来 Luke 的空间</p>
        <p v-if="visitor.distanceKm != null" class="lk-welcome__line">
          距主站约 {{ visitor.distanceKm.toLocaleString('zh-CN') }} km
        </p>
      </template>
      <p class="lk-welcome__tip">{{ visitor.tip }}</p>
    </div>
  </section>
</template>

<script setup>
import { reactive, onMounted } from 'vue'
import { fetchVisitorSnapshot, timeTipByHour } from '../utils/visitorClient.js'

const visitor = reactive({
  loading: true,
  regionText: '',
  distanceKm: null,
  tip: timeTipByHour(new Date().getHours()),
})

function stripUnknownFragments(text) {
  if (!text) return ''
  const cleaned = text.replace(/^来自\s*/, '').replace(/\s*的朋友$/, '').trim()
  if (!cleaned || cleaned === '未知地区') return ''
  return cleaned
}

onMounted(async () => {
  try {
    const s = await fetchVisitorSnapshot()
    visitor.regionText = stripUnknownFragments(s.placeLine)
    visitor.distanceKm = s.distanceKm
    visitor.tip = s.tip || visitor.tip
  } catch {
    // swallow: keep default greeting + time tip
  } finally {
    visitor.loading = false
  }
})
</script>

<style scoped>
.lk-welcome {
  margin: 0;
  padding: 12px 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  color: #0f172a;
  min-width: 0;
  align-self: stretch;
}

.lk-welcome__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.lk-welcome__icon {
  font-size: 0.95rem;
  line-height: 1;
}

.lk-welcome__place {
  margin: 0 0 6px;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #0f172a;
  word-break: break-word;
}

.lk-welcome__place strong {
  color: #2563eb;
  font-weight: 700;
}

.lk-welcome__line {
  margin: 0 0 5px;
  font-size: 0.68rem;
  line-height: 1.45;
  color: #334155;
  word-break: break-word;
}

.lk-welcome__line--muted {
  color: #94a3b8;
}

.lk-welcome__tip {
  margin: 8px 0 0;
  font-size: 0.63rem;
  line-height: 1.4;
  color: #5b21b6;
  font-style: italic;
}

/* Dark mode: match ProfileCard embedded palette */
[data-theme='dark'] .lk-welcome {
  background: rgba(15, 23, 42, 0.62) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  color: rgba(226, 232, 240, 0.98) !important;
  box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

[data-theme='dark'] .lk-welcome__title {
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-welcome__place {
  color: rgba(241, 245, 249, 0.98) !important;
}

[data-theme='dark'] .lk-welcome__place strong {
  color: #93c5fd !important;
}

[data-theme='dark'] .lk-welcome__line {
  color: rgba(148, 163, 184, 0.98) !important;
}

[data-theme='dark'] .lk-welcome__line--muted {
  color: rgba(100, 116, 139, 0.98) !important;
}

[data-theme='dark'] .lk-welcome__tip {
  color: rgba(196, 181, 253, 0.98) !important;
}
</style>
