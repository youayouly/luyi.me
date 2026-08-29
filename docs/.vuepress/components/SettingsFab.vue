<template>
  <button
    v-show="anchored"
    ref="btnRef"
    type="button"
    class="lk-settings-btn"
    :class="{ 'is-open': open }"
    :aria-label="open ? '关闭设置' : '打开站点设置'"
    :aria-expanded="open ? 'true' : 'false'"
    @click.stop="toggleOpen"
  >
    <svg
      class="lk-settings-btn__icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
      />
      <path
        fill="currentColor"
        d="m19.43 12.98.04-.36a7.4 7.4 0 0 0 0-1.24l-.04-.36 1.97-1.5a.5.5 0 0 0 .12-.65l-1.86-3.22a.5.5 0 0 0-.6-.22l-2.32.94a7.13 7.13 0 0 0-2.15-1.24l-.36-2.45a.5.5 0 0 0-.5-.43h-3.72a.5.5 0 0 0-.5.43l-.36 2.45a7.13 7.13 0 0 0-2.15 1.24l-2.32-.94a.5.5 0 0 0-.6.22L2.46 8.87a.5.5 0 0 0 .12.65l1.97 1.5-.04.36a7.4 7.4 0 0 0 0 1.24l.04.36-1.97 1.5a.5.5 0 0 0-.12.65l1.86 3.22a.5.5 0 0 0 .6.22l2.32-.94a7.13 7.13 0 0 0 2.15 1.24l.36 2.45a.5.5 0 0 0 .5.43h3.72a.5.5 0 0 0 .5-.43l.36-2.45a7.13 7.13 0 0 0 2.15-1.24l2.32.94a.5.5 0 0 0 .6-.22l1.86-3.22a.5.5 0 0 0-.12-.65l-1.97-1.5ZM12 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z"
      />
    </svg>
  </button>

  <ClientOnly>
    <Teleport to="body">
      <Transition name="lk-settings-pop-fade">
        <div
          v-if="open"
          ref="popRef"
          class="lk-settings-pop"
          :style="popStyle"
          role="dialog"
          aria-label="站点设置"
          @click.stop
        >
            <div class="lk-settings-pop__title">站点设置</div>

            <div class="lk-settings-group">外观</div>

            <button
              type="button"
              class="lk-settings-row"
              role="switch"
              :aria-checked="particlesOn ? 'true' : 'false'"
              @click="toggleParticles"
            >
              <span class="lk-settings-row__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2.2 15.05 8.38 21.9 9.37 16.92 14.22 18.08 22 12 18.18 5.92 22 7.08 14.22 2.1 9.37 8.95 8.38Z"
                  />
                </svg>
              </span>
              <span class="lk-settings-row__label">背景粒子特效</span>
              <span class="lk-settings-switch" :class="{ 'is-on': particlesOn }">
                <span class="lk-settings-switch__dot" />
              </span>
            </button>

            <button
              type="button"
              class="lk-settings-row"
              role="switch"
              :aria-checked="curtainOn ? 'true' : 'false'"
              @click="toggleCurtain"
            >
              <span class="lk-settings-row__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <g
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                  >
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <circle cx="4.5" cy="6" r="1.4" fill="currentColor" />
                    <circle cx="19.5" cy="6" r="1.4" fill="currentColor" />
                    <circle cx="4.5" cy="18" r="1.4" fill="currentColor" />
                    <circle cx="19.5" cy="18" r="1.4" fill="currentColor" />
                    <line x1="4.5" y1="6" x2="12" y2="12" />
                    <line x1="19.5" y1="6" x2="12" y2="12" />
                    <line x1="4.5" y1="18" x2="12" y2="12" />
                    <line x1="19.5" y1="18" x2="12" y2="12" />
                  </g>
                </svg>
              </span>
              <span class="lk-settings-row__label">页面切换动画</span>
              <span class="lk-settings-switch" :class="{ 'is-on': curtainOn }">
                <span class="lk-settings-switch__dot" />
              </span>
            </button>

            <div class="lk-settings-divider" />

            <div class="lk-settings-group">语言</div>

            <div class="lk-settings-field">
              <span class="lk-settings-field__label">显示语言</span>
              <div class="lk-settings-seg" role="group" aria-label="显示语言">
                <button
                  v-for="opt in langOptions"
                  :key="opt.value"
                  type="button"
                  class="lk-settings-seg__btn"
                  :class="{ 'is-on': langMode === opt.value }"
                  :aria-pressed="langMode === opt.value ? 'true' : 'false'"
                  @click="onPickLang(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
              <p
                class="lk-settings-field__hint"
                :class="{ 'is-busy': langBusy, 'is-error': langFailed }"
              >{{ langHint }}</p>
            </div>

            <template v-if="showAdminEntry">
              <div class="lk-settings-divider" />

              <div class="lk-settings-group">管理</div>

              <!-- 宽屏时「设置」是导航栏第五项，窄屏塞不下，就从这里进后台。 -->
              <button
                type="button"
                class="lk-settings-action"
                @click="onOpenAdmin"
              >
                <span class="lk-settings-row__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3 4 6.5v5c0 4.4 3.4 8.4 8 9.5 4.6-1.1 8-5.1 8-9.5v-5L12 3Z" />
                  </svg>
                </span>
                <span class="lk-settings-row__label">站点后台</span>
              </button>
            </template>

            <div class="lk-settings-divider" />

            <button
              type="button"
              class="lk-settings-action"
              @click="onScrollTop"
            >
              <span class="lk-settings-row__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </span>
              <span class="lk-settings-row__label">回到顶部</span>
            </button>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>

