<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { normPath } from '../utils/authGate.js'
import { pageLang } from '../utils/pageTranslate.js'
import { readRouteCurtainPref } from '../utils/routeCurtainPref.js'

/* 等帘子完全合上再切路由：必须 >= .lk-curtain__panel 的 transition 时长（0.26s）。
   之前是 120ms，路由在面板只合了一半时就跳了，新页面会从缝里闪一下。 */
const CURTAIN_NAV_LEAD_MS = 270

const stage = ref('idle')
const router = useRouter()

/*
 * 这句自带中英两份，不走词典。
 *
 * 帘子是客户端才建出来的节点，构建产物的 HTML 里没有它，所以既不在首屏脚本的内联表里，
 * 也只能等 `/i18n/en.json` 到手才轮得到查表。线上实测（4×CPU + 4G、冷缓存）：整页
 * 只剩这一处中文，但它挂了 2.6 秒 —— 而它偏偏是切页面时唯一显示在屏幕中央的字。
 * 跟 SiteFooter / VisitedChinaFootprints 一样，跟着 pageLang 走就没有这个时间差。
 */
const hint = computed(() => (pageLang.value === 'zh' ? '加载中…' : 'Loading…'))
let token = 0
let timers = []
let unhook = null
let articleLinkHandler = null
let pendingNavigationTimer = 0
let pendingNavigationPath = ''

function clearTimers() {
  for (const t of timers) clearTimeout(t)
  timers = []
}

function clearPendingNavigation() {
  if (pendingNavigationTimer) {
    clearTimeout(pendingNavigationTimer)
    pendingNavigationTimer = 0
  }
  pendingNavigationPath = ''
}

function playCurtain() {
  if (!readRouteCurtainPref()) return

  token += 1
  const my = token
  clearTimers()
  stage.value = 'closing'

  timers.push(
    setTimeout(() => {
      if (token !== my) return

      stage.value = 'mid'
      timers.push(
        setTimeout(() => {
          if (token !== my) return

          stage.value = 'opening'
          timers.push(
            setTimeout(() => {
              if (token !== my) return
              stage.value = 'idle'
            }, 260),
          )
        }, 140),
      )
    }, 260),
  )
}

function isArticleCurtainPath(path) {
  const normalized = normPath(path)
  return normalized === '/article' || normalized.startsWith('/article/')
}

