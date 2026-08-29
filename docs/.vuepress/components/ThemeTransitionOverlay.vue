<template>
  <div
    v-show="visible"
    class="lk-theme-transition"
    :class="directionClass"
    @animationend="onAnimEnd"
  >
    <svg class="lk-theme-transition__svg" xmlns="http://www.w3.org/2000/svg">
      <polygon
        class="lk-theme-transition__triangle"
        :points="points"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type Direction = 'to-dark' | 'to-light' | null

const visible = ref(false)
const direction = ref<Direction>(null)
const running = ref(false)

const directionClass = computed(() =>
  direction.value ? `lk-theme-transition--${direction.value}` : '',
)

// 简单分段补间：通过 CSS keyframes 控制多阶段 clip-path / transform，
// 这里只需要一个常量 points，占满视口，由 CSS 决定三角形的生长。
const points = '100,0 100,100 0,100'

function start(dir: Exclude<Direction, null>) {
  if (running.value) return
  direction.value = dir
  visible.value = true
  running.value = true
}

function onAnimEnd() {
  // 一轮动画结束后隐藏遮罩，但保留最后的主题状态
  visible.value = false
  running.value = false
}

function handleThemeMutation(mutations: MutationRecord[]) {
  for (const m of mutations) {
    if (m.type === 'attributes' && m.attributeName === 'data-theme') {
      const root = m.target as HTMLElement
      const theme = root.getAttribute('data-theme')
      if (theme === 'dark') {
        start('to-dark')
      } else if (theme === 'light') {
        start('to-light')
      }
    }
  }
}

let observer: MutationObserver | null = null

onMounted(() => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  observer = new MutationObserver(handleThemeMutation)
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<style scoped>
.lk-theme-transition {
  position: fixed;
  inset: 0;
  z-index: 1200;
  pointer-events: none;
  overflow: hidden;
}

.lk-theme-transition__svg {
  width: 100%;
  height: 100%;
  display: block;
}

.lk-theme-transition__triangle {
  /* 初始为极小点，具体形态由 keyframes 控制 clip-path */
  transform-origin: 100% 0;
}

.lk-theme-transition--to-dark .lk-theme-transition__triangle {
  fill: #020617;
  animation: lk-theme-tri-grow-dark 1.3s cubic-bezier(0.3, 0.7, 0.2, 1) forwards;
}

.lk-theme-transition--to-light .lk-theme-transition__triangle {
  fill: #f5f7ff;
  animation: lk-theme-tri-grow-light 1.3s cubic-bezier(0.3, 0.7, 0.2, 1) forwards;
}

@keyframes lk-theme-tri-grow-dark {
  0% {
    transform: translate(0, 0) scale(0.02);
  }
  22% {
    transform: translate(-10%, 5%) scale(0.25);
  }
  44% {
    transform: translate(-30%, 10%) scale(0.55);
  }
  70% {
    transform: translate(-60%, 25%) scale(0.95);
  }
  100% {
    transform: translate(-100%, 50%) scale(1.6);
  }
}

@keyframes lk-theme-tri-grow-light {
  0% {
    transform: translate(0, 0) scale(0.02);
  }
  22% {
    transform: translate(-10%, 5%) scale(0.25);
  }
  44% {
    transform: translate(-30%, 10%) scale(0.55);
  }
  70% {
    transform: translate(-60%, 25%) scale(0.95);
  }
  100% {
    transform: translate(-100%, 50%) scale(1.6);
  }
}
</style>