</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ClientOnly } from 'vuepress/client'
import {
  PARTICLES_PREF_EVENT,
  PARTICLES_PREF_KEY,
  readParticlesPref,
  writeParticlesPref,
} from '../utils/particlesPref.js'
import {
  ROUTE_CURTAIN_PREF_EVENT,
  ROUTE_CURTAIN_PREF_KEY,
  readRouteCurtainPref,
  writeRouteCurtainPref,
} from '../utils/routeCurtainPref.js'
import {
  langMode,
  setPageLangMode,
  translateBroken,
  translateError,
  translating,
} from '../utils/pageTranslate.js'
import { LANG_MODE_AUTO, detectBrowserLang, SOURCE_LANG } from '../utils/translatePref.js'
import { OPEN_AVATAR_MODAL_EVENT } from '../utils/avatarPref.js'
import { useIsLoggedIn } from '../utils/authGate.js'

const route = useRoute()
const btnRef = ref(null)
const popRef = ref(null)
const anchored = ref(false)
const open = ref(false)
const particlesOn = ref(false)
const curtainOn = ref(true)
const popPos = ref({ top: 0, right: 0 })
const isNarrow = ref(false)
const isLoggedIn = useIsLoggedIn()

/* 只在窄屏补这个入口：宽屏导航栏里已经有「设置」了，两个入口会重复。 */
const showAdminEntry = computed(() => isLoggedIn.value && isNarrow.value)

