import { ClientOnly, defineClientConfig } from 'vuepress/client'
import { createApp, defineComponent, h, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import HomeSidePanel from './components/HomeSidePanel.vue'
import HomeTypewriterTagline from './components/HomeTypewriterTagline.vue'
import ProfileCard from './components/ProfileCard.vue'
import ProjectNineGrid from './components/ProjectNineGrid.vue'
import ProjectCardsGrid from './components/ProjectCardsGrid.vue'
import SiteFooter from './components/SiteFooter.vue'
import SettingsFab from './components/SettingsFab.vue'
import LoginGate from './components/LoginGate.vue'
import ArticleCategoriesAside from './components/ArticleCategoriesAside.vue'
import AboutTimeline from './components/AboutTimeline.vue'
import AboutArticleRecommend from './components/AboutArticleRecommend.vue'
import AboutCategoriesCard from './components/AboutCategoriesCard.vue'
import AboutPageLayoutV2 from './components/AboutPageLayoutV2.vue'
import AboutMePage from './components/AboutMePage.vue'
import VisitedChinaFootprints from './components/VisitedChinaFootprints.vue'
import StatsEntryGrid from './components/StatsEntryGrid.vue'
import StatsBigBoard from './components/StatsBigBoard.vue'
import ArticleIndexList from './components/ArticleIndexList.vue'
import ProjectPortfolio from './components/ProjectPortfolio.vue'
import ProductManagerCases from './components/ProductManagerCases.vue'
import ProjectsSidebarFilters from './components/ProjectsSidebarFilters.vue'
import ProjectsRolesCard from './components/ProjectsRolesCard.vue'
import SiteAvatar from './components/SiteAvatar.vue'
import CursorEffect from './components/CursorEffect.vue'
import {
  AUTH_STATE_EVENT,
  authedRef,
  isPublicPath,
  normPath,
  readAuthed,
} from './utils/authGate.js'
import { techDetailProjectItems } from './data/projectsCatalog.js'
import { TRANSLATE_LANG_EVENT } from './utils/translatePref.js'
import {
  LIVE2D_PREF_EVENT,
  LIVE2D_PREF_KEY,
  readLive2dPref,
} from './utils/live2dPref.js'
import {
  accessControlledPageOptions,
  HIDDEN_NAV_ITEMS_EVENT,
  PROTECTED_ACCESS_EVENT,
  navbarPageOptions,
  readHiddenNavItems,
  readProtectedAccessItems,
  siteNavbarLinks,
} from './utils/navPrefs.js'
import NetworkParticlesBg from './components/NetworkParticlesBg.vue'
import ParticlesNavbarToggle from './components/ParticlesNavbarToggle.vue'
import PublishFab from './components/PublishFab.vue'
import ArticleBatchOps from './components/ArticleBatchOps.vue'
import RoutePageCurtain from './components/RoutePageCurtain.vue'
import { readAnchorScrollOffset, scrollHashVertically } from './utils/scrollTarget.js'
import { readAvatar } from './utils/avatarPref.js'
import { reportVisit } from './utils/visitorLog.js'
import {
  DEFAULT_HOME_BG_LIGHT,
  DEFAULT_HERO,
  HOME_VISUAL_PREF_EVENT,
  readHomeBackground,
} from './utils/homeVisualPref.js'

/** Canvas + rAF: keep out of SSR to avoid Node rAF spin / heap growth during prerender. */
const NetworkParticlesBgClient = defineComponent({
  name: 'NetworkParticlesBgClient',
  setup() {
    return () => h(ClientOnly, null, () => h(NetworkParticlesBg))
  },
})

const ParticlesNavbarToggleClient = defineComponent({
  name: 'ParticlesNavbarToggleClient',
  setup() {
    return () => h(ClientOnly, null, () => h(ParticlesNavbarToggle))
  },
})

const ArticleCategoriesAsideClient = defineComponent({
  name: 'ArticleCategoriesAsideClient',
  setup() {
    return () => h(ClientOnly, null, () => h(ArticleCategoriesAside))
  },
})

/** Teleport + DOM anchors: render only on client to avoid SSR/prerender vs client markup drift (e.g. About). */
const LoginGateClient = defineComponent({
  name: 'LoginGateClient',
  setup() {
    return () => h(ClientOnly, null, () => h(LoginGate))
  },
})

const PublishFabClient = defineComponent({
  name: 'PublishFabClient',
  setup() {
    return () => h(ClientOnly, null, () => h(PublishFab))
  },
})

const ArticleBatchOpsClient = defineComponent({
  name: 'ArticleBatchOpsClient',
  setup() {
    return () => h(ClientOnly, null, () => h(ArticleBatchOps))
  },
})

const RoutePageCurtainClient = defineComponent({
  name: 'RoutePageCurtainClient',
  setup() {
    return () => h(ClientOnly, null, () => h(RoutePageCurtain))
  },
})

/** 客户端导航到带 hash 的地址（如 `/about#about-intro`）时，确保滚到对应锚点，避免「关于我」与首屏同页却停在顶栏像又点了首页。 */
function scrollToRouteHash(to) {
  if (typeof document === 'undefined' || !to?.hash) return
  const hash = to.hash === '#about-intro' ? '#about-self-card' : to.hash
  const tryOnce = () =>
    scrollHashVertically(hash, {
      behavior: 'auto',
      offset: readAnchorScrollOffset(),
    })
  const run = (attempt) => {
    if (tryOnce() || attempt > 40) return
    requestAnimationFrame(() => run(attempt + 1))
  }
  nextTick(() => run(0))
}

/** 站点根路径 `/`（README）= Hope 首页，用于 `lk-site-non-home` 等 */
function isSiteHomePath(path) {
  if (path === undefined) {
    if (typeof window === 'undefined') return false
    path = window.location?.pathname
  }
  const p = normPath(path)
  return p === '/' || p === '/index'
}

function canAccessPath(path) {
  const blockedIds = new Set(readProtectedAccessItems())
  const matched = accessControlledPageOptions.find((item) => item.matches(path))
  // Access control panel decides what is blocked.
  // Login is only required to operate the UI, not to view pages that are not blocked.
  if (matched) return !blockedIds.has(matched.id)
  if (isPublicPath(path)) return true
  return readAuthed()
}

function normalizeAnchorPath(href) {
  if (!href || typeof window === 'undefined') return ''
  try {
    const url = new URL(href, window.location.origin)
    return normPath(url.pathname)
  } catch {
    return ''
  }
}

function findNavHideTarget(anchor) {
  return (
    anchor.closest('.vp-navbar-item') ||
    anchor.closest('.vp-dropdown-wrapper') ||
    anchor.closest('.vp-sidebar-item') ||
    anchor.closest('.vp-dropdown-item') ||
    anchor.closest('.vp-nav-item') ||
    anchor.closest('li') ||
    anchor
  )
}

function clearManagedNavbarVisibility() {
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('[data-lk-hidden-nav-item="1"]')) {
    el.style.display = ''
    el.removeAttribute('data-lk-hidden-nav-item')
    el.removeAttribute('data-lk-hidden-nav-id')
  }
}

function clearManagedHomeFeatureVisibility() {
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('[data-lk-hidden-home-entry="1"]')) {
    el.style.display = ''
    el.removeAttribute('data-lk-hidden-home-entry')
    el.removeAttribute('data-lk-hidden-nav-id')
  }
}

function applyHiddenNavbarItems() {
  if (typeof document === 'undefined') return
  clearManagedNavbarVisibility()

  const hiddenIds = new Set(readHiddenNavItems())
  if (!hiddenIds.size) return

  const matchers = navbarPageOptions.filter((item) => hiddenIds.has(item.id))
  const roots = [document.getElementById('navbar'), document.getElementById('nav-screen')].filter(Boolean)

  for (const root of roots) {
    for (const anchor of root.querySelectorAll('a[href]')) {
      const path = normalizeAnchorPath(anchor.getAttribute('href') || anchor.href)
      if (!path) continue
      const matched = matchers.find((item) => item.matches(path))
      if (!matched) continue
      const target = findNavHideTarget(anchor)
      target.style.display = 'none'
      target.setAttribute('data-lk-hidden-nav-item', '1')
      target.setAttribute('data-lk-hidden-nav-id', matched.id)
    }

    for (const wrapper of root.querySelectorAll('.vp-dropdown-wrapper')) {
      const links = [...wrapper.querySelectorAll('.vp-dropdown-item, .vp-dropdown-link, li, a[href]')]
      const visibleItems = links.filter((el) => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
      if (visibleItems.length === 0) {
        wrapper.style.display = 'none'
        wrapper.setAttribute('data-lk-hidden-nav-item', '1')
        wrapper.setAttribute('data-lk-hidden-nav-id', 'dropdown-empty')
      }
    }
  }
}

function applyHiddenHomeEntries() {
  if (typeof document === 'undefined') return
  clearManagedHomeFeatureVisibility()

  const hiddenIds = new Set(readHiddenNavItems())
  if (!hiddenIds.size) return

  const matchers = navbarPageOptions.filter((item) => hiddenIds.has(item.id))
  const homeRoot = document.querySelector('.page-home')
  if (!homeRoot) return

  for (const anchor of homeRoot.querySelectorAll('a[href]')) {
    const path = normalizeAnchorPath(anchor.getAttribute('href') || anchor.href)
    if (!path) continue
    const matched = matchers.find((item) => item.matches(path))
    if (!matched) continue
    const target =
      anchor.closest('.vp-feature') ||
      anchor.closest('.feature') ||
      anchor.closest('li') ||
      anchor
    target.style.display = 'none'
    target.setAttribute('data-lk-hidden-home-entry', '1')
    target.setAttribute('data-lk-hidden-nav-id', matched.id)
  }
}

function ensureNavbarHideObserver() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  if (navbarHideObserver) return
  navbarHideObserver = new MutationObserver(() => {
    applyHiddenNavbarItems()
    applyHiddenHomeEntries()
  })
  navbarHideObserver.observe(document.body, { childList: true, subtree: true })
}

/** 看板娘显隐仅由导航栏开关 + localStorage（`live2dPref.js`）控制，全站路由一致。 */
function isLive2dHiddenPath(path) {
  const p = normPath(path)
  return (
    p === '/about' ||
    p.startsWith('/about/') ||
    p === '/stats' ||
    p.startsWith('/stats/') ||
    p === '/tech' ||
    p.startsWith('/tech/') ||
    p === '/article' ||
    p.startsWith('/article/')
  )
}

function applyLive2dRouteClass(path) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(
    'lk-live2d-route-hidden',
    isLive2dHiddenPath(path),
  )
}

function applyLive2dUserClass() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('lk-live2d-user-off', !readLive2dPref())
}

function syncLive2dPref() {
  applyLive2dUserClass()
  if (isLive2dHiddenPath(window.location.pathname)) return
  if (readLive2dPref()) {
    initLive2DScript()
    tryMountLive2dModel()
    nudgeLive2dForCurrentRoute()
  }
}

function onLive2dPrefStorage(e) {
  if (typeof window === 'undefined') return
  if (e.key === LIVE2D_PREF_KEY || e.key === null) syncLive2dPref()
}

/**
 * 与当前目标路由同步到 <html data-lk-route>（normPath），供 index.scss 在「过渡帧」隐藏未卸载的旧页 DOM。
 * 比 theme-container 的 pageClass 更早，可避免 /tech ↔ /article 同帧内 :has() 仍命中旧结构而闪一帧 Projects 左栏。
 */
function syncRouteDataAttr(path) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-lk-route', normPath(path))
}

/** About / Projects / Article：无面包屑，标题与 meta 同一行底对齐 + 下划线（见 index.scss `.lk-header-split`） */
function syncSplitPageHeader(path) {
  if (typeof document === 'undefined') return
  const p = normPath(path)
  const use =
    p === '/' ||
      p === '/index' ||
      p === '/about' ||
      p.startsWith('/about/') ||
      p === '/stats' ||
      p.startsWith('/stats/') ||
      p === '/tech' ||
      p.startsWith('/tech/') ||
      p === '/article' ||
      p.startsWith('/article/')
  document.documentElement.classList.toggle('lk-header-split', use)
}

function isProjectPostPath(path) {
  const p = resolveRouteLikePath(path)
  return p.startsWith('/tech/') && p !== '/tech'
}

function isPortfolioPostPath(path) {
  return isArticlePostPath(path) || isProjectPostPath(path)
}

function queryPortfolioPostThemeContainer() {
  return (
    document.querySelector('.theme-container.page-article-post') ||
    document.querySelector('main.vp-page.page-article-post')?.closest('.theme-container') ||
    null
  )
}

function syncArticleRouteClasses(path) {
  if (typeof document === 'undefined') return false
  const p = normPath(path)
  const themeContainer = document.querySelector('.theme-container')
  if (!themeContainer) return false

  const mainPage = themeContainer.querySelector('main.vp-page')
  const isPortfolioDetail = isArticlePostPath(p) || isProjectPostPath(p)
  // Hope 有时把 pageClass 挂在 main 上；主题容器必须带 page-article-post 才能命中侧栏/纸面规则
  if (isPortfolioDetail) {
    themeContainer.classList.add('page-article-post')
    mainPage?.classList.add('page-article-post')
  } else {
    themeContainer.classList.remove('page-article-post')
    mainPage?.classList.remove('page-article-post')
  }
  themeContainer.classList.toggle('page-article-index', p === '/article')
  document.documentElement.classList.toggle('lk-tech-detail-post', isProjectPostPath(p))
  return true
}

function portfolioRouteClassesApplied(path) {
  if (typeof document === 'undefined') return true
  const p = normPath(path)
  const isPortfolioDetail = isArticlePostPath(p) || isProjectPostPath(p)
  if (!isPortfolioDetail) return true

  const themeContainer = document.querySelector('.theme-container')
  const mainPage = themeContainer?.querySelector('main.vp-page')
  if (!themeContainer?.classList.contains('page-article-post')) return false
  if (mainPage && !mainPage.classList.contains('page-article-post')) return false
  return true
}

