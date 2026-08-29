<template>
  <section class="lk-proj9" aria-label="Projects gallery">
    <header class="lk-proj9__head">
      <svg class="lk-proj9__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 19V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M4 14l4-4 4 3 4-6 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="lk-proj9__title">Projects</span>
    </header>

    <div
      class="lk-proj9__grid"
      :class="{ 'lk-proj9__grid--loading': !ready }"
      :aria-busy="!ready"
    >
      <template v-if="!ready">
        <div v-for="n in 9" :key="'p-' + n" class="lk-proj9__skel">
          <div class="lk-proj9__bars" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </div>
      </template>
      <template v-else>
        <a
          v-for="(item, i) in items"
          :key="item.src"
          class="lk-proj9__cell"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img :src="item.src" :alt="item.alt" loading="lazy" />
        </a>
      </template>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const ready = ref(false)

const items = [
  {
    src: 'https://picsum.photos/seed/lkpr0/240/240',
    alt: 'Project preview 1',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr1/240/240',
    alt: 'Project preview 2',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr2/240/240',
    alt: 'Project preview 3',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr3/240/240',
    alt: 'Project preview 4',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr4/240/240',
    alt: 'Project preview 5',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr5/240/240',
    alt: 'Project preview 6',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr6/240/240',
    alt: 'Project preview 7',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr7/240/240',
    alt: 'Project preview 8',
    href: 'https://github.com/',
  },
  {
    src: 'https://picsum.photos/seed/lkpr8/240/240',
    alt: 'Project preview 9',
    href: 'https://github.com/',
  },
]

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

onMounted(() => {
  Promise.all(items.map((it) => loadImage(it.src))).then(() => {
    ready.value = true
  })
})
</script>

<style scoped>
.lk-proj9 {
  --lk-p9-bg: #f4faf7;
  --lk-p9-muted: #3f6b5c;
  --lk-p9-text: #1e3d32;
  --lk-p9-skel: #dceee6;
  --lk-p9-bar: #9cbfb0;

  max-width: 420px;
  margin: 1.25rem 0 2rem;
  padding: 1rem 1.1rem 1.25rem;
  background: var(--lk-p9-bg);
  border-radius: 16px;
  box-shadow: 0 2px 20px rgba(30, 61, 50, 0.08);
  color: var(--lk-p9-text);
}

:root[data-theme='dark'] .lk-proj9 {
  --lk-p9-bg: rgba(30, 41, 59, 0.45);
  --lk-p9-muted: rgba(148, 163, 184, 0.85);
  --lk-p9-text: rgba(226, 232, 240, 0.92);
  --lk-p9-skel: rgba(51, 65, 85, 0.65);
  --lk-p9-bar: rgba(100, 116, 139, 0.75);

  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.lk-proj9__head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.lk-proj9__icon {
  color: var(--lk-p9-muted);
  flex-shrink: 0;
}

.lk-proj9__title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.lk-proj9__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 320px;
  margin: 0;
}

.lk-proj9__skel {
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--lk-p9-skel);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lk-proj9__bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  height: 28px;
  color: var(--lk-p9-bar);
}

.lk-proj9__bars span {
  width: 5px;
  border-radius: 2px;
  background: currentColor;
  transform-origin: center bottom;
  animation: lk-proj9-bar 0.85s ease-in-out infinite;
}

.lk-proj9__bars span:nth-child(1) {
  height: 10px;
  animation-delay: 0s;
}

.lk-proj9__bars span:nth-child(2) {
  height: 18px;
  animation-delay: 0.12s;
}

.lk-proj9__bars span:nth-child(3) {
  height: 14px;
  animation-delay: 0.24s;
}

.lk-proj9__bars span:nth-child(4) {
  height: 22px;
  animation-delay: 0.36s;
}

@keyframes lk-proj9-bar {
  0%,
  100% {
    transform: scaleY(0.35);
    opacity: 0.65;
  }

  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

.lk-proj9__cell {
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  display: block;
  border: 2px solid rgba(63, 107, 92, 0.15);
  box-shadow: 0 2px 8px rgba(30, 61, 50, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.lk-proj9__cell:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 14px rgba(30, 61, 50, 0.16);
}

:root[data-theme='dark'] .lk-proj9__cell {
  border-color: rgba(148, 163, 184, 0.22);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

:root[data-theme='dark'] .lk-proj9__cell:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.lk-proj9__cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