const langOptions = [
  { value: LANG_MODE_AUTO, label: '跟随浏览器' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
]

/*
 * 翻译的「进行中 / 失败」原本挂在导航栏那枚地球上（is-busy / is-error）。
 * 地球并进本面板后这两个状态必须跟着搬过来，否则翻译服务挂掉时面板一声不吭，
 * 「点了没反应」和「正在翻译」长得一模一样——这正是当初给地球加状态的原因。
 */
const langBusy = computed(() => translating.value)
const langFailed = computed(() => !langBusy.value && translateBroken.value)

const langHint = computed(() => {
  if (langBusy.value) return '正在翻译本页…'
  if (langFailed.value) return `翻译失败：${translateError.value || '翻译服务不可用'}`
  if (langMode.value !== LANG_MODE_AUTO) return '已锁定为固定语言，不再跟随浏览器。'
  return detectBrowserLang() === SOURCE_LANG
    ? '你的浏览器是中文，默认显示原文。'
    : '非中文浏览器会自动翻译成英文。'
})

function normalizeRoutePath(path) {
  return String(path || '/').replace(/\/+$/, '') || '/'
}


function shouldShowNavbarSettings(path) {
  return true
}

function syncParticles() {
  particlesOn.value = readParticlesPref()
}

function syncCurtain() {
  curtainOn.value = readRouteCurtainPref()
}

function onStorage(e) {
  if (e.key === PARTICLES_PREF_KEY || e.key === null) syncParticles()
  if (e.key === ROUTE_CURTAIN_PREF_KEY || e.key === null) syncCurtain()
}

function onPickLang(mode) {
  setPageLangMode(mode)
}

function computePopPos() {
  const btn = btnRef.value
  if (!btn) return
  const r = btn.getBoundingClientRect()
  popPos.value = {
    top: r.bottom + 8,
    right: Math.max(8, window.innerWidth - r.right),
  }
}

const popStyle = computed(() => ({
  top: `${popPos.value.top}px`,
  right: `${popPos.value.right}px`,
}))

function toggleOpen() {
  if (!open.value) computePopPos()
  open.value = !open.value
}

function toggleParticles() {
  writeParticlesPref(!particlesOn.value)
  syncParticles()
}

function toggleCurtain() {
  writeRouteCurtainPref(!curtainOn.value)
  syncCurtain()
}

function onScrollTop() {
  open.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function syncNarrow() {
  isNarrow.value = Boolean(window.matchMedia?.('(max-width: 959px)')?.matches)
}

function onOpenAdmin() {
  open.value = false
  window.dispatchEvent(new CustomEvent(OPEN_AVATAR_MODAL_EVENT))
}

function onDocClick(e) {
  if (!open.value) return
  const target = e.target
  if (!(target instanceof HTMLElement)) return
  if (popRef.value && popRef.value.contains(target)) return
  if (target.closest('.lk-settings-btn')) return
  open.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape' && open.value) open.value = false
}

function onWindowChange() {
  syncNarrow()
  if (open.value) computePopPos()
}

let mo = null

function getNavbarEnd() {
  if (typeof document === 'undefined') return null
  return document.querySelector('#navbar .vp-navbar-end')
}

function getNavbarAppearanceItem(end) {
  if (!end) return null

  return [...end.children].find(
    (node) =>
      node instanceof HTMLElement &&
      node.classList.contains('vp-nav-item') &&
      node.querySelector('#color-mode-switch'),
  )
}

function getNavbarMenuButton(end, el) {
  if (!end) return null

  const menuBtn = end.querySelector(':scope > .vp-toggle-navbar-button')
  return menuBtn && menuBtn !== el ? menuBtn : null
}

function tryAnchor() {
  const el = btnRef.value
  if (!el) return false
  if (!shouldShowNavbarSettings(route.path)) {
    anchored.value = false
    open.value = false
    return false
  }

  const end = getNavbarEnd()
  if (!end) return false

  const insertBefore = getNavbarAppearanceItem(end) || getNavbarMenuButton(end, el)

  if (insertBefore && insertBefore.parentNode === end) {
    if (el.parentNode !== end || el.nextSibling !== insertBefore) {
      end.insertBefore(el, insertBefore)
    }
    anchored.value = true
    return true
  }

  if (el.parentNode !== end) {
    end.appendChild(el)
    anchored.value = true
  }
  return false
}

function syncSettingsAnchor() {
  if (!shouldShowNavbarSettings(route.path)) {
    anchored.value = false
    open.value = false
    return false
  }

  return tryAnchor()
}

onMounted(async () => {
  syncParticles()
  syncCurtain()
  syncNarrow()
  await nextTick()
  syncSettingsAnchor()
  mo = new MutationObserver(() => {
    syncSettingsAnchor()
  })
  mo.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('scroll', onWindowChange, { passive: true })
  window.addEventListener('storage', onStorage)
  window.addEventListener(PARTICLES_PREF_EVENT, syncParticles)
  window.addEventListener(ROUTE_CURTAIN_PREF_EVENT, syncCurtain)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  mo?.disconnect()
  mo = null
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange)
  window.removeEventListener('storage', onStorage)
  window.removeEventListener(PARTICLES_PREF_EVENT, syncParticles)
  window.removeEventListener(ROUTE_CURTAIN_PREF_EVENT, syncCurtain)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})

watch(
  () => route.fullPath,
  async () => {
    open.value = false
    await nextTick()
    syncSettingsAnchor()
  },
  { flush: 'post' },
)
</script>

<style scoped>
.lk-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--vp-c-text, rgba(30, 41, 59, 0.86));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.lk-settings-btn:hover {
  background: rgba(124, 58, 237, 0.12);
  color: rgba(91, 33, 182, 0.96);
}