let portfolioRouteClassObserver = null

function attachPortfolioRouteClassObserver() {
  if (typeof document === 'undefined' || portfolioRouteClassObserver) return

  const bind = () => {
    const themeContainer = document.querySelector('.theme-container')
    if (!themeContainer) return false

    portfolioRouteClassObserver = new MutationObserver(() => {
      const path = window.location.pathname
      if (!isPortfolioPostPath(path)) return
      if (!portfolioRouteClassesApplied(path)) {
        syncArticleRouteClasses(path)
      }
    })
    portfolioRouteClassObserver.observe(themeContainer, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return true
  }

  if (!bind()) {
    window.setTimeout(() => {
      if (!portfolioRouteClassObserver) bind()
    }, 0)
  }
}

function detachPortfolioRouteClassObserver() {
  portfolioRouteClassObserver?.disconnect()
  portfolioRouteClassObserver = null
}

/** Hope 路由切换后会清掉 theme-container 上的 pageClass，需重试直到纸面/TOC 规则能命中。 */
function scheduleArticleRouteClasses(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  syncArticleRouteClasses(resolvedPath)

  if (portfolioRouteClassesApplied(resolvedPath)) return

  if (attempt < 40) {
    window.setTimeout(() => {
      scheduleArticleRouteClasses(resolvedPath, attempt + 1)
    }, 32)
  }
}

const PHONE_INLINE_NAV_MEDIA = '(max-width: 719px)'
const PHONE_INLINE_NAV_MAX_WIDTH = 719

/*
 * 主题自带的导航项挂着 `hide-in-mobile`，只有 719px 以下才真的被隐藏，那时才需要补一份行内导航。
 * 以前这里写 959px：720~959px 主题导航还在显示，补进去的那份就并排排在后面，
 * 于是「首页 项目 文章 关于我」会重复出现两遍（缩放到 150% 的窄窗口最容易撞上）。
 */
function shouldShowPhoneInlineNav() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.(PHONE_INLINE_NAV_MEDIA)?.matches) return true
  const layoutWidth = Math.round(
    document.documentElement?.clientWidth || window.innerWidth || 0,
  )
  return layoutWidth > 0 && layoutWidth <= PHONE_INLINE_NAV_MAX_WIDTH
}

function restorePhoneInlineNavbar() {
  if (typeof document === 'undefined') return

  for (const nav of document.querySelectorAll('.lk-phone-inline-nav[data-lk-phone-inline-nav="1"]')) {
    nav.remove()
  }

  for (const center of document.querySelectorAll('.vp-navbar-center[data-lk-phone-inline-nav-host="1"]')) {
    center.remove()
  }

  for (const center of document.querySelectorAll('.vp-navbar-center.lk-phone-inline-nav-host')) {
    center.classList.remove('lk-phone-inline-nav-host')
  }
}

const NAV_OVERFLOW_ATTR = 'data-lk-nav-overflow'
const NAV_HIDDEN_ATTR = 'data-lk-nav-hidden'
/* 设置齿轮在宽屏是导航列表的第五项，但它是控件不是导航项，不参与让位。 */
const NAV_FIT_KEEP = '#lk-logout-anchor, .lk-nav-settings-item'

/**
 * 中间导航放不下时，从右往左整项隐藏，直到剩下的都能完整显示。
 *
 * 判据用的是「首项左边缘 / 末项右边缘有没有越出居中区」，也就是用户真正看到的
 * 被裁切/被压住，而不是 scrollWidth 这类容易被 flex 收缩糊弄过去的量。
 * 只要藏了东西就给导航栏打上 data-lk-nav-overflow，CSS 会把汉堡按钮放出来兜底。
 */
function fitNavbarItems() {
  if (typeof document === 'undefined') return

  const navbar = document.getElementById('navbar')
  if (!navbar) return

  const center = navbar.querySelector('.vp-navbar-center')
  const list =
    center &&
    (center.querySelector('.lk-phone-inline-nav') ||
      center.querySelector('.vp-nav-links') ||
      center.querySelector('.vp-nav-items'))

  if (!center || !list) {
    navbar.removeAttribute(NAV_OVERFLOW_ATTR)
    return
  }

  const candidates = [...list.children].filter((el) => {
    if (el.matches(NAV_FIT_KEEP)) return false
    // 访客在设置里手动隐藏的导航项已经 display:none，别把它算进来。
    if (el.getAttribute('data-lk-hidden-nav-item') === '1') return false
    return true
  })
  if (!candidates.length) {
    navbar.removeAttribute(NAV_OVERFLOW_ATTR)
    return
  }

  // 先全放出来再量：否则上一轮的隐藏结果会让它「永远放得下」，窗口变宽也不会复原。
  for (const item of candidates) item.removeAttribute(NAV_HIDDEN_ATTR)
  navbar.removeAttribute(NAV_OVERFLOW_ATTR)

  /*
   * 量的是「列表里所有还在显示的东西」，不只是能让位的导航项 ——
   * 宽屏时设置齿轮就排在导航列表末尾，它不参与隐藏，但它一样会被裁掉，
   * 所以必须算进右边界，让导航项替它让出位置。
   */
  const fits = () => {
    const shown = [...list.children].filter(
      (el) =>
        !el.hasAttribute(NAV_HIDDEN_ATTR) && el.getAttribute('data-lk-hidden-nav-item') !== '1',
    )
    if (!shown.length) return true
    const bounds = center.getBoundingClientRect()
    const first = shown[0].getBoundingClientRect()
    const last = shown[shown.length - 1].getBoundingClientRect()
    return first.left >= bounds.left - 1 && last.right <= bounds.right + 1
  }

  // 全都装得下：不用藏任何东西，汉堡也不用出来。
  if (fits()) return

  /*
   * 装不下 → 汉堡必须出来兜底，而汉堡自己也要占宽度（实测约 33px）。
   * 必须先把它放出来再量：之前是量完才设 overflow 属性，量到的是「还没有汉堡」的
   * 宽度，于是多留了一项，等汉堡渲染出来又把那一项挤成半个字（"Articles" 只剩一半）。
   */
  navbar.setAttribute(NAV_OVERFLOW_ATTR, '1')

  let hidden = 0
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (fits()) break
    candidates[i].setAttribute(NAV_HIDDEN_ATTR, '1')
    hidden += 1
  }

  if (!hidden) navbar.removeAttribute(NAV_OVERFLOW_ATTR)
}

let navFitFrame = null

/** 量宽度要在布局稳定之后，统一挪到下一帧，顺便把连续触发合并成一次。 */
function scheduleNavFit() {
  if (typeof window === 'undefined' || navFitFrame != null) return
  navFitFrame = window.requestAnimationFrame(() => {
    navFitFrame = null
    fitNavbarItems()
  })
}

function syncPhoneInlineNavbar(path) {
  if (typeof document === 'undefined') return true

  if (!shouldShowPhoneInlineNav()) {
    restorePhoneInlineNavbar()
    scheduleNavFit()
    return true
  }

  const navbar = document.getElementById('navbar')
  if (!navbar) return false

  let center = navbar.querySelector('.vp-navbar-center')
  if (!center) {
    center = document.createElement('div')
    center.className = 'vp-navbar-center hide-in-mobile lk-phone-inline-nav-host'
    center.dataset.lkPhoneInlineNavHost = '1'
    const end = navbar.querySelector('.vp-navbar-end')
    if (end) navbar.insertBefore(center, end)
    else navbar.appendChild(center)
  } else {
    center.classList.add('lk-phone-inline-nav-host')
  }

  if (!center.querySelector('.lk-phone-inline-nav[data-lk-phone-inline-nav="1"]')) {
    const nav = document.createElement('nav')
    nav.className = 'vp-nav-items lk-phone-inline-nav'
    nav.setAttribute('aria-label', '站点导航')
    nav.dataset.lkPhoneInlineNav = '1'

    for (const item of siteNavbarLinks) {
      const li = document.createElement('div')
      li.className = 'vp-nav-item'
      const anchor = document.createElement('a')
      anchor.className = 'route-link auto-link'
      anchor.href = item.href
      anchor.textContent = item.text
      li.appendChild(anchor)
      nav.appendChild(li)
    }

    const existingNav = center.querySelector('.vp-nav-items:not([data-lk-phone-inline-nav="1"])')
    if (existingNav) center.insertBefore(nav, existingNav.nextSibling)
    else center.appendChild(nav)
  }

  syncNavbarSection(path)
  applyHiddenNavbarItems()
  scheduleNavFit()
  return true
}

function schedulePhoneInlineNavbar(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncPhoneInlineNavbar(resolvedPath)) return

  if (attempt < 24) {
    window.setTimeout(() => {
      schedulePhoneInlineNavbar(resolvedPath, attempt + 1)
    }, 32)
  }
}

function syncNavbarSection(path) {
  if (typeof document === 'undefined') return
  const p = normPath(path)
  let activePrefix = ''
  if (p === '/tech' || p.startsWith('/tech/')) activePrefix = '/tech'
  else if (p === '/article' || p.startsWith('/article/')) activePrefix = '/article'

  for (const item of document.querySelectorAll('.vp-navbar .vp-nav-item')) {
    const anchor = item.querySelector('a[href]')
    if (!anchor) continue
    const href = normPath(anchor.getAttribute('href') || '')
    const isActive =
      activePrefix &&
      (href === activePrefix || href === `${activePrefix}/` || href.startsWith(`${activePrefix}/`))
    item.classList.toggle('vp-active', Boolean(isActive))
    anchor.classList.toggle('route-link-active', Boolean(isActive))
    anchor.classList.toggle('router-link-active', Boolean(isActive))
  }
}

/** After hydration: toggles navbar/sidebar glass styles on non-home routes. */
function syncSiteNonHomeClass(path) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(
    'lk-site-non-home',
    !isSiteHomePath(path),
  )
}

/** Edge/Chromium: bump compositor layers for navbar/sidebar after navigation. */
function nudgeNavbarSidebarRepaint() {
  if (typeof document === 'undefined') return
  const els = document.querySelectorAll('.vp-navbar, .vp-sidebar')
  if (!els.length) return
  requestAnimationFrame(() => {
    for (const el of els) {
      el.style.transform = 'translateZ(0.02px)'
    }
    requestAnimationFrame(() => {
      for (const el of els) {
        el.style.transform = ''
      }
    })
  })
}

let navbarHideObserver = null
const PHONE_VIEWPORT_CLASS = 'lk-phone-viewport'
const PHONE_VIEWPORT_ATTR = 'data-lk-phone-viewport'
const QUARK_BROWSER_CLASS = 'lk-quark-browser'
const QUARK_BROWSER_ATTR = 'data-lk-quark-browser'
const HUAWEI_BROWSER_CLASS = 'lk-huawei-browser'
const HUAWEI_BROWSER_ATTR = 'data-lk-huawei-browser'
const PHONE_VIEWPORT_MAX_SHORT_SIDE = 600
const PHONE_VIEWPORT_MAX_LAYOUT_WIDTH = 719
const PHONE_LAYOUT_WIDTH_MISMATCH_RATIO = 1.15
const PHONE_VIEWPORT_STABILIZE_DELAYS = [120, 320, 700]
const ABOUT_PROFILE_CENTER_CLASS = 'lk-about-profile-center'
const ABOUT_PROFILE_CENTER_ATTR = 'data-lk-about-profile-center'
/** innerWidth / screen.width below this on a near-fullscreen tab ≈ browser zoom ≥ ~133% */
const ABOUT_PROFILE_ZOOM_WIDTH_RATIO = 0.72
const ABOUT_PROFILE_FULLSCREEN_WIDTH_RATIO = 0.85
let phoneViewportListenersAttached = false
let phoneViewportHandler = null
const phoneViewportTimers = new Set()