function resolveInternalCurtainNavigation(event, { scopeSelector, requireArticleScope = false } = {}) {
  if (typeof window === 'undefined' || !readRouteCurtainPref()) return null
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const target = event.target
  if (!(target instanceof Element)) return null

  const anchor = target.closest('a[href]')
  if (!(anchor instanceof HTMLAnchorElement)) return null
  if (scopeSelector && !anchor.closest(scopeSelector)) return null
  if (
    requireArticleScope &&
    !anchor.closest('.theme-container.page-article-index, .theme-container.page-article-post')
  ) {
    return null
  }
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null

  const rawHref = anchor.getAttribute('href')
  if (!rawHref || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return null

  let url
  try {
    url = new URL(anchor.href, window.location.origin)
  } catch {
    return null
  }

  if (url.origin !== window.location.origin) return null

  const currentPath = normPath(window.location.pathname)
  const targetPath = normPath(url.pathname)
  if (targetPath === currentPath) return null

  if (
    requireArticleScope &&
    !isArticleCurtainPath(currentPath) &&
    !isArticleCurtainPath(targetPath)
  ) {
    return null
  }

  const resolved = router.resolve(`${url.pathname}${url.search}${url.hash}`)
  return {
    href: url.href,
    fullPath: resolved.fullPath,
  }
}

function resolvePhoneInlineNavCurtainNavigation(event) {
  return resolveInternalCurtainNavigation(event, {
    scopeSelector: '.lk-phone-inline-nav[data-lk-phone-inline-nav="1"]',
  })
}

/* 项目卡片整卡是 RouterLink，不拦的话会走 beforeEach 那条路：
   路由先跳、帘子后合，于是先看到新页面一闪再被盖住。 */
function resolveProjectCardCurtainNavigation(event) {
  return resolveInternalCurtainNavigation(event, {
    scopeSelector: '.lk-proj-cards',
  })
}

function resolveArticleCurtainNavigation(event) {
  if (event.target instanceof Element && event.target.closest('.vp-navbar')) return null

  return resolveInternalCurtainNavigation(event, {
    requireArticleScope: true,
  })
}

function handleCurtainNavigationClick(event) {
  const navigation =
    resolvePhoneInlineNavCurtainNavigation(event) ||
    resolveProjectCardCurtainNavigation(event) ||
    resolveArticleCurtainNavigation(event)
  if (!navigation) return

  event.preventDefault()
  playCurtain()
  clearPendingNavigation()

  pendingNavigationPath = navigation.fullPath
  pendingNavigationTimer = window.setTimeout(() => {
    pendingNavigationTimer = 0
    const nextPath = pendingNavigationPath

    /* 这里不能先把 pendingNavigationPath 清掉：清了之后下面 push 触发的
       beforeEach 就认不出这是自己排的那次跳转，会再放一遍帘子——实测帘子在
       合上的瞬间重新从头合一次，整段从 660ms 拖到 950ms，看起来就是「卡一下
       再进去」。交给 beforeEach 匹配后自己清。 */
    router
      .push(nextPath)
      .catch(() => {
        window.location.assign(navigation.href)
      })
      .finally(() => {
        if (pendingNavigationPath === nextPath) pendingNavigationPath = ''
      })
  }, CURTAIN_NAV_LEAD_MS)
}

unhook = router.beforeEach((to, from) => {
  if (!from || normPath(from.path) === normPath(to.path)) return true

  if (pendingNavigationPath && to.fullPath === pendingNavigationPath) {
    pendingNavigationPath = ''
    return true
  }

  pendingNavigationPath = ''
  playCurtain()
  return true
})

onMounted(() => {
  articleLinkHandler = handleCurtainNavigationClick
  document.addEventListener('click', articleLinkHandler, true)
})

onUnmounted(() => {
  clearPendingNavigation()
  clearTimers()

  if (unhook) unhook()
  unhook = null

  if (articleLinkHandler) {
    document.removeEventListener('click', articleLinkHandler, true)
  }
  articleLinkHandler = null
})
</script>

<template>
  <div
    class="lk-curtain"
    :data-stage="stage"
    :aria-hidden="stage === 'idle' ? 'true' : 'false'"
    role="status"
  >
    <div class="lk-curtain__panel lk-curtain__panel--left" />
    <div class="lk-curtain__panel lk-curtain__panel--right" />
    <div class="lk-curtain__core" aria-hidden="true">
      <svg
        class="lk-curtain__net"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g class="lk-curtain__net-rot">
          <!-- 12 条边：8 条相邻环边 + 4 条贯穿中心的直径 -->
          <g class="lk-curtain__net-edges">
            <line x1="82" y1="50" x2="72.63" y2="27.37" />
            <line x1="72.63" y1="27.37" x2="50" y2="18" />
            <line x1="50" y1="18" x2="27.37" y2="27.37" />
            <line x1="27.37" y1="27.37" x2="18" y2="50" />
            <line x1="18" y1="50" x2="27.37" y2="72.63" />
            <line x1="27.37" y1="72.63" x2="50" y2="82" />
            <line x1="50" y1="82" x2="72.63" y2="72.63" />
            <line x1="72.63" y1="72.63" x2="82" y2="50" />
            <line x1="82" y1="50" x2="18" y2="50" />
            <line x1="72.63" y1="27.37" x2="27.37" y2="72.63" />
            <line x1="50" y1="18" x2="50" y2="82" />
            <line x1="27.37" y1="27.37" x2="72.63" y2="72.63" />
          </g>
          <!-- 8 个外圈节点 -->
          <g class="lk-curtain__net-nodes">
            <circle cx="82" cy="50" r="3.4" />
            <circle cx="72.63" cy="27.37" r="3.4" />
            <circle cx="50" cy="18" r="3.4" />
            <circle cx="27.37" cy="27.37" r="3.4" />
            <circle cx="18" cy="50" r="3.4" />
            <circle cx="27.37" cy="72.63" r="3.4" />
            <circle cx="50" cy="82" r="3.4" />
            <circle cx="72.63" cy="72.63" r="3.4" />
          </g>
          <!-- 中心节点 -->
          <circle class="lk-curtain__net-core" cx="50" cy="50" r="4.6" />
        </g>
      </svg>
      <p class="lk-curtain__hint">{{ hint }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lk-curtain {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.lk-curtain[data-stage='closing'],
.lk-curtain[data-stage='mid'] {
  pointer-events: auto;
}

.lk-curtain__panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: transform 0.26s cubic-bezier(0.42, 0, 0.2, 1);
  will-change: transform;
}

.lk-curtain__panel--left {
  left: 0;
  transform: translateX(-101%);
}

.lk-curtain__panel--right {
  right: 0;
  transform: translateX(101%);
}

.lk-curtain[data-stage='closing'] .lk-curtain__panel--left,
.lk-curtain[data-stage='mid'] .lk-curtain__panel--left {
  transform: translateX(0);
}

.lk-curtain[data-stage='closing'] .lk-curtain__panel--right,
.lk-curtain[data-stage='mid'] .lk-curtain__panel--right {
  transform: translateX(0);
}

[data-theme='dark'] .lk-curtain__panel {
  background: rgba(15, 23, 42, 0.96);
}

.lk-curtain__core {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  opacity: 0;
  transition: opacity 0.22s ease;
  pointer-events: none;
}

.lk-curtain[data-stage='closing'] .lk-curtain__core {
  opacity: 0.4;
}

.lk-curtain[data-stage='mid'] .lk-curtain__core {
  opacity: 1;
}

.lk-curtain__net {
  width: clamp(76px, 9vw, 108px);
  height: clamp(76px, 9vw, 108px);
  filter: drop-shadow(0 8px 22px rgba(91, 33, 182, 0.28));
  overflow: visible;
}

[data-theme='dark'] .lk-curtain__net {
  filter: drop-shadow(0 10px 24px rgba(196, 181, 253, 0.35));
}

.lk-curtain__net-rot {
  transform-box: fill-box;
  transform-origin: center;
  animation: lk-curtain-net-rot 2.6s linear infinite;
}

.lk-curtain__net-edges line {
  stroke: rgba(124, 58, 237, 0.55);
  stroke-width: 1.1;
  stroke-linecap: round;
  fill: none;
}

[data-theme='dark'] .lk-curtain__net-edges line {
  stroke: rgba(196, 181, 253, 0.62);
}

.lk-curtain__net-nodes circle {
  fill: #7c3aed;
  animation: lk-curtain-net-pulse 1.45s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

.lk-curtain__net-nodes circle:nth-child(1) { animation-delay: 0.00s; }
.lk-curtain__net-nodes circle:nth-child(2) { animation-delay: 0.18s; }
.lk-curtain__net-nodes circle:nth-child(3) { animation-delay: 0.36s; }
.lk-curtain__net-nodes circle:nth-child(4) { animation-delay: 0.54s; }
.lk-curtain__net-nodes circle:nth-child(5) { animation-delay: 0.72s; }
.lk-curtain__net-nodes circle:nth-child(6) { animation-delay: 0.90s; }
.lk-curtain__net-nodes circle:nth-child(7) { animation-delay: 1.08s; }
.lk-curtain__net-nodes circle:nth-child(8) { animation-delay: 1.26s; }

[data-theme='dark'] .lk-curtain__net-nodes circle {
  fill: #c4b5fd;
}

.lk-curtain__net-core {
  fill: #6d28d9;
  animation: lk-curtain-net-core 1.4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

[data-theme='dark'] .lk-curtain__net-core {
  fill: #e9d5ff;
}

.lk-curtain__hint {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #5b21b6;
}

[data-theme='dark'] .lk-curtain__hint {
  color: #c4b5fd;
}

@keyframes lk-curtain-net-rot {
  to {
    transform: rotate(360deg);
  }
}

@keyframes lk-curtain-net-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

@keyframes lk-curtain-net-core {
  0%, 100% {
    transform: scale(0.92);
  }
  50% {
    transform: scale(1.18);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lk-curtain__panel {
    transition-duration: 0.16s;
  }
  .lk-curtain__net-rot,
  .lk-curtain__net-nodes circle,
  .lk-curtain__net-core {
    animation: none;
  }
}
</style>
