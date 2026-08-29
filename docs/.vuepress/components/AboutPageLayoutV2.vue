<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DEFAULT_HERO,
  DEFAULT_HOME_BG_LIGHT,
  useHomeBackgroundSrc,
} from '../utils/homeVisualPref.js'
import { readAnchorScrollOffset, scrollElementVerticallyIntoView } from '../utils/scrollTarget.js'
import HomeTypewriterTagline from './HomeTypewriterTagline.vue'

const route = useRoute()
const router = useRouter()
const currentBackground = useHomeBackgroundSrc()
const ABOUT_INTRO_HASHES = new Set(['#about-intro', '#about-self-card'])
const MOBILE_HERO_MAX_WIDTH = 600
const MOBILE_PHONE_MAX_SHORT_SIDE = 600
const MOBILE_CARD_HIDE_BUFFER = 72
const MOBILE_CARD_HIDE_BUFFER_QUARK = 96
const MOBILE_QUARK_CENTER_LIFT_RATIO = 0.05
const MOBILE_QUARK_CENTER_DROP_PX = 20
const MOBILE_HERO_LAYOUT_EPSILON = 2
const MOBILE_HERO_DEBUG = false
const MOBILE_HERO_STABILIZE_DEBOUNCE_MS = 400
const PROFILE_PAIR_SYNC_MIN_WIDTH = 861
const PROFILE_PAIR_HEIGHT_EPSILON = 1
const mobileHeroHeight = ref('')
const mobileHeroStackOffset = ref('')
const profilePairHeight = ref('')
let mobileHeroFitFrame = 0
let profilePairSyncFrame = 0
let profilePairResizeObserver = null
let detachProfilePairSync = null
let profilePairLastHeightPx = 0
let detachMobileHeroFit = null
let mobileHeroStabilizeTimer = 0
let mobileHeroLastHeightPx = 0
let mobileHeroLastOffsetPx = 0

const pageStyle = computed(() => {
  const background = currentBackground.value || DEFAULT_HERO
  const style = {
    '--lk-about-page-bg': `url("${background}")`,
    '--lk-about-page-bg-light': `url("${DEFAULT_HOME_BG_LIGHT}")`,
  }
  if (mobileHeroHeight.value) {
    style['--lk-about-mobile-hero-height'] = mobileHeroHeight.value
  }
  if (mobileHeroStackOffset.value) {
    style['--lk-about-mobile-hero-stack-offset'] = mobileHeroStackOffset.value
  }
  if (profilePairHeight.value) {
    style['--lk-about-profile-pair-height'] = profilePairHeight.value
  }
  return style
})

function getIntroScrollTarget() {
  if (typeof document === 'undefined') return null
  return document.getElementById('about-self-card') || document.getElementById('about-intro')
}

function scrollToIntro(behavior = 'smooth') {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const intro = getIntroScrollTarget()
  if (!intro) return false
  return scrollElementVerticallyIntoView(intro, {
    behavior,
    offset: readAnchorScrollOffset(),
  })
}

function handleIntroClick(event) {
  const handled = scrollToIntro('smooth')
  if (!handled) return
  event?.preventDefault?.()
  if (typeof window !== 'undefined') {
    window.history.replaceState(window.history.state, '', '#about-self-card')
  }
}

function goToProjects() {
  void router.push('/tech/')
}

function getMobileViewportMetrics() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, screenHeight: 0, screenShortSide: 0 }
  }

  const viewport = window.visualViewport
  const screenWidth = Math.round(window.screen?.width || 0)
  const rawScreenHeight = Math.round(window.screen?.height || 0)
  const screenShortSideCandidates = [screenWidth, rawScreenHeight].filter(
    (value) => Number.isFinite(value) && value > 0,
  )

  return {
    width: Math.round(viewport?.width || window.innerWidth || 0),
    height: Math.round(viewport?.height || window.innerHeight || 0),
    screenHeight: Math.round(
      Math.max(screenWidth, rawScreenHeight, viewport?.height || 0, window.innerHeight || 0),
    ),
    screenShortSide: screenShortSideCandidates.length
      ? Math.min(...screenShortSideCandidates)
      : 0,
  }
}

function shouldFitHeroToMobileViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const isCoarsePointer =
    window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false
  if (!isCoarsePointer) return false

  if (document.documentElement.classList.contains('lk-phone-viewport')) return true
  if (document.documentElement.classList.contains('lk-quark-browser')) return true

  const { width, screenShortSide } = getMobileViewportMetrics()
  if (screenShortSide && screenShortSide <= MOBILE_PHONE_MAX_SHORT_SIDE) return true
  return Boolean(width && width <= MOBILE_HERO_MAX_WIDTH)
}

function getVisibleViewportCenterY(viewport = window.visualViewport) {
  const height = Math.round(viewport?.height || window.innerHeight || 0)
  const offsetTop = Math.round(viewport?.offsetTop || 0)
  if (!height) return 0
  return Math.round(offsetTop + height / 2)
}

function getMobileCardHideBuffer() {
  if (typeof document === 'undefined') return MOBILE_CARD_HIDE_BUFFER
  return document.documentElement.classList.contains('lk-quark-browser')
    ? MOBILE_CARD_HIDE_BUFFER_QUARK
    : MOBILE_CARD_HIDE_BUFFER
}

/** Quark often reports a shorter visual viewport; nudge the hero stack slightly below optical center. */
function getMobileHeroStackCenterY(viewport = window.visualViewport) {
  const centerY = getVisibleViewportCenterY(viewport)
  if (
    typeof document === 'undefined' ||
    !document.documentElement.classList.contains('lk-quark-browser')
  ) {
    return centerY
  }
  const pageHeight = Math.round(window.innerHeight || viewport?.height || 0)
  if (!pageHeight) return centerY + MOBILE_QUARK_CENTER_DROP_PX
  return (
    centerY -
    Math.round(pageHeight * MOBILE_QUARK_CENTER_LIFT_RATIO) +
    MOBILE_QUARK_CENTER_DROP_PX
  )
}

function getStackNaturalCenterY(overlay, stack) {
  const overlayRect = overlay.getBoundingClientRect()
  const paddingTop = Number.parseFloat(getComputedStyle(overlay).paddingTop) || 0
  return overlayRect.top + paddingTop + stack.offsetHeight / 2
}

function logMobileHeroFitDebug(payload) {
  if (!MOBILE_HERO_DEBUG || typeof console === 'undefined') return
  console.info('[lk-about-mobile-hero]', payload)
}

function shouldSyncProfilePairHeight() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (document.documentElement.classList.contains('lk-about-profile-center')) return false
  const layoutWidth = Math.round(document.documentElement?.clientWidth || window.innerWidth || 0)
  return layoutWidth >= PROFILE_PAIR_SYNC_MIN_WIDTH
}

function getMiniProfileCardEl() {
  if (typeof document === 'undefined') return null
  return document.querySelector('#about-self-card .lk-card--mini')
}

function syncProfilePairHeight() {
  if (typeof document === 'undefined') return

  if (!shouldSyncProfilePairHeight()) {
    profilePairLastHeightPx = 0
    profilePairHeight.value = ''
    return
  }

  const miniCard = getMiniProfileCardEl()
  if (!miniCard) {
    profilePairLastHeightPx = 0
    profilePairHeight.value = ''
    return
  }

  const nextHeight = Math.round(miniCard.getBoundingClientRect().height)
  if (!nextHeight) return

  if (Math.abs(nextHeight - profilePairLastHeightPx) >= PROFILE_PAIR_HEIGHT_EPSILON) {
    profilePairLastHeightPx = nextHeight
    profilePairHeight.value = `${nextHeight}px`
  }
}

function queueProfilePairHeightSync() {
  if (typeof window === 'undefined') return
  if (profilePairSyncFrame) window.cancelAnimationFrame(profilePairSyncFrame)
  profilePairSyncFrame = window.requestAnimationFrame(() => {
    profilePairSyncFrame = 0
    syncProfilePairHeight()
    nextTick(() => {
      syncProfilePairHeight()
    })
  })
}