function pickPositiveMetrics(values) {
  return values
    .map((value) => Math.round(Number(value) || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function getPhoneViewportMetrics() {
  if (typeof window === 'undefined') {
    return { screenShortSide: 0, viewportShortSide: 0 }
  }
  const viewport = window.visualViewport
  const screenMetrics = pickPositiveMetrics([window.screen?.width, window.screen?.height])
  const viewportMetrics = pickPositiveMetrics([
    viewport?.width,
    viewport?.height,
    window.innerWidth,
    window.innerHeight,
  ])

  return {
    screenShortSide: screenMetrics.length ? Math.min(...screenMetrics) : 0,
    viewportShortSide: viewportMetrics.length ? Math.min(...viewportMetrics) : 0,
  }
}

function isLikelyPhoneViewport() {
  if (typeof window === 'undefined') return false
  const isCoarsePointer =
    window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches ?? false
  if (!isCoarsePointer) return false
  const { screenShortSide, viewportShortSide } = getPhoneViewportMetrics()
  const layoutWidth = Math.round(
    document.documentElement?.clientWidth || window.innerWidth || 0,
  )
  const hasHandsetScreen =
    Boolean(screenShortSide) && screenShortSide <= PHONE_VIEWPORT_MAX_SHORT_SIDE
  const hasNarrowViewport =
    Boolean(viewportShortSide) && viewportShortSide <= PHONE_VIEWPORT_MAX_LAYOUT_WIDTH
  const hasWideLayoutOnHandset =
    hasHandsetScreen &&
    layoutWidth > Math.round(screenShortSide * PHONE_LAYOUT_WIDTH_MISMATCH_RATIO)

  return Boolean(hasHandsetScreen || hasNarrowViewport || hasWideLayoutOnHandset)
}

function isLocalDevHost() {
  if (typeof location === 'undefined') return false
  const host = location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function isQuarkDevOverrideEnabled() {
  if (typeof window === 'undefined' || !isLocalDevHost()) return false
  try {
    if (new URLSearchParams(location.search).has('lk-quark')) return true
    return window.localStorage?.getItem('lk-force-quark') === '1'
  } catch {
    return false
  }
}

function isQuarkBrowser() {
  if (typeof navigator === 'undefined') return false
  if (/\bQuark/i.test(navigator.userAgent || '')) return true
  return isQuarkDevOverrideEnabled()
}

function syncQuarkNavbarAvatar() {
  if (typeof document === 'undefined' || !isQuarkBrowser()) return

  const avatar = readAvatar()
  for (const img of document.querySelectorAll('img.vp-nav-logo')) {
    img.setAttribute('src', avatar)
  }

  const icon = document.querySelector('link[rel="icon"]')
  if (icon) {
    icon.setAttribute('href', avatar)
    const isSvg = avatar.endsWith('.svg')
    const isPng = avatar.endsWith('.png')
    icon.setAttribute('type', isSvg ? 'image/svg+xml' : isPng ? 'image/png' : 'image/jpeg')
  }
}

function isHuaweiDevOverrideEnabled() {
  if (typeof window === 'undefined' || !isLocalDevHost()) return false
  try {
    if (new URLSearchParams(location.search).has('lk-huawei')) return true
    return window.localStorage?.getItem('lk-force-huawei') === '1'
  } catch {
    return false
  }
}

function isHuaweiBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/\bHuaweiBrowser\/\d/i.test(ua)) return true
  if (/\bHBPC\/\d/i.test(ua)) return true
  return isHuaweiDevOverrideEnabled()
}

function syncHuaweiBrowserClass() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const isHuawei = isHuaweiBrowser()
  root.classList.toggle(HUAWEI_BROWSER_CLASS, isHuawei)
  if (isHuawei) root.setAttribute(HUAWEI_BROWSER_ATTR, '1')
  else root.removeAttribute(HUAWEI_BROWSER_ATTR)
}

function syncQuarkBrowserClass() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const wasQuark = root.classList.contains(QUARK_BROWSER_CLASS)
  const isQuark = isQuarkBrowser()
  root.classList.toggle(QUARK_BROWSER_CLASS, isQuark)
  if (isQuark) root.setAttribute(QUARK_BROWSER_ATTR, '1')
  else root.removeAttribute(QUARK_BROWSER_ATTR)
  if (isQuark) syncQuarkNavbarAvatar()

  if (
    wasQuark !== isQuark &&
    typeof window !== 'undefined' &&
    isPortfolioPostPath(window.location.pathname)
  ) {
    requestArticlePostLayoutResync(window.location.pathname, true)
  }
}

function getAboutProfileLayoutWidth() {
  if (typeof window === 'undefined') return 0
  return Math.round(document.documentElement?.clientWidth || window.innerWidth || 0)
}

function getAboutProfileBrowserZoomRatio() {
  if (typeof window === 'undefined') return 1

  const layoutWidth = getAboutProfileLayoutWidth()
  const screenWidth = Math.round(window.screen?.width || 0)
  const availWidth = Math.round(window.screen?.availWidth || screenWidth || 0)
  if (!screenWidth || !layoutWidth) return 1

  const isNearFullscreen =
    Boolean(availWidth) && layoutWidth >= Math.round(availWidth * ABOUT_PROFILE_FULLSCREEN_WIDTH_RATIO)
  if (!isNearFullscreen) return 1

  return layoutWidth / screenWidth
}

function shouldCenterAboutProfile() {
  if (typeof window === 'undefined') return false

  const zoomRatio = getAboutProfileBrowserZoomRatio()
  return zoomRatio > 0 && zoomRatio <= ABOUT_PROFILE_ZOOM_WIDTH_RATIO
}

function syncAboutProfileCenterClass() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const shouldCenter = shouldCenterAboutProfile()
  root.classList.toggle(ABOUT_PROFILE_CENTER_CLASS, shouldCenter)
  if (shouldCenter) root.setAttribute(ABOUT_PROFILE_CENTER_ATTR, '1')
  else root.removeAttribute(ABOUT_PROFILE_CENTER_ATTR)
}

function syncPhoneViewportClass() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const wasPhone = root.classList.contains(PHONE_VIEWPORT_CLASS)
  const isPhoneViewport = isLikelyPhoneViewport()
  root.classList.toggle(PHONE_VIEWPORT_CLASS, isPhoneViewport)
  if (isPhoneViewport) root.setAttribute(PHONE_VIEWPORT_ATTR, '1')
  else root.removeAttribute(PHONE_VIEWPORT_ATTR)

  syncAboutProfileCenterClass()

  if (
    wasPhone !== isPhoneViewport &&
    typeof window !== 'undefined' &&
    isPortfolioPostPath(window.location.pathname)
  ) {
    requestArticlePostLayoutResync(window.location.pathname, true)
  }

  schedulePhoneInlineNavbar(window.location.pathname)
}

function clearPhoneViewportTimers() {
  if (typeof window === 'undefined') return
  for (const timer of phoneViewportTimers) {
    window.clearTimeout(timer)
  }
  phoneViewportTimers.clear()
}

function schedulePhoneViewportSync() {
  if (typeof window === 'undefined') return
  clearPhoneViewportTimers()
  for (const delay of PHONE_VIEWPORT_STABILIZE_DELAYS) {
    const timer = window.setTimeout(() => {
      phoneViewportTimers.delete(timer)
      syncPhoneViewportClass()
      syncQuarkBrowserClass()
      syncHuaweiBrowserClass()
    }, delay)
    phoneViewportTimers.add(timer)
  }
}

let navFitObserver = null
let navFitResizeObserver = null
let navFitWatchersAttached = false

/**
 * 让位判定依赖文字实际宽度，所以这几件事之后都要重新量：
 * 切语言（"About Me" 和 "关于我" 不一样宽）、字体加载完、导航列表被改（设置齿轮是运行时插进去的）。
 */
function attachNavFitWatchers() {
  if (typeof window === 'undefined' || navFitWatchersAttached) return
  navFitWatchersAttached = true

  window.addEventListener(TRANSLATE_LANG_EVENT, () => {
    // 词典命中的话下一帧就已经换好文本了；没命中要等接口回来，所以再补两拍。
    scheduleNavFit()
    window.setTimeout(scheduleNavFit, 300)
    window.setTimeout(scheduleNavFit, 1200)
  })

  document.fonts?.ready?.then(scheduleNavFit).catch(() => {})

  const navbar = document.getElementById('navbar')

  /*
   * 中间能用多宽 = 导航栏总宽 - 两侧。所以两侧一变大小就得重新量。
   * 这条是必须的：翻译进行中那个地球按钮会换一种状态（宽度跟着变），
   * 而那只是属性变化，childList / characterData 都观察不到 ——
   * 之前就是因此在切回英文后挂着一个被裁掉半截的 "Articles" 直到下次 resize。
   */
  if (navbar && typeof ResizeObserver !== 'undefined') {
    navFitResizeObserver = new ResizeObserver(scheduleNavFit)
    for (const el of navbar.querySelectorAll('.vp-navbar-start, .vp-navbar-end')) {
      navFitResizeObserver.observe(el)
    }
    navFitResizeObserver.observe(navbar)
  }

  if (navbar && typeof MutationObserver !== 'undefined') {
    /*
     * characterData 是关键：翻译是原地改文本节点，导航标签从「关于我」变成「About Me」
     * 宽度会变，但不会有任何 childList 变动。只盯 childList 的话，切语言后要等下一次
     * resize / 路由切换才重新量，中间一直挂着一个被裁掉半截的 "Articles"。
     * 我们自己只改属性（data-lk-nav-hidden），不会把自己触发进死循环。
     */
    navFitObserver = new MutationObserver(scheduleNavFit)
    navFitObserver.observe(navbar, { childList: true, subtree: true, characterData: true })
  }
}

let phoneInlineNavMediaListenerAttached = false

function attachPhoneInlineNavMediaListener() {
  if (typeof window === 'undefined' || phoneInlineNavMediaListenerAttached) return
  const mql = window.matchMedia?.(PHONE_INLINE_NAV_MEDIA)
  if (!mql) return
  phoneInlineNavMediaListenerAttached = true
  const onChange = () => schedulePhoneInlineNavbar()
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange)
  else if (typeof mql.addListener === 'function') mql.addListener(onChange)
}

function attachPhoneViewportListeners() {
  if (typeof window === 'undefined' || phoneViewportListenersAttached) return
  phoneViewportListenersAttached = true
  phoneViewportHandler = () => {
    syncPhoneViewportClass()
    syncQuarkBrowserClass()
    syncHuaweiBrowserClass()
    syncAboutProfileCenterClass()
    schedulePhoneViewportSync()
    schedulePhoneInlineNavbar()
  }
  window.addEventListener('resize', phoneViewportHandler)
  window.addEventListener('orientationchange', phoneViewportHandler)
  window.addEventListener('pageshow', phoneViewportHandler)
  window.visualViewport?.addEventListener('resize', phoneViewportHandler)
  phoneViewportHandler()
  window.requestAnimationFrame(() => {
    syncPhoneViewportClass()
    syncQuarkBrowserClass()
    syncHuaweiBrowserClass()
    syncAboutProfileCenterClass()
  })

  if (isLocalDevHost()) {
    window.__lkAboutProfileLayoutDebug = () => {
      const layoutWidth = getAboutProfileLayoutWidth()
      const screenWidth = Math.round(window.screen?.width || 0)
      const availWidth = Math.round(window.screen?.availWidth || screenWidth || 0)
      const zoomRatio = getAboutProfileBrowserZoomRatio()
      const isNearFullscreen =
        Boolean(availWidth) &&
        layoutWidth >= Math.round(availWidth * ABOUT_PROFILE_FULLSCREEN_WIDTH_RATIO)
      return {
        layoutWidth,
        screenWidth,
        availWidth,
        zoomRatio: Number(zoomRatio.toFixed(3)),
        isNearFullscreen,
        shouldCenter: shouldCenterAboutProfile(),
        hasCenterClass: document.documentElement.classList.contains(ABOUT_PROFILE_CENTER_CLASS),
      }
    }
  }
}

function detachPhoneViewportListeners() {
  if (typeof window === 'undefined' || !phoneViewportHandler) return
  window.removeEventListener('resize', phoneViewportHandler)
  window.removeEventListener('orientationchange', phoneViewportHandler)
  window.removeEventListener('pageshow', phoneViewportHandler)
  window.visualViewport?.removeEventListener('resize', phoneViewportHandler)
  clearPhoneViewportTimers()
  phoneViewportHandler = null
  phoneViewportListenersAttached = false
}

function runWhenIdle(fn, timeout = 800) {
  if (typeof window === 'undefined') return
  const ric = window.requestIdleCallback
  if (typeof ric === 'function') {
    ric(() => fn(), { timeout })
    return
  }
  setTimeout(() => fn(), 0)
}

/* ── Live2D：挂 body + fixed 视口右下，避免随首页网格卸载而销毁 ───────────── */
let live2dLoaded = false
/** 仅表示已插入 unpkg 脚本（模型可能尚未 init，见 tryMountLive2dModel） */
let live2dScriptInjected = false
let live2dViewportListenersAttached = false
const LIVE2D_MODEL_H = 440

let live2dViewportHandler = null

function applyLive2dViewportScale() {
  if (typeof window === 'undefined') return
  const el = document.getElementById('live2d-widget')
  if (!el) return
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return

  const vv = window.visualViewport
  const h = vv ? vv.height : window.innerHeight
  const reservedBottom = 72
  const reservedTop = 72
  const avail = Math.max(160, h - reservedTop - reservedBottom)
  const scale = Math.min(1, Math.max(0.55, avail / LIVE2D_MODEL_H))

  el.style.transformOrigin = 'bottom right'
  el.style.transform = scale < 0.998 ? `scale(${scale})` : ''
}

function attachLive2dViewportListeners() {
  if (typeof window === 'undefined' || live2dViewportListenersAttached) return
  live2dViewportListenersAttached = true
  live2dViewportHandler = () => {
    applyLive2dViewportScale()
  }
  window.visualViewport?.addEventListener('resize', live2dViewportHandler)
  window.visualViewport?.addEventListener('scroll', live2dViewportHandler)
  window.addEventListener('resize', live2dViewportHandler)
}

function detachLive2dViewportListeners() {
  if (!live2dViewportHandler || typeof window === 'undefined') return
  window.visualViewport?.removeEventListener('resize', live2dViewportHandler)
  window.visualViewport?.removeEventListener('scroll', live2dViewportHandler)
  window.removeEventListener('resize', live2dViewportHandler)
  live2dViewportHandler = null
  live2dViewportListenersAttached = false
}

/** Viewport bottom-right; right offset clears back-to-top arrow (z-index above widget). */
function positionLive2DWidget() {
  if (typeof window === 'undefined') return
  const container = document.getElementById('live2d-widget')
  if (!container) return

  document.body.appendChild(container)

  const isMobile = window.matchMedia('(max-width: 959px)').matches
  Object.assign(container.style, {
    position: 'fixed',
    right: isMobile
      ? 'max(0.25rem, env(safe-area-inset-right, 0px))'
      : 'calc(1rem + 52px + max(0.25rem, env(safe-area-inset-right, 0px)))',
    bottom: isMobile
      ? 'max(0.5rem, env(safe-area-inset-bottom, 0px))'
      : 'max(0.25rem, env(safe-area-inset-bottom, 0px))',
    left: '',
    top: '',
    zIndex: '55',
  })
  applyLive2dViewportScale()
}

/** Run after layout + L2D internal DOM so fixed bottom/right are not overwritten. */
function scheduleLive2dReposition() {
  if (typeof window === 'undefined' || !live2dLoaded) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      positionLive2DWidget()
    })
  })
}

/** 用户关闭看板娘时不 init；开启后由 `syncLive2dPref` 再触发。 */
function tryMountLive2dModel() {
  if (typeof window === 'undefined' || live2dLoaded) return
  if (!window.L2Dwidget) return
  if (isLive2dHiddenPath(window.location.pathname)) return
  if (!readLive2dPref()) return

  window.L2Dwidget.init({
    model: {
      jsonPath:
        'https://unpkg.com/live2d-widget-model-koharu@1.0.5/assets/koharu.model.json',
    },
    display: {
      position: 'right',
      width: 220,
      height: 440,
    },
    mobile: {
      show: true,
    },
    react: {
      opacityDefault: 1,
      opacityOnHover: 1,
    },
  })
  live2dLoaded = true
  attachLive2dViewportListeners()
  applyLive2dUserClass()
  scheduleLive2dReposition()
  try {
    window.dispatchEvent(new Event('resize'))
  } catch {
    /* ignore */
  }
}

