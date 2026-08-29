<!--
  导航栏右上角这一格：**不再渲染任何按钮**。
  翻译开关已并进「站点设置」面板（SettingsFab.vue）的「显示语言」分段控件——
  那里是超集（跟随浏览器 / 中文 / EN），小球只能二态切换，属于重复入口。

  组件本身不能删，它还扛着三件事：
  1. ensureColorModeWrapInNavbarEnd() —— 把主题日/月开关锚定在 .vp-navbar-end 并去重；
  2. startPageTranslate() / stopPageTranslate() —— 整套翻译引擎的启停；
  3. 路由切换时 onRouteChanged() 同步重扫，晚一帧就会闪中文。

  而 tryAnchor() 开头是 "if (!el) return false"，wrapper 一旦不渲染，第 1 条会直接短路，
  所以这里保留一个零尺寸空 wrapper 当锚点（尺寸归零见 index.scss 的 .is-empty）。
-->
<template>
  <!-- 空锚点：只为 tryAnchor() 提供 wrapRef，不显示任何内容（尺寸归零见 index.scss）。 -->
  <div v-show="anchored" ref="wrapRef" class="vp-nav-item lk-particles-nav-item is-empty" aria-hidden="true" />
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  onRouteChanged as onTranslateRouteChanged,
  startPageTranslate,
  stopPageTranslate,
} from '../utils/pageTranslate.js'

const wrapRef = ref(null)
const anchored = ref(false)
const route = useRoute()

let mo = null

function getNavbarEnd() {
  if (typeof document === 'undefined') return null
  return document.querySelector('#navbar .vp-navbar-end')
}

function getNavbarThemeWraps(end) {
  if (!end) return []

  return [...end.children].filter(
    (node) =>
      node instanceof HTMLElement &&
      node.classList.contains('vp-nav-item') &&
      node.querySelector('#color-mode-switch'),
  )
}

function ensureColorModeWrapInNavbarEnd() {
  const end = getNavbarEnd()
  if (!end) return null

  const wraps = getNavbarThemeWraps(end)
  if (!wraps.length) return null

  const wrap = wraps.find((node) => node.parentNode === end) || wraps[0]
  const menuBtn = end.querySelector(':scope > .vp-toggle-navbar-button')

  if (wrap.parentNode !== end) {
    if (menuBtn && menuBtn.parentNode === end) end.insertBefore(wrap, menuBtn)
    else end.appendChild(wrap)
  }

  for (const node of wraps) {
    node.classList.toggle('lk-navbar-theme-slot', node === wrap)
    if (node !== wrap && node.parentNode !== end) node.remove()
  }

  return wrap
}

function getNavbarSettingsButton(end, el) {
  if (!end) return null

  return [...end.children].find(
    (node) =>
      node instanceof HTMLButtonElement &&
      node !== el &&
      node.classList.contains('lk-settings-btn'),
  )
}

function getNavbarMenuButton(end, el) {
  if (!end) return null

  const menuBtn = end.querySelector(':scope > .vp-toggle-navbar-button')
  return menuBtn && menuBtn !== el ? menuBtn : null
}

/*
 * 保持主题切换留在 Hope 默认导航树里，只调自定义按钮顺序，避免 Vue 重新渲染后出现多个开关。
 * 别把本组插到主题开关之前：Hope 会把自己的节点挪回去，和这里的 MutationObserver 互顶成死循环。
 * 视觉上让翻译按钮贴着月亮，靠 index.scss 里给设置齿轮 `order: -1` 实现，不动 DOM。
 */
function findFxInsertBefore(end, el) {
  if (!end) return null

  return (
    getNavbarSettingsButton(end, el) ||
    ensureColorModeWrapInNavbarEnd() ||
    getNavbarMenuButton(end, el) ||
    null
  )
}

function tryAnchor() {
  const el = wrapRef.value
  if (!el) return false

  ensureColorModeWrapInNavbarEnd()

  const end = getNavbarEnd()
  if (!end) return false

  const insertBefore = findFxInsertBefore(end, el)
  if (insertBefore && insertBefore.parentNode === end) {
    if (el.parentNode !== end || el.nextSibling !== insertBefore) {
      end.insertBefore(el, insertBefore)
    }
  } else if (el.parentNode !== end) {
    end.appendChild(el)
  }

  anchored.value = true
  return true
}

onMounted(async () => {
  startPageTranslate()
  await nextTick()
  tryAnchor()
  mo = new MutationObserver(() => {
    tryAnchor()
  })
  mo.observe(document.body, { childList: true, subtree: true })
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', tryAnchor)
  }
})

onUnmounted(() => {
  stopPageTranslate()
  mo?.disconnect()
  mo = null
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', tryAnchor)
  }
})

watch(
  () => route.fullPath,
  async () => {
    /*
     * 翻译要排在 await 之前：flush:'post' 这一格里 DOM 已经更新、浏览器还没绘制，
     * 同步查表换完文本，新页面就是直接以英文出现的。挪到 await nextTick() 后面
     * 会晚一帧，那一帧就是肉眼可见的中文闪烁。
     */
    onTranslateRouteChanged()
    await nextTick()
    tryAnchor()
  },
  { flush: 'post' },
)
</script>