function setupProfilePairSync() {
  if (typeof window === 'undefined') return

  const observeMiniCard = () => {
    profilePairResizeObserver?.disconnect()
    profilePairResizeObserver = null
    const miniCard = getMiniProfileCardEl()
    if (!miniCard || typeof ResizeObserver === 'undefined') return
    profilePairResizeObserver = new ResizeObserver(() => {
      queueProfilePairHeightSync()
    })
    profilePairResizeObserver.observe(miniCard)
  }

  const onViewportChange = () => {
    queueProfilePairHeightSync()
    observeMiniCard()
  }

  window.addEventListener('resize', onViewportChange)
  window.addEventListener('pageshow', onViewportChange)
  window.visualViewport?.addEventListener('resize', onViewportChange)

  detachProfilePairSync = () => {
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('pageshow', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    profilePairResizeObserver?.disconnect()
    profilePairResizeObserver = null
  }

  observeMiniCard()
  queueProfilePairHeightSync()
}

function syncMobileHeroHeight() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  if (!shouldFitHeroToMobileViewport()) {
    mobileHeroHeight.value = ''
    mobileHeroStackOffset.value = ''
    mobileHeroLastHeightPx = 0
    mobileHeroLastOffsetPx = 0
    return
  }

  // Only adjust near the landing position so the hero does not keep shifting after manual scrolling.
  if ((window.scrollY || 0) > 16) return

  const hero = document.querySelector('.lk-about-v2-hero')
  const overlay = hero?.querySelector?.('.lk-about-v2-hero__overlay')
  const stack = overlay?.querySelector?.('.lk-about-v2-hero__stack')
  const card = document.getElementById('about-self-card')
  if (!hero || !overlay || !stack || !card) return

  const viewport = window.visualViewport
  const { height: viewportHeight } = getMobileViewportMetrics()
  if (!viewportHeight) return

  const heroRect = hero.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const contentMinHeight = Math.ceil(overlay.scrollHeight)

  const desiredCardTop = viewportHeight + getMobileCardHideBuffer()
  const cardDelta = desiredCardTop - cardRect.top
  const cardDrivenHeroHeight = Math.max(
    viewportHeight,
    contentMinHeight,
    Math.round(heroRect.height + cardDelta),
  )
  if (Math.abs(cardDrivenHeroHeight - mobileHeroLastHeightPx) >= MOBILE_HERO_LAYOUT_EPSILON) {
    mobileHeroLastHeightPx = cardDrivenHeroHeight
    mobileHeroHeight.value = `${cardDrivenHeroHeight}px`
  }

  const stackCenterY = getMobileHeroStackCenterY(viewport)
  const naturalStackCenterY = getStackNaturalCenterY(overlay, stack)
  const nextStackOffset = Math.round(stackCenterY - naturalStackCenterY)
  if (Math.abs(nextStackOffset - mobileHeroLastOffsetPx) >= MOBILE_HERO_LAYOUT_EPSILON) {
    mobileHeroLastOffsetPx = nextStackOffset
    mobileHeroStackOffset.value = `${nextStackOffset}px`
  }

  logMobileHeroFitDebug({
    viewportHeight,
    stackCenterY,
    naturalStackCenterY,
    nextStackOffset,
    cardDrivenHeroHeight,
    cardTop: Math.round(cardRect.top),
    desiredCardTop,
  })
}

function queueMobileHeroHeightSync() {
  if (typeof window === 'undefined') return
  if (mobileHeroFitFrame) window.cancelAnimationFrame(mobileHeroFitFrame)
  mobileHeroFitFrame = window.requestAnimationFrame(() => {
    mobileHeroFitFrame = 0
    syncMobileHeroHeight()
    nextTick(() => {
      syncMobileHeroHeight()
    })
  })
}

function clearMobileHeroStabilizeTimer() {
  if (!mobileHeroStabilizeTimer || typeof window === 'undefined') return
  window.clearTimeout(mobileHeroStabilizeTimer)
  mobileHeroStabilizeTimer = 0
}

function scheduleMobileHeroStabilizeSync() {
  if (typeof window === 'undefined') return
  clearMobileHeroStabilizeTimer()
  mobileHeroStabilizeTimer = window.setTimeout(() => {
    mobileHeroStabilizeTimer = 0
    queueMobileHeroHeightSync()
  }, MOBILE_HERO_STABILIZE_DEBOUNCE_MS)
}