/** 仅在用户开启看板娘时加载 unpkg 脚本；init 仍由 tryMountLive2dModel 在非隐藏页执行。 */
function initLive2DScript() {
  if (typeof window === 'undefined' || live2dScriptInjected) return
  if (!readLive2dPref()) return

  live2dScriptInjected = true

  const onLibReady = () => {
    tryMountLive2dModel()
  }

  if (window.L2Dwidget) {
    onLibReady()
    return
  }

  const script = document.createElement('script')
  script.src = 'https://unpkg.com/live2d-widget@3.1.4/lib/L2Dwidget.min.js'
  script.async = true
  script.onload = onLibReady
  document.body.appendChild(script)
}

/** 路由切换后：补一次 init + 定位（从隐藏页进首页时） */
function nudgeLive2dForCurrentRoute() {
  if (typeof window === 'undefined') return
  applyLive2dRouteClass(window.location.pathname)
  if (isLive2dHiddenPath(window.location.pathname)) return
  tryMountLive2dModel()
  rescueLive2dFromHomeGrid()
  if (live2dLoaded) {
    scheduleLive2dReposition()
    requestAnimationFrame(() => {
      applyLive2dViewportScale()
    })
  }
}

/* ── 全局背景模糊蒙版（#lk-blur-layer）── ──────────────────────────────
 * 替代 CSS ::before 方案，直接由 JS 管理 div 的 class，
 * 避免 lk-site-non-home !important 导致的 backdrop-filter 清零问题。
 *
 * 三种状态（对应 CSS 类）：
 *   lk-blur--clear  : About 页顶部，不模糊
 *   lk-blur--soft   : About 页滚动后，轻度模糊
 *   lk-blur--static : 其他页面，固定轻度模糊，切页时无 transition
 */
let blurLayer = null
let blurLayerListenersAttached = false
let blurLayerPageShowHandler = null
let blurLayerScrollHandler = null
let blurLayerSyncFrame = 0
let blurLayerPendingPath = null
let blurLayerViewportHandler = null
let blurLayerVisibilityHandler = null
let blurLayerVisualChangeHandler = null
let blurLayerThemeObserver = null
function resolveRouteLikePath(path) {
  const fallback = typeof window !== 'undefined' ? window.location.pathname : '/'
  const raw = String(path || fallback)
  const [withoutHash] = raw.split('#')
  const [pathname] = withoutHash.split('?')
  return normPath(pathname)
}

function readDocumentTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

function resolveBlurLayerImageSrc() {
  return readHomeBackground() || DEFAULT_HERO
}

function syncBlurLayerVisual(layer = ensureBlurLayer()) {
  if (!(layer instanceof HTMLElement)) return
  const imageSrc = resolveBlurLayerImageSrc()
  layer.style.setProperty('--lk-blur-layer-image', `url(${JSON.stringify(imageSrc)})`)
}
const LK_SCROLL_BLUR_THRESHOLD = 100  // 滚过 Hero 的安全高度

/** Theme Hope / VuePress 常把滚动放在 .theme-container 内，window.scrollY 恒为 0，导致 About 模糊层永远不切换。 */
function getEffectiveScrollY() {
  if (typeof window === 'undefined') return 0
  const root = document.scrollingElement || document.documentElement
  const fromDocument =
    window.scrollY ||
    window.pageYOffset ||
    root?.scrollTop ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  let inner = 0
  for (const sel of ['.theme-container', '#app', 'main.vp-page', '.vp-page-content', '[vp-content]']) {
    const el = document.querySelector(sel)
    if (el && el.scrollTop > inner) inner = el.scrollTop
  }
  return Math.max(fromDocument, inner)
}

function getScrollRangeForProgress() {
  const winH = window.innerHeight
  const docMax = Math.max(0, document.documentElement.scrollHeight - winH)
  const tc = document.querySelector('.theme-container')
  const innerMax = tc ? Math.max(0, tc.scrollHeight - tc.clientHeight) : 0
  return Math.max(docMax, innerMax, 1)
}

function ensureBlurLayer() {
  if (typeof document === 'undefined') return null
  const body = document.body
  if (!body) return null

  const existing = document.getElementById('lk-blur-layer')
  if (existing instanceof HTMLElement) {
    blurLayer = existing
  }

  if (!(blurLayer instanceof HTMLElement) || !blurLayer.isConnected) {
    blurLayer = document.createElement('div')
    blurLayer.id = 'lk-blur-layer'
  }

  if (blurLayer.parentNode !== body || body.firstChild !== blurLayer) {
    body.insertBefore(blurLayer, body.firstChild)
  }

  return blurLayer
}

function isAboutRoute(path) {
  // dev 模式 path 形如 /about.html、prod 形如 /about 或 /about/。
  // 先剥 .html 后缀，再去 trailing slash，最后做精确 / 前缀匹配。
  const raw = path || (typeof window !== 'undefined' ? window.location.pathname : '/')
  const p = resolveRouteLikePath(path)
  return p === '/' || p === '/about' || p.startsWith('/about/')
}

function updateBlurLayer(path) {
  const layer = ensureBlurLayer()
  if (!layer) return
  syncBlurLayerVisual(layer)
  const scrollY = getEffectiveScrollY()
  const aboutHit = isAboutRoute(path)
  layer.classList.remove('lk-blur--clear', 'lk-blur--soft', 'lk-blur--static')
  let appliedClass
  if (aboutHit) {
    appliedClass = scrollY > LK_SCROLL_BLUR_THRESHOLD ? 'lk-blur--soft' : 'lk-blur--clear'
  } else {
    appliedClass = 'lk-blur--static'
  }
  layer.classList.add(appliedClass)
}

function syncBlurLayer(path) {
  if (typeof window === 'undefined') return
  updateBlurLayer(resolveRouteLikePath(path))
}

function requestBlurLayerSync(path) {
  if (typeof window === 'undefined') return
  blurLayerPendingPath = path ?? window.location.pathname

  if (blurLayerSyncFrame) return

  blurLayerSyncFrame = window.requestAnimationFrame(() => {
    blurLayerSyncFrame = 0
    const nextPath = blurLayerPendingPath
    blurLayerPendingPath = null
    syncBlurLayer(nextPath)
  })
}

function attachBlurLayerListeners() {
  if (typeof window === 'undefined' || blurLayerListenersAttached) return

  blurLayerListenersAttached = true
  blurLayerViewportHandler = () => {
    requestBlurLayerSync(window.location.pathname)
  }
  blurLayerPageShowHandler = () => {
    requestBlurLayerSync(window.location.pathname)
  }
  blurLayerVisibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      requestBlurLayerSync(window.location.pathname)
    }
  }
  blurLayerVisualChangeHandler = () => {
    requestBlurLayerSync(window.location.pathname)
  }
  blurLayerScrollHandler = () => {
    requestBlurLayerSync(window.location.pathname)
  }

  window.addEventListener('resize', blurLayerViewportHandler)
  window.visualViewport?.addEventListener('resize', blurLayerViewportHandler)
  window.addEventListener('pageshow', blurLayerPageShowHandler)
  window.addEventListener('scroll', blurLayerScrollHandler, { passive: true })
  window.addEventListener(HOME_VISUAL_PREF_EVENT, blurLayerVisualChangeHandler)
  document.addEventListener('scroll', blurLayerScrollHandler, { passive: true, capture: true })
  document.addEventListener('visibilitychange', blurLayerVisibilityHandler)
  if (typeof MutationObserver !== 'undefined') {
    blurLayerThemeObserver = new MutationObserver(() => {
      requestBlurLayerSync(window.location.pathname)
    })
    blurLayerThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }
}

function detachBlurLayerListeners() {
  if (typeof window === 'undefined' || !blurLayerListenersAttached) return

  if (blurLayerViewportHandler) {
    window.removeEventListener('resize', blurLayerViewportHandler)
    window.visualViewport?.removeEventListener('resize', blurLayerViewportHandler)
  }
  if (blurLayerPageShowHandler) {
    window.removeEventListener('pageshow', blurLayerPageShowHandler)
  }
  if (blurLayerScrollHandler) {
    window.removeEventListener('scroll', blurLayerScrollHandler)
    document.removeEventListener('scroll', blurLayerScrollHandler, true)
  }
  if (blurLayerVisualChangeHandler) {
    window.removeEventListener(HOME_VISUAL_PREF_EVENT, blurLayerVisualChangeHandler)
  }
  if (blurLayerVisibilityHandler) {
    document.removeEventListener('visibilitychange', blurLayerVisibilityHandler)
  }
  if (blurLayerSyncFrame) {
    window.cancelAnimationFrame(blurLayerSyncFrame)
    blurLayerSyncFrame = 0
  }
  blurLayerThemeObserver?.disconnect()
  blurLayerThemeObserver = null

  blurLayerListenersAttached = false
  blurLayerPageShowHandler = null
  blurLayerScrollHandler = null
  blurLayerPendingPath = null
  blurLayerViewportHandler = null
  blurLayerVisibilityHandler = null
  blurLayerVisualChangeHandler = null
}

/* ── Scroll progress bar (global) ─────────────────────────────────────── */
let progressBar = null

function initProgressBar() {
  if (document.getElementById('lk-progress')) return
  const bar = document.createElement('div')
  bar.id = 'lk-progress'
  document.body.appendChild(bar)
  progressBar = bar

  let ticking = false
  const onScroll = () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(() => {
        const y = getEffectiveScrollY()
        const max = getScrollRangeForProgress()
        bar.style.width = max > 0 ? `${(y / max) * 100}%` : '0%'
        ticking = false
      })
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  /* 内部滚动容器不冒泡到 window；捕获阶段仍能收到 scroll */
  document.addEventListener('scroll', onScroll, { passive: true, capture: true })
}

function rescueLive2dFromHomeGrid() {
  const row = document.querySelector('main.vp-project-home .lk-home-body-grid')
  const container = document.getElementById('live2d-widget')
  if (row && container && row.contains(container)) {
    document.body.appendChild(container)
  }
}

/** 首页 Hero 进栏前暂隐主区，减少 DOM 重排显式跳动（与 index.scss `lk-home-enhance-suspended` 配套） */
function setHomeEnhanceSuspended(flag) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('lk-home-enhance-suspended', !!flag)
}

let homeTypewriterApp = null

function mountHomeTypewriter() {
  if (typeof document === 'undefined' || homeTypewriterApp) return
  const el = document.getElementById('main-description')
  if (!el || el.dataset.lkTw) return
  el.dataset.lkTw = '1'
  const tagline = el.textContent?.trim() || 'Welcome to my blog'
  el.innerHTML = ''
  const text = tagline || 'Welcome to my blog'
  homeTypewriterApp = createApp({ render: () => h(HomeTypewriterTagline, { text }) })
  homeTypewriterApp.mount(el)
}

function unmountHomeTypewriter() {
  if (homeTypewriterApp) {
    homeTypewriterApp.unmount()
    homeTypewriterApp = null
  }
  const el = document.getElementById('main-description')
  if (el) delete el.dataset.lkTw
}

/**
 * 将 Hope 首屏 Hero（及主题生成的 features）移入 Markdown 中的 `.lk-home-main-col`，
 * 与左侧小卡片同排；逻辑源自旧版 `mountHomeBodyGrid`（见 git 1b02bbe）。
 * @returns {boolean} 是否已放好（或已处于放好状态）
 */
function placeHomeHeroInGrid() {
  if (typeof document === 'undefined') return false
  const main = document.querySelector('main.vp-page.vp-project-home') || document.querySelector('main.vp-project-home')
  if (!main) return false
  if (main.dataset.lkHomeHeroPlaced === '1') return true

  const grid = main.querySelector('.lk-home-body-grid')
  const mainCol = grid?.querySelector?.('.lk-home-main-col') ?? null
  if (!grid || !mainCol) return false

  const hero =
    main.querySelector(':scope > .vp-hero-info-wrapper') || main.querySelector(':scope > header.vp-hero-info-wrapper')
  if (!hero) return false

  setHomeEnhanceSuspended(true)
  try {
    main.classList.add('lk-home-dual')
    mainCol.appendChild(hero)

    // Hope `home: true` 渲染：hero 与 feature-wrapper 都是 main 的直接子节点
    for (const el of main.querySelectorAll(':scope > .vp-feature-wrapper, :scope > .vp-features')) {
      if (grid.contains(el)) continue
      mainCol.appendChild(el)
    }

    main.dataset.lkHomeHeroPlaced = '1'
  } finally {
    setHomeEnhanceSuspended(false)
  }
  rescueLive2dFromHomeGrid()
  return true
}

function unplaceHomeHeroFromGrid() {
  if (typeof document === 'undefined') return
  const main = document.querySelector('main.vp-page.vp-project-home') || document.querySelector('main.vp-project-home')
  if (!main || main.dataset.lkHomeHeroPlaced !== '1') return
  const grid = main.querySelector('.lk-home-body-grid')
  const mainCol = grid?.querySelector?.('.lk-home-main-col') ?? null
  const hero = mainCol?.querySelector?.('.vp-hero-info-wrapper')
  if (hero) {
    main.prepend(hero)
  }
  // 把 features 也送回 main（hero 之后），保持原 Hope DOM 结构
  if (mainCol) {
    for (const el of mainCol.querySelectorAll(':scope > .vp-feature-wrapper, :scope > .vp-features')) {
      hero ? hero.insertAdjacentElement('afterend', el) : main.prepend(el)
    }
  }
  main.classList.remove('lk-home-dual')
  delete main.dataset.lkHomeHeroPlaced
}

