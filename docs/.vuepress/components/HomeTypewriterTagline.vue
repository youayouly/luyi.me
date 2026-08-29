<template>
  <div class="home-typewriter-tagline" role="status" aria-live="polite">
    <span class="home-typewriter-tagline__text">{{ visible }}</span><span
      class="home-typewriter-tagline__cursor"
      aria-hidden="true"
    >|</span>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
})

const DEFAULT_TEXT = 'Welcome to my blog!'

const fullText = computed(() => {
  const raw = props.text?.replace(/<[^>]*>/g, '').trim()
  return raw || DEFAULT_TEXT
})

const visible = ref('')
let cancelled = false
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

onMounted(() => {
  cancelled = false
  const run = async () => {
    while (!cancelled) {
      const s = fullText.value

      // 逐字母打出
      for (let i = 0; i <= s.length && !cancelled; i++) {
        visible.value = s.slice(0, i)
        await delay(100)
      }

      if (cancelled) return
      await delay(1800)

      // 逐字母从末尾删除
      while (visible.value.length > 0 && !cancelled) {
        visible.value = visible.value.slice(0, -1)
        await delay(60)
      }

      if (cancelled) return
      await delay(600)
    }
  }
  void run()
})

onUnmounted(() => {
  cancelled = true
})
</script>

<style scoped>
.home-typewriter-tagline__text {
  display: inline;
}

.home-typewriter-tagline__cursor {
  display: inline-block;
  margin-left: 1px;
  font-weight: 300;
  color: var(--vp-c-accent, #3eaf7c);
  animation: home-typewriter-blink 1s step-end infinite;
}

@keyframes home-typewriter-blink {
  0%,
  100% { opacity: 1; }
  50%  { opacity: 0; }
}
</style>