function setupMobileHeroFit() {
  if (typeof window === 'undefined') return

  const onViewportChange = () => {
    queueMobileHeroHeightSync()
    scheduleMobileHeroStabilizeSync()
  }

  window.addEventListener('resize', onViewportChange)
  window.addEventListener('orientationchange', onViewportChange)
  window.addEventListener('pageshow', onViewportChange)
  window.visualViewport?.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('scrollend', onViewportChange)

  detachMobileHeroFit = () => {
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('orientationchange', onViewportChange)
    window.removeEventListener('pageshow', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scrollend', onViewportChange)
  }

  queueMobileHeroHeightSync()
  scheduleMobileHeroStabilizeSync()
  window.requestAnimationFrame(() => {
    queueMobileHeroHeightSync()
  })
}

function scrollToIntroIfHash() {
  if (typeof document === 'undefined') return
  if (!ABOUT_INTRO_HASHES.has(route.hash)) return
  nextTick(() => {
    scrollToIntro('auto')
  })
}

onMounted(() => {
  scrollToIntroIfHash()
  setupMobileHeroFit()
  setupProfilePairSync()
})

onBeforeUnmount(() => {
  detachMobileHeroFit?.()
  detachMobileHeroFit = null
  detachProfilePairSync?.()
  detachProfilePairSync = null
  if (mobileHeroFitFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(mobileHeroFitFrame)
    mobileHeroFitFrame = 0
  }
  if (profilePairSyncFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(profilePairSyncFrame)
    profilePairSyncFrame = 0
  }
  if (typeof window !== 'undefined') {
    clearMobileHeroStabilizeTimer()
  }
})

watch(() => route.hash, scrollToIntroIfHash)
watch(currentBackground, () => {
  nextTick(() => {
    queueMobileHeroHeightSync()
    scheduleMobileHeroStabilizeSync()
    queueProfilePairHeightSync()
  })
})
</script>

<template>
  <div class="lk-about-fullbleed lk-about-v2" :style="pageStyle">
    <section class="lk-about-v2-hero" aria-label="关于我首屏">
      <div class="lk-about-v2-hero__overlay">
        <div class="lk-about-v2-hero__stack">
          <h1 class="lk-about-v2-hero__title">你好，我是 Luke</h1>
          <HomeTypewriterTagline class="lk-about-v2-hero__typewriter" text="Welcome to my blog!" />
          <div class="lk-about-v2-hero__actions" role="group" aria-label="快捷入口">
            <a
              href="#about-self-card"
              class="lk-about-v2-hero__btn lk-about-v2-hero__btn--primary"
              aria-controls="about-self-card"
              @click="handleIntroClick"
            >
              <span class="lk-about-v2-hero__btn-label">了解我</span>
              <span class="lk-about-v2-hero__btn-arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </a>
            <button
              type="button"
              class="lk-about-v2-hero__btn lk-about-v2-hero__btn--secondary"
              @click="goToProjects"
            >
              <span class="lk-about-v2-hero__btn-label">查看项目</span>
              <span class="lk-about-v2-hero__btn-arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section id="about-intro" class="lk-about-v2-main">
      <div class="lk-about-v2-main__grid lk-about-v2-main__grid--triple">
        <div class="lk-about-v2-main__col lk-about-v2-main__col--main">
          <div
            class="about-profile about-profile--vstack"
            :data-lk-profile-pair-sync="profilePairHeight ? '1' : undefined"
          >
            <div id="about-self-card" class="about-left">
              <!-- 图 1 / 图 4 同款小卡片：方角头像 + Luke + 3 个社交圆钮 -->
              <ProfileCard mini />
            </div>

            <div class="about-right">
              <div class="about-card about-card--intro">
                <h2>简介</h2>
                <p class="about-role-line">关注产品、技术和跨文化体验。</p>
                <p class="about-bio">
                  我喜欢把复杂信息整理成更清晰的结构，也持续在嵌入式、前端和 AI 工具方向做项目实践。
                </p>
                <div class="about-tags-strip" aria-label="技能与兴趣">
                  <div class="about-tags about-tags--tech">
                    <span class="about-tag about-tag--embedded">嵌入式开发</span>
                    <span class="about-tag about-tag--frontend">前端体验</span>
                    <span class="about-tag about-tag--systems">系统工程</span>
                    <span class="about-tag about-tag--photo">摄影观察</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="lk-about-v2-main__projects">
            <AboutArticleRecommend />
          </div>
        </div>

        <aside class="lk-about-v2-main__col lk-about-v2-main__col--timeline" aria-label="动态时间线与归档">
          <AboutTimeline />
        </aside>
      </div>
    </section>
  </div>
</template>