/**
 * 主题异步出水合后再移动 Hero；从非首页切回 `/` 时同样重试。
 */
function scheduleHomePageLayout(p, attempt = 0) {
  if (typeof document === 'undefined') return
  const path = p != null ? normPath(p) : normPath(window.location?.pathname)
  if (path !== '/' && path !== '/index') {
    unplaceHomeHeroFromGrid()
    unmountHomeTypewriter()
    return
  }
  if (placeHomeHeroInGrid()) {
    mountHomeTypewriter()
    return
  }
  if (attempt < 40) {
    setTimeout(
      () => {
        if (placeHomeHeroInGrid()) {
          mountHomeTypewriter()
        } else {
          scheduleHomePageLayout(path, attempt + 1)
        }
      },
      32,
    )
  }
}

/* ── Entry ──────────────────────────────────────────────────────────────── */
const ARTICLE_LEFT_TOC_MEDIA_QUERY = '(min-width: 960px)'
const ARTICLE_MOBILE_TOC_MEDIA_QUERY = '(max-width: 959px)'
/** 侧栏底部内边距量不到时的兜底（对应 .vp-sidebar 的 padding-bottom: 0.35rem） */
const ARTICLE_SIDEBAR_STOP_ALIGNMENT_OFFSET = 6
/** 兜底：不管上一页/下一页量到什么，左栏底边都不许贴到页脚上 */
const ARTICLE_SIDEBAR_FOOTER_MIN_GAP = 16
const ARTICLE_SIDEBAR_FOOTER_SELECTOR = 'footer.lk-footer'
/** 连续 8 轮（≈256ms）都对不上，就认为侧栏挂的是上一篇的目录，可以清掉 */
const ARTICLE_TOC_STALE_EVICT_ATTEMPT = 8
const ARTICLE_TOC_VERIFY_ROUNDS = 6

let mobileTocToolbarSidebarHome = null

function getPortfolioNavLabel(path) {
  return isProjectPostPath(path) ? '项目导航' : '文章导航'
}

function getMobileTocToolbarSidebarHome() {
  if (typeof document === 'undefined') return null
  if (mobileTocToolbarSidebarHome?.isConnected) return mobileTocToolbarSidebarHome

  const navbarStart =
    document.querySelector('.vp-navbar .vp-navbar-start') || document.querySelector('.vp-navbar')
  if (!navbarStart) return null

  mobileTocToolbarSidebarHome = document.createElement('span')
  mobileTocToolbarSidebarHome.className = 'lk-mobile-toc-toolbar__sidebar-home'
  mobileTocToolbarSidebarHome.hidden = true
  mobileTocToolbarSidebarHome.setAttribute('aria-hidden', 'true')
  navbarStart.insertBefore(mobileTocToolbarSidebarHome, navbarStart.firstChild)
  return mobileTocToolbarSidebarHome
}

function queryInlineMobileTocHeader(themeContainer) {
  return themeContainer?.querySelector(
    '.vp-toc-placeholder:not([data-lk-toc-docked="left"]) .vp-toc-header',
  )
}

function stopMobileTocToolbarBubble(event) {
  event.stopPropagation()
}

function resolveMobileTocHeaderTitle(header) {
  // 第一个选择器是我们自己上一轮建出来的标签：restore 会把它放回 header，
  // 但它既不是 .vp-toc-title 也不是文本节点，认不出来就会又新建一个，工具条里多一个游离子元素。
  for (const selector of ['.lk-mobile-toc-toolbar__toc-label', '.vp-toc-title', '.title']) {
    const match = header.querySelector(selector)
    if (match instanceof HTMLElement) return match
  }

  for (const node of [...header.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue
    const text = node.textContent?.trim()
    if (!text) continue
    const label = document.createElement('span')
    label.className = 'lk-mobile-toc-toolbar__toc-label'
    label.textContent = text
    node.textContent = ''
    return label
  }

  const label = document.createElement('span')
  label.className = 'lk-mobile-toc-toolbar__toc-label'
  label.textContent = '此页内容'
  return label
}

function openMobileArticleSidebar(sidebarBtn) {
  if (sidebarBtn instanceof HTMLElement) {
    sidebarBtn.click()
    return
  }
  document.querySelector('.theme-container')?.classList.add('sidebar-open')
}

function restoreMobileArticleTocToolbar() {
  if (typeof document === 'undefined') return

  const movedBtn = document.querySelector(
    '.vp-toggle-sidebar-button[data-lk-toc-toolbar-managed="1"]',
  )
  if (movedBtn instanceof HTMLElement) {
    const navbarStart = document.querySelector('.vp-navbar .vp-navbar-start')
    movedBtn.classList.remove(
      'lk-mobile-toc-toolbar__sidebar-btn',
      'lk-mobile-toc-toolbar__sidebar-btn--hidden',
    )
    delete movedBtn.dataset.lkTocToolbarManaged
    delete movedBtn.dataset.lkTocToolbarMoved
    movedBtn.removeEventListener('click', stopMobileTocToolbarBubble)
    if (navbarStart) {
      navbarStart.insertBefore(movedBtn, navbarStart.children[1] || null)
    }
  }

  for (const header of document.querySelectorAll('.vp-toc-header[data-lk-mobile-toc-toolbar="1"]')) {
    const navHit = header.querySelector('.lk-mobile-toc-toolbar__nav-hit')
    const tocHit = header.querySelector('.lk-mobile-toc-toolbar__toc-hit')
    const printBtn = header.querySelector('.print-button')
    const arrow = header.querySelector('.arrow')
    const tocLabel = header.querySelector('.lk-mobile-toc-toolbar__toc-label, .vp-toc-title')

    navHit?.remove()
    tocHit?.remove()

    if (tocLabel instanceof HTMLElement) {
      header.insertBefore(tocLabel, printBtn || arrow || null)
    }
    if (arrow instanceof HTMLElement) {
      if (printBtn instanceof HTMLElement) {
        header.insertBefore(arrow, printBtn)
      } else {
        header.appendChild(arrow)
      }
    }

    header.classList.remove('lk-mobile-toc-toolbar')
    delete header.dataset.lkMobileTocToolbar

    if (printBtn instanceof HTMLElement) {
      printBtn.removeEventListener('click', stopMobileTocToolbarBubble)
    }
  }
}

function syncMobileArticleTocToolbar(path) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true

  const resolvedPath = resolveRouteLikePath(path)
  const isMobile = window.matchMedia(ARTICLE_MOBILE_TOC_MEDIA_QUERY).matches

  if (!isMobile || !isPortfolioPostPath(resolvedPath)) {
    restoreMobileArticleTocToolbar()
    return true
  }

  const themeContainer = queryPortfolioPostThemeContainer()
  const tocHeader = queryInlineMobileTocHeader(themeContainer)
  const sidebarBtn =
    document.querySelector('.lk-mobile-toc-toolbar__sidebar-home .vp-toggle-sidebar-button') ||
    document.querySelector('.vp-navbar .vp-toggle-sidebar-button')

  if (!tocHeader || !(sidebarBtn instanceof HTMLElement)) return false

  if (tocHeader.dataset.lkMobileTocToolbar === '1') {
    const navLabel = tocHeader.querySelector('.lk-mobile-toc-toolbar__nav-label')
    if (navLabel) navLabel.textContent = getPortfolioNavLabel(resolvedPath)
    return true
  }

  const printBtn = tocHeader.querySelector('.print-button')
  const arrow = tocHeader.querySelector('.arrow')
  const tocLabel = resolveMobileTocHeaderTitle(tocHeader)
  tocLabel.classList.add('lk-mobile-toc-toolbar__toc-label')

  const home = getMobileTocToolbarSidebarHome()
  if (home && sidebarBtn.parentNode !== home) {
    sidebarBtn.classList.add('lk-mobile-toc-toolbar__sidebar-btn--hidden')
    sidebarBtn.dataset.lkTocToolbarManaged = '1'
    sidebarBtn.dataset.lkTocToolbarMoved = '1'
    home.appendChild(sidebarBtn)
  }

  const navHit = document.createElement('button')
  navHit.type = 'button'
  navHit.className = 'lk-mobile-toc-toolbar__nav-hit'
  const navIcon = document.createElement('span')
  navIcon.className = 'lk-mobile-toc-toolbar__nav-icon'
  navIcon.setAttribute('aria-hidden', 'true')
  const navLabel = document.createElement('span')
  navLabel.className = 'lk-mobile-toc-toolbar__nav-label'
  navLabel.textContent = getPortfolioNavLabel(resolvedPath)
  navHit.append(navIcon, navLabel)
  navHit.addEventListener('click', (event) => {
    event.stopPropagation()
    openMobileArticleSidebar(sidebarBtn)
  })

  const tocHit = document.createElement('button')
  tocHit.type = 'button'
  tocHit.className = 'lk-mobile-toc-toolbar__toc-hit'
  if (arrow instanceof HTMLElement) tocHit.appendChild(arrow)
  tocHit.appendChild(tocLabel)

  tocHeader.classList.add('lk-mobile-toc-toolbar')
  tocHeader.dataset.lkMobileTocToolbar = '1'
  tocHeader.insertBefore(navHit, tocHeader.firstChild)
  if (printBtn instanceof HTMLElement) {
    tocHeader.insertBefore(tocHit, printBtn)
    printBtn.addEventListener('click', stopMobileTocToolbarBubble)
    tocHeader.appendChild(printBtn)
  } else {
    tocHeader.appendChild(tocHit)
  }

  return true
}

function scheduleMobileArticleTocToolbar(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncMobileArticleTocToolbar(resolvedPath)) return

  if (attempt < 40) {
    window.setTimeout(() => {
      scheduleMobileArticleTocToolbar(resolvedPath, attempt + 1)
    }, 32)
  }
}

function isDesktopArticleClusterPath(path) {
  if (typeof window === 'undefined') return false
  const resolvedPath = resolveRouteLikePath(path ?? window.location.pathname)
  if (!isPortfolioPostPath(resolvedPath)) return false
  return window.matchMedia(ARTICLE_LEFT_TOC_MEDIA_QUERY).matches
}

/** 桌面左栏挂载 TOC：需宽屏、侧栏未被 CSS 隐藏（夸克走主列「此页内容」条）。 */
function isArticleTocSidebarDockable(sidebar) {
  if (typeof window === 'undefined' || !(sidebar instanceof HTMLElement)) return false
  if (!window.matchMedia(ARTICLE_LEFT_TOC_MEDIA_QUERY).matches) return false
  if (
    document.documentElement.classList.contains(QUARK_BROWSER_CLASS) ||
    isQuarkBrowser()
  ) {
    return false
  }

  const style = window.getComputedStyle(sidebar)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  const rect = sidebar.getBoundingClientRect()
  return rect.width >= 8 && rect.height >= 8
}

let articleLeftTocMediaQueryList = null
let articleLeftTocBreakpointHandler = null
let articlePostLayoutResyncTimer = 0
let articlePostLayoutResyncNeedsReset = false
let articleTocDockViewportHandler = null
let articleTocDockLinkHandler = null
let articleTocDockListenersAttached = false
let articleSidebarStopScrollHandler = null
let articleSidebarStopSyncFrame = 0
let articleSidebarStopResizeObserver = null
let articleSidebarStopObserved = null
let articleSidebarStopObservedFooter = null

function scheduleArticleChrome(path) {
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)
  syncArticleRouteClasses(resolvedPath)
  scheduleArticleTocDock(resolvedPath)
  scheduleArticleSidebarIndices(resolvedPath)
  schedulePortfolioSidebarLayout(resolvedPath)
  syncPortfolioSidebarActiveState(resolvedPath)
  syncProjectSetupVisibility()
  scheduleArticleSidebarStop(resolvedPath)
  observeArticleSidebarStopTargets()
  scheduleMobileArticleTocToolbar(resolvedPath)
}

function getArticleLeftTocMediaQueryList() {
  if (typeof window === 'undefined') return null
  if (!articleLeftTocMediaQueryList) {
    articleLeftTocMediaQueryList = window.matchMedia(ARTICLE_LEFT_TOC_MEDIA_QUERY)
  }
  return articleLeftTocMediaQueryList
}

/** DevTools / 断点切换：先清 dock 状态，等 CSS 侧栏可见后再 sync（避免半桌面半手机混合态）。 */
function requestArticlePostLayoutResync(path, resetLayout = false) {
  if (typeof window === 'undefined') return

  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)
  articlePostLayoutResyncNeedsReset = articlePostLayoutResyncNeedsReset || resetLayout

  if (articlePostLayoutResyncTimer) {
    window.clearTimeout(articlePostLayoutResyncTimer)
  }

  articlePostLayoutResyncTimer = window.setTimeout(() => {
    articlePostLayoutResyncTimer = 0
    const needsReset = articlePostLayoutResyncNeedsReset
    articlePostLayoutResyncNeedsReset = false

    if (needsReset && isPortfolioPostPath(resolvedPath)) {
      resetArticlePostLayoutForRoute(resolvedPath)
      restoreStrayArticleTocs()
    }

    const runSync = () => {
      scheduleArticleRouteClasses(resolvedPath)
      scheduleArticleChrome(resolvedPath)
      requestArticleSidebarStopSync(resolvedPath)
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(runSync)
    })
  }, 16)
}

