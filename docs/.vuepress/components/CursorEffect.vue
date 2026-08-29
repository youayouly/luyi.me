<template>
  <div class="lk-cursor" :class="{ 'is-hover': isHover, 'is-hidden': isHidden }" aria-hidden="true">
    <div class="lk-cursor__ring" />
    <div class="lk-cursor__dot" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const isHover = ref(false)
const isHidden = ref(true)
let raf = null
const cx = ref(-100)
const cy = ref(-100)
const tx = ref(-100)
const ty = ref(-100)

function onMove(e) {
  tx.value = e.clientX
  ty.value = e.clientY
  isHidden.value = false
}

function onOver(e) {
  const t = e.target
  if (t && (t.closest('a, button, [role="button"], input, textarea, select, .lk-proj-card, .lk-pm-card'))) {
    isHover.value = true
  }
}

function onOut() {
  isHover.value = false
}

function onLeave() {
  isHidden.value = true
}

function tick() {
  cx.value += (tx.value - cx.value) * 0.15
  cy.value += (ty.value - cy.value) * 0.15
  const el = document.querySelector('.lk-cursor')
  if (el) {
    el.style.transform = `translate(${cx.value}px, ${cy.value}px)`
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  if (typeof window === 'undefined') return
  if ('ontouchstart' in window) return

  document.addEventListener('mousemove', onMove, { passive: true })
  document.addEventListener('mouseover', onOver, { passive: true })
  document.addEventListener('mouseout', onOut, { passive: true })
  document.addEventListener('mouseleave', onLeave)
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mouseover', onOver)
  document.removeEventListener('mouseout', onOut)
  document.removeEventListener('mouseleave', onLeave)
})
</script>

<style scoped>
.lk-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  pointer-events: none;
  mix-blend-mode: difference;
  transition: opacity 0.3s ease;
  opacity: 1;
}

.lk-cursor.is-hidden {
  opacity: 0;
}

.lk-cursor__ring {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
  margin: -12px 0 0 -12px;
  transition:
    width 0.25s ease,
    height 0.25s ease,
    margin 0.25s ease,
    border-color 0.25s ease;
}

.lk-cursor__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  transition: opacity 0.2s ease;
}

.lk-cursor.is-hover .lk-cursor__ring {
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-color: rgba(96, 165, 250, 0.7);
}

.lk-cursor.is-hover .lk-cursor__dot {
  opacity: 0;
}

[data-theme='light'] .lk-cursor__ring {
  border-color: rgba(15, 23, 42, 0.4);
}

[data-theme='light'] .lk-cursor__dot {
  background: rgba(15, 23, 42, 0.6);
}

[data-theme='light'] .lk-cursor.is-hover .lk-cursor__ring {
  border-color: rgba(59, 130, 246, 0.6);
}

@media (max-width: 719px) {
  .lk-cursor {
    display: none;
  }
}
</style>