:root[data-theme='dark'] .lk-settings-btn {
  color: rgba(226, 232, 240, 0.94);
}

:root[data-theme='dark'] .lk-settings-btn:hover {
  background: rgba(196, 181, 253, 0.18);
  color: #f5f3ff;
}

.lk-settings-btn.is-open {
  color: rgba(91, 33, 182, 0.96);
  background: rgba(124, 58, 237, 0.16);
}

:root[data-theme='dark'] .lk-settings-btn.is-open {
  color: #f5f3ff;
  background: rgba(196, 181, 253, 0.22);
}

/* 齿轮一直缓慢转动；hover/打开时加速 */
.lk-settings-btn__icon {
  width: 1.18rem;
  height: 1.18rem;
  display: block;
  pointer-events: none;
  animation: lk-settings-spin 8s linear infinite;
  transform-origin: 50% 50%;
}

.lk-settings-btn:hover .lk-settings-btn__icon,
.lk-settings-btn.is-open .lk-settings-btn__icon {
  animation-duration: 1.8s;
}

@keyframes lk-settings-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lk-settings-btn__icon {
    animation: none;
  }
}
</style>

<style>
/* 浮层走 Teleport，因此用全局样式 */
.lk-settings-pop {
  position: fixed;
  width: 15.2rem;
  padding: 0.55rem;
  border-radius: 14px;
  background: rgba(255, 252, 248, 0.97);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  z-index: 9000;
}

:root[data-theme='dark'] .lk-settings-pop {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.42);
}

.lk-settings-pop__title {
  padding: 0.18rem 0.45rem 0.32rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(71, 85, 105, 0.82);
}

:root[data-theme='dark'] .lk-settings-pop__title {
  color: rgba(203, 213, 225, 0.78);
}

.lk-settings-pop .lk-settings-row,
.lk-settings-pop .lk-settings-action {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.55rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(30, 41, 59, 0.9);
  cursor: pointer;
  text-align: left;
  font-size: 0.83rem;
  transition: background 0.16s ease;
}