/** 外部项目「搭建速查」：仅 session 登录后展示，并同步隐藏 TOC 对应项 */
function syncProjectSetupVisibility() {
  if (typeof document === 'undefined') return true

  const authed = readAuthed()

  for (const block of document.querySelectorAll('.lk-project-setup-private[data-lk-auth-only]')) {
    block.classList.toggle('lk-auth-visible', authed)
    if (authed) {
      block.removeAttribute('hidden')
      block.removeAttribute('aria-hidden')
    } else {
      block.setAttribute('hidden', '')
      block.setAttribute('aria-hidden', 'true')
    }
  }

  const hiddenIds = new Set()
  for (const heading of document.querySelectorAll(
    '.lk-project-setup-private[data-lk-auth-only] h2, .lk-project-setup-private[data-lk-auth-only] h3',
  )) {
    if (!heading.id) continue
    if (!authed) hiddenIds.add(heading.id)
  }

  for (const link of document.querySelectorAll(
    '.lk-article-toc-dock a[href^="#"], .vp-toc a[href^="#"]',
  )) {
    const hash = (link.getAttribute('href') || '').replace(/^#/, '')
    if (!hiddenIds.has(hash)) continue
    const item = link.closest('li') || link
    if (authed) {
      item.removeAttribute('hidden')
      item.style.removeProperty('display')
    } else {
      item.setAttribute('hidden', '')
      item.style.display = 'none'
    }
  }

  return true
}

function scheduleProjectSetupVisibility(attempt = 0) {
  if (typeof window === 'undefined') return
  if (syncProjectSetupVisibility()) return
  if (attempt < 40) {
    window.setTimeout(() => scheduleProjectSetupVisibility(attempt + 1), 32)
  }
}

/** 保证左栏顺序：.vp-sidebar-links（项目/文章列表卡）→ .lk-article-toc-dock（此页内容卡） */
function syncPortfolioSidebarLayout(path) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  if (!isPortfolioPostPath(p)) return true
  if (!themeContainer) return false

  const sidebar = themeContainer.querySelector('.vp-sidebar')
  const sidebarLinks = sidebar?.querySelector('.vp-sidebar-links')
  if (!sidebar || !sidebarLinks) return false

  const dockHost = sidebar.querySelector('.lk-article-toc-dock')
  if (dockHost && dockHost.previousElementSibling !== sidebarLinks) {
    sidebarLinks.insertAdjacentElement('afterend', dockHost)
  }

  const listRoot = isProjectPostPath(p) ? '/tech' : '/article'
  for (const link of sidebarLinks.querySelectorAll('a[href]')) {
    const targetPath = normalizeAnchorPath(link.getAttribute('href') || link.href)
    link.classList.toggle('lk-sidebar-list-hub', targetPath === listRoot)
  }

  if (isProjectPostPath(p)) {
    reorderTechSidebarLinks(sidebarLinks)
  }

  return true
}

/** Hope 侧栏 DOM 顺序与 catalog 中 tech 列表一致（新项如 MultiFeed 排在最前） */
function reorderTechSidebarLinks(sidebarLinks) {
  const orderPaths = techDetailProjectItems().map((item) => normPath(item.to))
  const listRoot = '/tech'
  const rowNodes = []

  for (const child of [...sidebarLinks.children]) {
    const anchor = child.querySelector?.('a[href]')
    if (!anchor) {
      rowNodes.push({ node: child, path: '' })
      continue
    }
    const path = normalizeAnchorPath(anchor.getAttribute('href') || anchor.href)
    rowNodes.push({ node: child, path })
  }

  const hubRows = rowNodes.filter((row) => row.path === listRoot)
  const projectRows = rowNodes.filter((row) => row.path && row.path !== listRoot)
  projectRows.sort((a, b) => {
    const ia = orderPaths.indexOf(a.path)
    const ib = orderPaths.indexOf(b.path)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  for (const row of [...hubRows, ...projectRows]) {
    sidebarLinks.appendChild(row.node)
  }
}

function schedulePortfolioSidebarLayout(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncPortfolioSidebarLayout(resolvedPath)) return

  if (attempt < 40) {
    window.setTimeout(() => {
      schedulePortfolioSidebarLayout(resolvedPath, attempt + 1)
    }, 32)
  }
}

function requestArticleChromeSync(path) {
  if (typeof window === 'undefined') return
  const resolvedPath = path ?? window.location.pathname

  void nextTick(() => {
    window.requestAnimationFrame(() => {
      scheduleArticleRouteClasses(resolvedPath)
      scheduleArticleChrome(resolvedPath)
    })
  })
}

function isArticlePostPath(path) {
  const p = resolveRouteLikePath(path)
  return p.startsWith('/article/') && p !== '/article'
}

function clearArticleSidebarIndices(root) {
  if (typeof document === 'undefined') return
  const scope = root?.querySelectorAll ? root : document

  for (const link of scope.querySelectorAll('.vp-sidebar-links a[data-lk-article-sidebar-index]')) {
    delete link.dataset.lkArticleSidebarIndex
  }
}

function clearArticleSidebarStop(root) {
  if (typeof document === 'undefined') return
  const scope = root?.querySelectorAll ? root : document

  for (const themeContainer of scope.querySelectorAll(
    '.theme-container.page-article-post',
  )) {
    themeContainer.style.removeProperty('--lk-article-sidebar-stop-gap')
  }
}

function syncArticleSidebarIndices(path) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  if (!isPortfolioPostPath(p)) {
    clearArticleSidebarIndices(document)
    return true
  }

  if (!themeContainer) return false

  const sidebarLinks = themeContainer.querySelector('.vp-sidebar-links')
  if (!sidebarLinks) return false

  clearArticleSidebarIndices(themeContainer)

  const listPrefix = isProjectPostPath(p) ? '/tech/' : '/article/'
  const listRoot = isProjectPostPath(p) ? '/tech' : '/article'

  let index = 0

  for (const link of sidebarLinks.querySelectorAll('a[href]')) {
    const targetPath = normalizeAnchorPath(link.getAttribute('href') || link.href)
    if (!targetPath || !targetPath.startsWith(listPrefix) || targetPath === listRoot) continue

    index += 1
    link.dataset.lkArticleSidebarIndex = String(index)
  }

  return true
}

/** 同一详情 URL 在侧栏可能出现多条（如两个项目卡片共用一个 tech 页）；只保留第一条为 active。 */
function syncPortfolioSidebarActiveState(path) {
  if (typeof document === 'undefined') return true

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  if (!isPortfolioPostPath(p) || !themeContainer) return true

  const sidebarLinks = themeContainer.querySelector('.vp-sidebar-links')
  if (!sidebarLinks) return false

  const currentPath = normPath(p)
  const seenActiveTargets = new Set()

  for (const link of sidebarLinks.querySelectorAll('a[href]')) {
    const targetPath = normalizeAnchorPath(link.getAttribute('href') || link.href)
    const isCurrent =
      Boolean(targetPath) &&
      targetPath === currentPath &&
      !seenActiveTargets.has(targetPath)

    if (isCurrent) seenActiveTargets.add(targetPath)

    link.classList.toggle('router-link-active', isCurrent)
    link.classList.toggle('route-link-active', isCurrent)
    link.classList.toggle('active', isCurrent)
    link.closest('.vp-sidebar-item')?.classList.toggle('vp-active', isCurrent)
  }

  return true
}

function restoreArticleTocToMarker(tocPlaceholder, themeContainer) {
  if (!tocPlaceholder) {
    themeContainer?.classList.remove('lk-article-toc-left')
    return true
  }

  const ownerThemeContainer =
    tocPlaceholder.closest(
      '.theme-container.page-article-post',
    ) || themeContainer || null
  const markerId = tocPlaceholder.dataset.lkTocMarkerId
  const marker = markerId ? document.getElementById(markerId) : null

  if (marker?.parentNode && tocPlaceholder.previousElementSibling !== marker) {
    marker.after(tocPlaceholder)
  } else if (!marker?.parentNode) {
    const page =
      ownerThemeContainer?.querySelector('main.vp-page') ||
      ownerThemeContainer?.querySelector('.vp-page') ||
      ownerThemeContainer
    const title = page?.querySelector('.vp-page-title')
    const content = page?.querySelector('[vp-content]:not(.custom)')
    if (title && tocPlaceholder.parentNode !== title.parentNode) {
      title.insertAdjacentElement('afterend', tocPlaceholder)
    } else if (content && tocPlaceholder.parentNode !== content.parentNode) {
      content.insertAdjacentElement('beforebegin', tocPlaceholder)
    }
  }

  const dockHost =
    tocPlaceholder.closest('.lk-article-toc-dock') ||
    ownerThemeContainer?.querySelector('.lk-article-toc-dock') ||
    null

  if (dockHost && !dockHost.querySelector('.vp-toc-placeholder')) {
    dockHost.remove()
  }

  delete tocPlaceholder.dataset.lkTocDocked
  delete tocPlaceholder.dataset.lkTocManaged
  ownerThemeContainer?.classList.remove('lk-article-toc-left')
  themeContainer?.classList.remove('lk-article-toc-left')
  return true
}

/** 取消左栏挂载：先把 TOC 节点还原到正文流，再移除空 dock（不可先 remove dock，否则会丢掉 placeholder）。 */
function undockArticleTocToInline(tocPlaceholder, themeContainer) {
  if (!themeContainer) return true

  themeContainer.classList.remove('lk-article-toc-left')

  if (tocPlaceholder instanceof HTMLElement) {
    delete tocPlaceholder.dataset.lkTocManaged
    delete tocPlaceholder.dataset.lkTocDocked
    restoreArticleTocToMarker(tocPlaceholder, themeContainer)
  } else {
    for (const ph of [...themeContainer.querySelectorAll('.lk-article-toc-dock .vp-toc-placeholder')]) {
      restoreArticleTocToMarker(ph, themeContainer)
    }
  }

  themeContainer.querySelector('.lk-article-toc-dock')?.remove()
  return true
}

/** 路由切换时清掉上一页残留的 TOC dock / lk-article-toc-left，避免正文与「此页内容」外框在下一页丢失。 */
function resetPortfolioScrollPosition() {
  if (typeof window === 'undefined') return
  window.scrollTo(0, 0)
  for (const sel of ['.theme-container', '#app', 'main.vp-page', '.vp-page-content']) {
    const el = document.querySelector(sel)
    if (el instanceof HTMLElement) el.scrollTop = 0
  }
}

function resetArticlePostLayoutForRoute(path) {
  if (typeof document === 'undefined') return

  restoreMobileArticleTocToolbar()

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  for (const container of document.querySelectorAll('.theme-container.page-article-post')) {
    container.classList.remove('lk-article-toc-left', 'sidebar-collapsed')
    for (const dock of [...container.querySelectorAll('.lk-article-toc-dock')]) {
      for (const ph of [...dock.querySelectorAll('.vp-toc-placeholder')]) {
        restoreArticleTocToMarker(ph, container)
      }
      dock.remove()
    }
  }

  if (!isPortfolioPostPath(p) || !themeContainer) return

  resetPortfolioScrollPosition()

  for (const ph of [...themeContainer.querySelectorAll('.vp-toc-placeholder')]) {
    delete ph.dataset.lkTocManaged
    delete ph.dataset.lkTocDocked
    restoreArticleTocToMarker(ph, themeContainer)
  }

  for (const marker of [...themeContainer.querySelectorAll('.lk-article-toc-marker')]) {
    if (!marker.nextElementSibling?.classList?.contains('vp-toc-placeholder')) {
      marker.remove()
    }
  }

  syncArticleRouteClasses(p)
  scheduleArticleRouteClasses(p)
}

function restoreStrayArticleTocs(activeThemeContainer = null) {
  if (typeof document === 'undefined') return

  for (const dockedToc of document.querySelectorAll('.vp-toc-placeholder[data-lk-toc-docked="left"]')) {
    if (
      activeThemeContainer &&
      (dockedToc.closest('.theme-container.page-article-post') === activeThemeContainer ||
        dockedToc.closest('.theme-container.page-article-post') === activeThemeContainer)
    ) {
      continue
    }

    restoreArticleTocToMarker(
      dockedToc,
      dockedToc.closest('.theme-container.page-article-post') ||
        dockedToc.closest('.theme-container.page-article-post'),
    )
  }
}

/*
 * TOC 里的锚点是否指向当前页面的标题。
 *
 * 这是 dock 前必须过的一关：路由切换后 theme 的 TOC 组件要等 onContentUpdated
 * （新页面 Content 挂载）才刷新 headers，而我们的 sync 跑在 nextTick + rAF 上，
 * 有一拍会读到还挂着上一篇目录的节点。一旦把那个节点搬进侧栏，Vue 后续更新就会在
 * MAIN.vp-page 原位另建一个新节点，被搬走的那个再也不会被 patch —— 侧栏于是永远
 * 停在上一篇的目录上。所以内容对不上就先不搬，让调度器重试。
 */
function articleTocMatchesPage(placeholder, themeContainer) {
  if (!(placeholder instanceof HTMLElement) || !themeContainer) return false

  const links = [...placeholder.querySelectorAll('a[href^="#"]')]
  if (!links.length) return true

  const content = themeContainer.querySelector('#markdown-content') || themeContainer
  const ids = new Set(
    [...content.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')].map(
      (el) => el.id,
    ),
  )

  return links.every((link) => {
    const raw = link.getAttribute('href')?.slice(1) || ''
    if (!raw) return true
    let id = raw
    try {
      id = decodeURIComponent(raw)
    } catch {
      /* 保留原样 */
    }
    return ids.has(id) || ids.has(raw)
  })
}

function syncArticleTocDock(path, { evictStale = false } = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  if (!isPortfolioPostPath(p) || !themeContainer) {
    restoreStrayArticleTocs()
    return true
  }

  restoreStrayArticleTocs(themeContainer)

  const sidebar = themeContainer.querySelector('.vp-sidebar')

  if (
    isDesktopArticleClusterPath(p) &&
    sidebar instanceof HTMLElement &&
    isArticleTocSidebarDockable(sidebar)
  ) {
    themeContainer.classList.remove('sidebar-collapsed')
  }

  /*
   * 上一篇的 TOC 被我们搬进了 .vp-sidebar，已经不在页面子树里，所以 Vue 卸载旧页面时
   * 删不掉它。路由刚变、新页面还没渲染出来的那一拍，themeContainer 里只有这个旧节点：
   * 下面会把它当成"现成的 TOC"再 dock 一次并 return true，调度器就不再重试，侧栏于是
   * 永远停在上一篇的目录上（点一次 TOC 里的锚点又触发一轮 sync 才会恢复——这正是
   * "只有点了此页内容才会跟着切"的现象）。所以先按 dock 时记下的路径把旧节点清掉，
   * 让本次 sync 返回 false 去等新页面的 inline TOC。
   */
  for (const stale of [
    ...themeContainer.querySelectorAll('.vp-toc-placeholder[data-lk-toc-managed="1"]'),
  ]) {
    if (!stale.dataset.lkTocPath || stale.dataset.lkTocPath === p) continue
    const staleHost = stale.closest('.lk-article-toc-dock')
    stale.remove()
    if (staleHost && !staleHost.querySelector('.vp-toc-placeholder')) staleHost.remove()
  }

  const managedTocPlaceholder = themeContainer.querySelector('.vp-toc-placeholder[data-lk-toc-managed="1"]')
  const inlineTocPlaceholder = themeContainer.querySelector('.vp-toc-placeholder:not([data-lk-toc-managed="1"])')
  const dockedTocPlaceholder = document.querySelector(
    '.vp-toc-placeholder[data-lk-toc-managed="1"][data-lk-toc-docked="left"]',
  )

  // Route changes can leave the previous article's docked TOC node behind briefly.
  // When a fresh inline TOC already exists for the current article, always prefer it
  // and discard the stale managed placeholder so "此页内容" matches the live page.
  if (
    managedTocPlaceholder &&
    inlineTocPlaceholder &&
    managedTocPlaceholder !== inlineTocPlaceholder
  ) {
    const staleDockHost = managedTocPlaceholder.closest('.lk-article-toc-dock')
    managedTocPlaceholder.remove()
    if (staleDockHost && !staleDockHost.querySelector('.vp-toc-placeholder')) {
      staleDockHost.remove()
    }
  }

  const tocPlaceholder =
    inlineTocPlaceholder ||
    managedTocPlaceholder ||
    (dockedTocPlaceholder?.closest('.theme-container.page-article-post') === themeContainer ||
      dockedTocPlaceholder?.closest('.theme-container.page-article-post') === themeContainer
      ? dockedTocPlaceholder
      : null)

  if (!sidebar) return false
  if (!tocPlaceholder) {
    themeContainer.querySelector('.lk-article-toc-dock')?.remove()
    themeContainer.classList.remove('lk-article-toc-left')
    return false
  }

  /*
   * 内容还是上一篇的就先别搬，返回 false 等调度器下一轮（32ms 一次，最多 80 次）。
   *
   * 但"等"这件事有个前提：这一页迟早会自己渲染出 TOC。frontmatter 写了 toc: false 的页面
   * （如 docs/article/edge-ai-sketch.md、vuepress-stack-notes.md）永远不会有，于是侧栏就
   * 一直挂着上一篇的目录——整篇文章换了，「此页内容」还停在前一篇的标题上；直接刷新这一页
   * 反而是对的（压根没有那张卡）。所以等过几轮之后，若侧栏里挂的是我们托管的旧节点、
   * 且正文里也没有新的 inline TOC 可换，就把它清掉：宁可空着，也别显示错的目录。
   */
  if (!articleTocMatchesPage(tocPlaceholder, themeContainer)) {
    if (evictStale && !inlineTocPlaceholder && tocPlaceholder.dataset.lkTocManaged === '1') {
      // 只能 undock，不能 remove：这个节点是 Vue 还在 patch 的活节点（TOC 组件挂在布局上，
      // 跨路由复用同一个 DOM），删掉它 Vue 之后就一直在一个脱离文档的节点上更新，
      // 后面每一篇都不会再有「此页内容」。放回正文里的 marker 处，桌面端 CSS 会把它藏起来，
      // 等它的内容跟当前页面对上了，下一轮 sync 再搬回侧栏。
      undockArticleTocToInline(tocPlaceholder, themeContainer)
    }
    return false
  }

  const shouldDockLeft = isArticleTocSidebarDockable(sidebar)

  if (!shouldDockLeft) {
    return undockArticleTocToInline(tocPlaceholder, themeContainer)
  }

  themeContainer.classList.remove('sidebar-collapsed')

  let marker = null
  const markerId = tocPlaceholder.dataset.lkTocMarkerId
  if (markerId) marker = document.getElementById(markerId)

  if (!marker) {
    marker = document.createElement('div')
    marker.hidden = true
    marker.setAttribute('aria-hidden', 'true')
    marker.className = 'lk-article-toc-marker'
    marker.id = `lk-article-toc-marker-${Math.random().toString(36).slice(2, 10)}`
    tocPlaceholder.before(marker)
    tocPlaceholder.dataset.lkTocMarkerId = marker.id
  }

  tocPlaceholder.dataset.lkTocManaged = '1'

  const sidebarLinks = sidebar.querySelector('.vp-sidebar-links')
  let dockHost = sidebar.querySelector('.lk-article-toc-dock')

  if (!dockHost) {
    dockHost = document.createElement('div')
    dockHost.className = 'lk-article-toc-dock'
    if (sidebarLinks) {
      sidebarLinks.insertAdjacentElement('afterend', dockHost)
    } else {
      sidebar.appendChild(dockHost)
    }
  }

  if (tocPlaceholder.parentNode !== dockHost) {
    dockHost.appendChild(tocPlaceholder)
  }

  tocPlaceholder.dataset.lkTocDocked = 'left'
  tocPlaceholder.dataset.lkTocPath = p
  themeContainer.classList.add('lk-article-toc-left')
  syncPortfolioSidebarLayout(p)

  window.requestAnimationFrame(() => {
    const liveThemeContainer = document.querySelector(
      '.theme-container.page-article-post.lk-article-toc-left',
    )
    if (!liveThemeContainer) return

    const liveTocHeader = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-header')
    const liveTocWrapper = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-wrapper')
    if (!(liveTocHeader instanceof HTMLElement) || !(liveTocWrapper instanceof HTMLElement)) return

    liveTocWrapper.classList.add('open')
    const arrow = liveTocHeader.querySelector('.arrow')
    if (arrow instanceof HTMLElement) {
      arrow.classList.add('down')
      arrow.classList.remove('end')
    }
    syncProjectSetupVisibility()
  })

  /*
   * 路由切换时 Vue 会在 MAIN.vp-page 里重新生成一份 TOC（我们搬走的那个节点它已经
   * 跟不住了），而这一份才是当前页面的目录。只要还能查到这个"未托管"的节点，就说明
   * 侧栏里挂的是上一篇留下的旧节点——返回 false 让调度器再跑一轮，上面的
   * managed/inline 分支会把旧的丢掉、把新的 dock 上来。
   */
  return !themeContainer.querySelector('.vp-toc-placeholder:not([data-lk-toc-managed="1"])')
}

/*
 * dock 成功之后还要复查几轮。
 *
 * theme 的 TOC 组件靠 onContentUpdated（新页面 Content 挂载）刷新 headers，这比我们的
 * nextTick + rAF 晚。最坏情况是那一拍页面内容和 TOC 都还是上一篇的——两边自洽，
 * articleTocMatchesPage 也拦不住——等我们把节点搬进侧栏之后 Vue 才更新，于是在
 * MAIN.vp-page 原位另建一份新的，侧栏那份再也不会被 patch。复查时上面的
 * managed/inline 分支会发现这份新的，把旧的丢掉换上来。
 */
function verifyArticleTocDock(path, round = 0) {
  if (typeof window === 'undefined' || round >= ARTICLE_TOC_VERIFY_ROUNDS) return

  window.setTimeout(() => {
    // 复查阶段 Vue 早已把这一页渲染完，此时还对不上就是真的对不上：允许清掉旧目录。
    syncArticleTocDock(path, { evictStale: true })
    verifyArticleTocDock(path, round + 1)
  }, 120 * (round + 1))
}

function scheduleArticleTocDock(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncArticleTocDock(resolvedPath, { evictStale: attempt >= ARTICLE_TOC_STALE_EVICT_ATTEMPT })) {
    verifyArticleTocDock(resolvedPath)
    return
  }

  if (attempt < 80) {
    window.setTimeout(() => {
      scheduleArticleTocDock(resolvedPath, attempt + 1)
    }, 32)
  }
}

function scheduleArticleSidebarIndices(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncArticleSidebarIndices(resolvedPath)) return

  if (attempt < 40) {
    window.setTimeout(() => {
      scheduleArticleSidebarIndices(resolvedPath, attempt + 1)
    }, 32)
  }
}

/** 只认真正渲染出来的锚点：display:none 的元素 rect 全 0，拿来当底边会把侧栏收成一条缝 */
function queryRenderedArticleSidebarStopAnchor(scope, selector) {
  const el = scope?.querySelector?.(selector)
  if (!(el instanceof HTMLElement)) return null
  return el.getBoundingClientRect().height > 0 ? el : null
}

function readArticleSidebarBottomPadding(sidebar) {
  const raw = Number.parseFloat(window.getComputedStyle(sidebar).paddingBottom)
  return Number.isFinite(raw) ? raw : ARTICLE_SIDEBAR_STOP_ALIGNMENT_OFFSET
}

function syncArticleSidebarStop(path) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return true

  const p = resolveRouteLikePath(path)
  const themeContainer = queryPortfolioPostThemeContainer()

  if (!isPortfolioPostPath(p) || !themeContainer) {
    clearArticleSidebarStop(document)
    return true
  }

  const sidebar = themeContainer.querySelector('.vp-sidebar')

  /* 收底只对桌面分栏有意义：窄屏侧栏是整屏抽屉，收底会把抽屉截短。
   * 这里不能再用 isArticleTocSidebarDockable —— 夸克在 >=960px 也走分栏布局，
   * 只是不挂左侧目录卡，仍然需要收底，否则「文章列表」卡会压在页脚上。 */
  if (!(sidebar instanceof HTMLElement) || !isDesktopArticleClusterPath(p)) {
    themeContainer.style.removeProperty('--lk-article-sidebar-stop-gap')
    return true
  }

  const pageNav = queryRenderedArticleSidebarStopAnchor(themeContainer, '.vp-page-nav')
  const footer = queryRenderedArticleSidebarStopAnchor(document, ARTICLE_SIDEBAR_FOOTER_SELECTOR)

  if (!pageNav && !footer) return false

  let targetBottom = Number.POSITIVE_INFINITY

  if (pageNav) {
    const navCards = [...pageNav.querySelectorAll('.auto-link')].filter(
      (el) => el instanceof HTMLElement && el.getBoundingClientRect().height > 0,
    )
    const targetBottomBase = navCards.length
      ? Math.max(...navCards.map((el) => el.getBoundingClientRect().bottom))
      : pageNav.getBoundingClientRect().bottom
    /* 对齐的是「看得见的卡片」而不是侧栏这个盒子：侧栏底部还有一层 padding，
     * 不把它加回去，左栏卡片就会比右边的上一页/下一页高出一个 padding。 */
    targetBottom = targetBottomBase + readArticleSidebarBottomPadding(sidebar)
  }

  /* 页脚是硬下界：上一页/下一页量不到（页面没有翻页卡、或渲染时机差一拍）时，
   * 单靠 --lk-article-sidebar-bottom-gap-base（22~72px）挡不住页脚，左栏就会压上去。 */
  if (footer) {
    targetBottom = Math.min(
      targetBottom,
      footer.getBoundingClientRect().top - ARTICLE_SIDEBAR_FOOTER_MIN_GAP,
    )
  }

  if (!Number.isFinite(targetBottom)) return false

  const viewportHeight = window.visualViewport?.height || window.innerHeight
  const sidebarTop = Math.max(0, sidebar.getBoundingClientRect().top)
  const maxStopGap = Math.max(0, Math.floor(viewportHeight - sidebarTop - 1))
  const stopGap = Math.min(
    maxStopGap,
    Math.max(0, Math.ceil(viewportHeight - targetBottom)),
  )

  themeContainer.style.setProperty('--lk-article-sidebar-stop-gap', `${stopGap}px`)
  return true
}

function scheduleArticleSidebarStop(path, attempt = 0) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (syncArticleSidebarStop(resolvedPath)) return

  if (attempt < 80) {
    window.setTimeout(() => {
      scheduleArticleSidebarStop(resolvedPath, attempt + 1)
    }, 32)
  }
}

function requestArticleSidebarStopSync(path) {
  if (typeof window === 'undefined') return
  const resolvedPath = path != null ? normPath(path) : normPath(window.location.pathname)

  if (articleSidebarStopSyncFrame) return

  articleSidebarStopSyncFrame = window.requestAnimationFrame(() => {
    articleSidebarStopSyncFrame = 0
    syncArticleSidebarStop(resolvedPath)
  })
}

function handleDockedArticleTocLinkClick(event) {
  if (typeof window === 'undefined') return
  if (!(event.target instanceof Element)) return

  const tocLink = event.target.closest('.lk-article-toc-dock a.vp-toc-link')
  if (!tocLink) return

  const themeContainer = tocLink.closest(
    '.theme-container.page-article-post.lk-article-toc-left',
  )
  if (!themeContainer) return

  const tocWrapper = themeContainer.querySelector('.lk-article-toc-dock .vp-toc-wrapper')
  if (!tocWrapper?.classList.contains('open')) return

  window.setTimeout(() => {
    requestArticleChromeSync(window.location.pathname)

    const liveThemeContainer = document.querySelector(
      '.theme-container.page-article-post.lk-article-toc-left',
    )
    if (!liveThemeContainer) return

    const liveTocWrapper = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-wrapper')
    if (!liveTocWrapper || liveTocWrapper.classList.contains('open')) return

    const tocHeader = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-header')
    if (!(tocHeader instanceof HTMLElement)) return

    tocHeader.click()
  }, 0)
}