.lk-settings-pop .lk-settings-row:hover,
.lk-settings-pop .lk-settings-action:hover {
  background: rgba(124, 58, 237, 0.08);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-row,
:root[data-theme='dark'] .lk-settings-pop .lk-settings-action {
  color: rgba(226, 232, 240, 0.94);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-row:hover,
:root[data-theme='dark'] .lk-settings-pop .lk-settings-action:hover {
  background: rgba(196, 181, 253, 0.12);
}

.lk-settings-pop .lk-settings-row__icon {
  width: 1.05rem;
  height: 1.05rem;
  display: grid;
  place-items: center;
  color: rgba(124, 58, 237, 0.85);
}

.lk-settings-pop .lk-settings-row__icon svg {
  width: 100%;
  height: 100%;
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-row__icon {
  color: rgba(196, 181, 253, 0.92);
}

.lk-settings-pop .lk-settings-row__label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.lk-settings-pop .lk-settings-switch {
  width: 2.1rem;
  height: 1.15rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
  position: relative;
  transition: background 0.2s ease;
  flex: 0 0 auto;
}

.lk-settings-pop .lk-settings-switch__dot {
  position: absolute;
  top: 50%;
  left: 0.15rem;
  width: 0.85rem;
  height: 0.85rem;
  margin-top: -0.425rem;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  transition: transform 0.22s ease;
}

.lk-settings-pop .lk-settings-switch.is-on {
  background: linear-gradient(120deg, #7c3aed, #ec4899);
}

.lk-settings-pop .lk-settings-switch.is-on .lk-settings-switch__dot {
  transform: translateX(0.95rem);
}

.lk-settings-pop .lk-settings-group {
  padding: 0.3rem 0.55rem 0.1rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(124, 58, 237, 0.72);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-group {
  color: rgba(196, 181, 253, 0.78);
}

.lk-settings-pop .lk-settings-field {
  padding: 0.3rem 0.55rem 0.45rem;
}

.lk-settings-pop .lk-settings-field__label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.83rem;
  font-weight: 600;
  color: rgba(30, 41, 59, 0.9);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-field__label {
  color: rgba(226, 232, 240, 0.94);
}

/*
 * 别用 grid 三等分。中文标签「跟随浏览器 / 中文 / EN」塞得进 1/3 格子，
 * 翻成英文后 "Follow browser" 要 68px、格子只有 56px，nowrap 又不许换行，
 * 文字就溢出格子压到隔壁标签上——而 is-on 的渐变只画在 1/3 宽的按钮盒上，
 * 于是出现「底色比文字短一截、文字骑到下一项头上」。
 * 改成 flex 按内容分配：flex-basis 取内容宽，谁长谁占得多，剩余空间再均分；
 * 真遇到更长的译文就靠 min-width:0 + ellipsis 截断，绝不再重叠。
 */
.lk-settings-pop .lk-settings-seg {
  display: flex;
  gap: 0.15rem;
  padding: 0.15rem;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.16);
}

.lk-settings-pop .lk-settings-seg__btn {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.3rem 0.35rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(71, 85, 105, 0.9);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.lk-settings-pop .lk-settings-seg__btn:hover {
  background: rgba(124, 58, 237, 0.1);
}

.lk-settings-pop .lk-settings-seg__btn.is-on {
  background: linear-gradient(120deg, #7c3aed, #ec4899);
  color: #fff;
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-seg {
  background: rgba(148, 163, 184, 0.18);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-seg__btn {
  color: rgba(226, 232, 240, 0.88);
}

.lk-settings-pop .lk-settings-field__hint {
  margin: 0.35rem 0 0;
  font-size: 0.66rem;
  line-height: 1.4;
  color: rgba(100, 116, 139, 0.92);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-field__hint {
  color: rgba(148, 163, 184, 0.92);
}

/* 翻译中 / 翻译失败：从导航栏地球搬过来的两个状态，失败必须显眼，否则等于静默失败。 */
.lk-settings-pop .lk-settings-field__hint.is-busy {
  color: rgba(37, 99, 235, 0.95);
}

.lk-settings-pop .lk-settings-field__hint.is-error {
  color: rgba(220, 38, 38, 0.95);
  font-weight: 600;
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-field__hint.is-busy {
  color: rgba(125, 176, 255, 0.95);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-field__hint.is-error {
  color: rgba(252, 129, 129, 0.95);
}

.lk-settings-pop .lk-settings-divider {
  height: 1px;
  margin: 0.18rem 0.4rem;
  background: rgba(148, 163, 184, 0.28);
}

:root[data-theme='dark'] .lk-settings-pop .lk-settings-divider {
  background: rgba(148, 163, 184, 0.22);
}

.lk-settings-pop-fade-enter-active,
.lk-settings-pop-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: 100% 0%;
}

.lk-settings-pop-fade-enter-from,
.lk-settings-pop-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.45rem) scale(0.94);
}
</style>