function handleDockedArticleTocHeaderClick(event) {
  if (typeof window === 'undefined') return
  if (!(event.target instanceof Element)) return

  const tocHeader = event.target.closest('.lk-article-toc-dock .vp-toc-header')
  if (!tocHeader) return

  const themeContainer = tocHeader.closest(
    '.theme-container.page-article-post.lk-article-toc-left',
  )
  if (!themeContainer) return

  const tocWrapper = themeContainer.querySelector('.lk-article-toc-dock .vp-toc-wrapper')
  if (!(tocWrapper instanceof HTMLElement)) return

  const wasOpen = tocWrapper.classList.contains('open')

  window.setTimeout(() => {
    const liveThemeContainer = document.querySelector(
      '.theme-container.page-article-post.lk-article-toc-left',
    )
    if (!liveThemeContainer) return

    const liveTocHeader = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-header')
    const liveTocWrapper = liveThemeContainer.querySelector('.lk-article-toc-dock .vp-toc-wrapper')
    if (!(liveTocHeader instanceof HTMLElement) || !(liveTocWrapper instanceof HTMLElement)) return

    const isOpenNow = liveTocWrapper.classList.contains('open')
    if (isOpenNow !== wasOpen) return

    const nextOpen = !wasOpen
    liveTocWrapper.classList.toggle('open', nextOpen)

    const arrow = liveTocHeader.querySelector('.arrow')
    if (arrow instanceof HTMLElement) {
      arrow.classList.toggle('down', nextOpen)
      arrow.classList.toggle('end', !nextOpen)
    }
  }, 0)
}

function attachArticleTocDockListeners() {
  if (typeof window === 'undefined' || articleTocDockListenersAttached) return

  articleTocDockListenersAttached = true
  articleTocDockViewportHandler = () => {
    requestArticlePostLayoutResync(window.location.pathname, false)
  }
  articleLeftTocBreakpointHandler = () => {
    requestArticlePostLayoutResync(window.location.pathname, true)
  }
  articleSidebarStopScrollHandler = () => {
    requestArticleSidebarStopSync(window.location.pathname)
  }
  articleTocDockLinkHandler = (event) => {
    handleDockedArticleTocHeaderClick(event)
    handleDockedArticleTocLinkClick(event)
  }

  window.addEventListener('resize', articleTocDockViewportHandler)
  window.visualViewport?.addEventListener('resize', articleTocDockViewportHandler)
  getArticleLeftTocMediaQueryList()?.addEventListener('change', articleLeftTocBreakpointHandler)
  window.addEventListener('scroll', articleSidebarStopScrollHandler, { passive: true })
  document.addEventListener('click', articleTocDockLinkHandler, true)
  observeArticleSidebarStopTargets()
}

/*
 * 收底的锚点（上一页/下一页、页脚）都在文档流里，侧栏却是 fixed —— 只要文档重排
 * 而不产生 scroll 事件，侧栏的 bottom 就停在上一次的测量上，直接压到页脚上。
 * 会这样的至少三种：短文章根本不滚动；页脚自己改高（徽章换行、运行时长换行）；
 * **浏览器内置翻译换掉整页文字**（用户实测就是这一种：右键翻译时才重叠）。
 *
 * 所以盯 document.body 的高度 —— 任何一次文档重排都会经过它，一个 observation 覆盖
 * 全部三种。回调只改 fixed 侧栏的 bottom，不会反过来改文档高度，不存在自激。
 */
function observeArticleSidebarStopTargets() {
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
  const footer = document.querySelector(ARTICLE_SIDEBAR_FOOTER_SELECTOR)
  const body = document.body
  if (!(body instanceof HTMLElement)) return
  if (articleSidebarStopObserved === body && footer === articleSidebarStopObservedFooter) return

  if (!articleSidebarStopResizeObserver) {
    articleSidebarStopResizeObserver = new ResizeObserver(() => {
      requestArticleSidebarStopSync(window.location.pathname)
    })
  }
  articleSidebarStopResizeObserver.disconnect()
  articleSidebarStopResizeObserver.observe(body)
  // body 高度被撑满（min-height:100%）时它自己不动，页脚仍会换行改高，两个都盯着。
  if (footer instanceof HTMLElement) articleSidebarStopResizeObserver.observe(footer)
  articleSidebarStopObserved = body
  articleSidebarStopObservedFooter = footer
}

function detachArticleTocDockListeners() {
  if (typeof window === 'undefined' || !articleTocDockViewportHandler) return

  window.removeEventListener('resize', articleTocDockViewportHandler)
  window.visualViewport?.removeEventListener('resize', articleTocDockViewportHandler)
  getArticleLeftTocMediaQueryList()?.removeEventListener('change', articleLeftTocBreakpointHandler)
  if (articleSidebarStopScrollHandler) {
    window.removeEventListener('scroll', articleSidebarStopScrollHandler)
  }
  if (articleTocDockLinkHandler) {
    document.removeEventListener('click', articleTocDockLinkHandler, true)
  }
  if (articleSidebarStopSyncFrame) {
    window.cancelAnimationFrame(articleSidebarStopSyncFrame)
    articleSidebarStopSyncFrame = 0
  }
  if (articleSidebarStopResizeObserver) {
    articleSidebarStopResizeObserver.disconnect()
    articleSidebarStopResizeObserver = null
  }
  articleSidebarStopObserved = null
  articleSidebarStopObservedFooter = null
  if (articlePostLayoutResyncTimer) {
    window.clearTimeout(articlePostLayoutResyncTimer)
    articlePostLayoutResyncTimer = 0
  }
  articlePostLayoutResyncNeedsReset = false
  articleTocDockViewportHandler = null
  articleLeftTocBreakpointHandler = null
  articleTocDockLinkHandler = null
  articleSidebarStopScrollHandler = null
  articleTocDockListenersAttached = false
}

export default defineClientConfig({
  rootComponents: [
    CursorEffect,
    NetworkParticlesBgClient,
    ParticlesNavbarToggleClient,
    SiteFooter,
    SettingsFab,
    LoginGateClient,
    ArticleCategoriesAsideClient,
    PublishFabClient,
    ArticleBatchOpsClient,
    RoutePageCurtainClient,
  ],

  enhance({ app, router }) {
    // Ensure these are usable in markdown as <ProjectNineGrid /> / <ProjectCardsGrid />.
    app.component('ProjectNineGrid', ProjectNineGrid)
    app.component('ProjectCardsGrid', ProjectCardsGrid)
    app.component('AboutTimeline', AboutTimeline)
    app.component('AboutArticleRecommend', AboutArticleRecommend)
    app.component('AboutCategoriesCard', AboutCategoriesCard)
    app.component('AboutPageLayoutV2', AboutPageLayoutV2)
    app.component('AboutMePage', AboutMePage)
    app.component('VisitedChinaFootprints', VisitedChinaFootprints)
    app.component('StatsEntryGrid', StatsEntryGrid)
    app.component('StatsBigBoard', StatsBigBoard)
    app.component('HomeSidePanel', HomeSidePanel)
    app.component('ProfileCard', ProfileCard)
    app.component('ArticleIndexList', ArticleIndexList)
    app.component('ProjectPortfolio', ProjectPortfolio)
    app.component('ProductManagerCases', ProductManagerCases)
    app.component('ProjectsSidebarFilters', ProjectsSidebarFilters)
    app.component('ProjectsRolesCard', ProjectsRolesCard)
    app.component('SiteAvatar', SiteAvatar)
    router.beforeEach((to) => {
      if (!canAccessPath(to.path)) {
        return { path: '/', replace: true }
      }
      // 在首帧 paint 前挂上 lk-header-split，减少切到 About/Projects/文章 时主题布局「晚一拍」
      syncSplitPageHeader(to.path)
      syncRouteDataAttr(to.path)
      syncArticleRouteClasses(to.path)
    })
    router.afterEach((to, from) => {
      /*
       * 访客上报。放在 afterEach 里，首屏和每次客户端跳转各记一次；
       * sendBeacon 不阻塞渲染，本地开发和未配置 KV 时会自行跳过。
       * owner 只是给后台打标记用的，鉴权由服务端会话负责。
       */
      reportVisit(to.path, { owner: readAuthed() })
      if (to.path !== from?.path && isPortfolioPostPath(to.path)) {
        scheduleArticleRouteClasses(to.path)
      }
      if (to.hash && to.path !== from?.path) {
        scrollToRouteHash(to)
      }
    })
  },

  setup() {
    const route = useRoute()

    const syncHiddenNav = () => {
      applyHiddenNavbarItems()
      applyHiddenHomeEntries()
      schedulePhoneInlineNavbar()
    }

    const syncProtectedAccess = () => {
      if (typeof window === 'undefined') return
      if (!canAccessPath(route.path)) {
        window.location.replace('/')
      }
    }

    let clientShellInited = false

    /** 首屏客户端初始化：模糊层、路由类、导航/侧栏观察器、进度条、Live2D、存储事件。 */
    function initClientShell() {
      if (typeof window === 'undefined') return
      if (clientShellInited) return
      clientShellInited = true
      attachPhoneViewportListeners()
      attachPhoneInlineNavMediaListener()
      attachNavFitWatchers()
      syncBlurLayer(route.fullPath)
      attachBlurLayerListeners()
      syncSiteNonHomeClass(route.path)
      applyLive2dRouteClass(route.path)
      syncLive2dPref()
      syncSplitPageHeader(route.path)
      syncRouteDataAttr(route.path)
      syncArticleRouteClasses(route.path)

      // Keep critical DOM syncing in the same tick; defer heavier work to idle.
      ensureNavbarHideObserver()
      applyHiddenNavbarItems()
      nextTick(() => {
        nudgeNavbarSidebarRepaint()
        applyHiddenNavbarItems()
        applyHiddenHomeEntries()
        schedulePhoneInlineNavbar(route.path)
      })

      runWhenIdle(() => {
        initProgressBar()
        initLive2DScript()
        nextTick(() => {
          tryMountLive2dModel()
        })
      })

      void nextTick(() => {
        scheduleHomePageLayout(route.path)
      })
      void nextTick(() => {
        scheduleArticleChrome(route.fullPath)
      })
      attachArticleTocDockListeners()
      attachPortfolioRouteClassObserver()
      window.addEventListener(AUTH_STATE_EVENT, () => {
        scheduleProjectSetupVisibility()
        requestArticleChromeSync(window.location.pathname)
      })
      window.addEventListener('storage', onLive2dPrefStorage)
      window.addEventListener(LIVE2D_PREF_EVENT, syncLive2dPref)
      window.addEventListener('storage', syncHiddenNav)
      window.addEventListener(HIDDEN_NAV_ITEMS_EVENT, syncHiddenNav)
      window.addEventListener('storage', syncProtectedAccess)
      window.addEventListener(PROTECTED_ACCESS_EVENT, syncProtectedAccess)
    }

    watch(
      () => route.path,
      (path) => {
        syncSiteNonHomeClass(path)
      },
      { flush: 'post' },
    )

    watch(
      () => route.fullPath,
      (fullPath) => {
        syncBlurLayer(fullPath)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.path,
      (path) => {
        void nextTick(() => {
          scheduleHomePageLayout(path)
        })
      },
      { flush: 'post' },
    )

    watch(
      () => route.path,
      (path) => {
        applyLive2dRouteClass(path)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.path,
      (path) => {
        syncSplitPageHeader(path)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.path,
      (path) => {
        scheduleArticleRouteClasses(path)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.fullPath,
      (fullPath) => {
        requestArticleChromeSync(fullPath)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.path,
      (path, oldPath) => {
        if (path === oldPath) return
        if (isPortfolioPostPath(path) || isPortfolioPostPath(oldPath)) {
          resetArticlePostLayoutForRoute(path)
          restoreStrayArticleTocs()
        }
      },
      { flush: 'sync' },
    )

    watch(
      () => route.path,
      (path) => {
        syncNavbarSection(path)
        schedulePhoneInlineNavbar(path)
      },
      { flush: 'post', immediate: true },
    )

    watch(
      () => route.path,
      (path) => {
        syncRouteDataAttr(path)
      },
      { flush: 'sync', immediate: true },
    )

    watch(
      () => route.path,
      () => {
        nudgeNavbarSidebarRepaint()
        nextTick(() => {
          applyHiddenNavbarItems()
        })
      },
      { flush: 'post' },
    )

    onMounted(() => {
      initClientShell()
    })

    onUnmounted(() => {
      unplaceHomeHeroFromGrid()
      unmountHomeTypewriter()
      detachPhoneViewportListeners()
      detachLive2dViewportListeners()
      detachArticleTocDockListeners()
      detachPortfolioRouteClassObserver()
      detachBlurLayerListeners()
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onLive2dPrefStorage)
        window.removeEventListener(LIVE2D_PREF_EVENT, syncLive2dPref)
        window.removeEventListener('storage', syncHiddenNav)
        window.removeEventListener(HIDDEN_NAV_ITEMS_EVENT, syncHiddenNav)
        window.removeEventListener('storage', syncProtectedAccess)
        window.removeEventListener(PROTECTED_ACCESS_EVENT, syncProtectedAccess)
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('lk-site-non-home')
        document.documentElement.classList.remove('lk-live2d-off')
        document.documentElement.classList.remove('lk-live2d-user-off')
        document.documentElement.classList.remove('lk-live2d-route-hidden')
        document.documentElement.classList.remove(PHONE_VIEWPORT_CLASS)
        document.documentElement.classList.remove(ABOUT_PROFILE_CENTER_CLASS)
        document.documentElement.classList.remove('lk-header-split')
        document.documentElement.removeAttribute(PHONE_VIEWPORT_ATTR)
        document.documentElement.removeAttribute(ABOUT_PROFILE_CENTER_ATTR)
        document.documentElement.removeAttribute('data-lk-route')
      }
      navbarHideObserver?.disconnect()
      navbarHideObserver = null
      clearManagedNavbarVisibility()
      clearManagedHomeFeatureVisibility()
      restorePhoneInlineNavbar()
    })

    watch(
      () => route.path,
      async () => {
        await nextTick()
        nudgeLive2dForCurrentRoute()
      },
      { flush: 'post' },
    )

    watch(
      () => authedRef.value,
      async () => {
        await nextTick()
        nudgeLive2dForCurrentRoute()
      },
      { flush: 'post' },
    )

  },
})
