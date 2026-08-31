<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { normPath, setAuthed, syncAuthedFromStorage, useIsLoggedIn } from '../utils/authGate.js'
import {
  addAvatarUpload,
  AVATAR_PREF_EVENT,
  AVATAR_PREF_KEY,
  readAvatar,
  syncAvatarFromStorage,
  useAvatarOptions,
  useAvatarSrc,
  writeAvatar,
  OPEN_AVATAR_MODAL_EVENT,
} from '../utils/avatarPref.js'
import {
  LIVE2D_PREF_EVENT,
  readLive2dPref,
  writeLive2dPref,
} from '../utils/live2dPref.js'
import {
  accessControlledPageOptions,
  HIDDEN_NAV_ITEMS_EVENT,
  PROTECTED_ACCESS_EVENT,
  navbarPageOptions,
  readHiddenNavItems,
  readProtectedAccessItems,
  toggleHiddenNavItem,
  toggleProtectedAccessItem,
} from '../utils/navPrefs.js'
import { clearTranslationCache } from '../utils/pageTranslate.js'
import {
  addHomeBackgroundUpload,
  addHomePortraitUpload,
  HOME_VISUAL_PREF_EVENT,
  syncHomeVisualsFromStorage,
  useHomeBackgroundOptions,
  useHomeBackgroundSrc,
  useHomePortraitOptions,
  useHomePortraitSrc,
  writeHomeBackground,
  writeHomePortrait,
} from '../utils/homeVisualPref.js'
import { clearSiteApiCreds, writeSiteApiCreds } from '../utils/siteApiCreds.js'
import {
  clearSessionHint,
  fetchAdminSession,
  hasSessionHint,
  loginAdmin,
  logoutAdmin,
} from '../utils/adminSession.js'
import { clearVisitorLog, fetchVisitorLog } from '../utils/visitorLog.js'
import { busuanziState, ensureBusuanzi } from '../utils/busuanziClient.js'
import {
  readVisitorStatsEnabled,
  VISITOR_STATS_EVENT,
  writeVisitorStatsEnabled,
} from '../utils/visitorStatsPref.js'

const ADMIN_TABS = [
  { id: 'visual', label: '视觉' },
  { id: 'site', label: '站点' },
  { id: 'publish', label: '文章' },
  { id: 'visitors', label: '访客' },
]

/*
 * 账号密码曾经硬编码在这里，会被打进公开 bundle——任何人 view-source 都能读到，
 * 而且「登录」只是往 sessionStorage 写个标记，等于没有任何人数/设备限制。
 * 现在交给 `/api/login` 服务端比对 LK_SITE_USER / LK_SITE_PASS，
 * 会话 token 存在 Redis 的单个 key 上，天然「同时只有一个管理会话」。
 */
const ANCHOR_ID = 'lk-logout-anchor'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const logoutAnchorReady = ref(false)
const showLoginModal = ref(false)
const showAvatarModal = ref(false)
const adminTab = ref('visual')
const live2dOn = ref(false)
const hiddenNavIds = ref([])
const blockedAccessIds = ref([])
const cacheCleared = ref(false)
const visitorStatsEnabled = ref(true)
const loginPending = ref(false)
/** 服务端当前生效的那个会话（可能是别人的）。 */
const currentSession = ref(null)
/** 这次登录顶掉了谁，登录成功后提示一次。 */
const replacedSession = ref(null)
/** 后台登录流水（成功 + 失败），服务端只给已登录的人。 */
const loginLog = ref([])

/* ---- 访客日志 ---- */
const visitorLog = ref(null)
const visitorLogError = ref('')
const visitorLogLoading = ref(false)
const visitorView = ref('recent')
/* 判定筛选：all / human / suspect / bot，跟着「实时访问」这张表走。 */
const visitFilter = ref('all')

/*
 * 站长单独一档，不并进真人：这张表要回答的是「有没有别人来过」，
 * 把自己算进真人会让那个数字失真。
 */
const VISIT_VERDICTS = {
  owner: { label: '站长', cls: 'is-me' },
  human: { label: '真人', cls: 'is-human' },
  suspect: { label: '疑似', cls: 'is-suspect' },
  bot: { label: '机器', cls: 'is-bot' },
}

function verdictOf(row) {
  return VISIT_VERDICTS[row && row.verdict] || { label: '未判定', cls: 'is-unknown' }
}

/*
 * 只用来决定要不要在 IP 后面画个云朵角标，跟 lib/lk-ip-intel.js#isCloudOrg
 * 同一份关键字——判定分数已经在服务端算好随 row.reasons 带过来了，这里不重算
 * 分数，只是给眼睛一个比「悬停看 title」更快的信号。
 */
const CLOUD_ORG_RE =
  /AMAZON|AWS|GOOGLE|MICROSOFT|AZURE|DIGITALOCEAN|DIGITAL OCEAN|OVH|HETZNER|LINODE|AKAMAI|ORACLE|ALIBABA|ALIYUN|TENCENT|VULTR|CLOUDFLARE|FASTLY|SCALEWAY|CONTABO|LEASEWEB|CHOOPA/i

function ipTitle(row) {
  if (!row || !row.org) return row && row.ip ? row.ip : ''
  return `${row.ip}\nASN ${row.asn || '?'} · ${row.org}`
}

function isCloudIp(row) {
  return Boolean(row && row.org && CLOUD_ORG_RE.test(row.org))
}

/* 悬停时把加减分的依据摊开，判定才有得核对，而不是一个凭空的标签。 */
function verdictTitle(row) {
  const reasons = (row && row.reasons) || []
  const head = `${verdictOf(row).label} · ${row && row.score != null ? row.score : '—'}/100`
  return [head, ...reasons].join('\n')
}

const visitCounts = computed(() => {
  const rows = (visitorLog.value && visitorLog.value.recent) || []
  const out = { all: rows.length, owner: 0, human: 0, suspect: 0, bot: 0 }
  for (const row of rows) if (out[row.verdict] != null) out[row.verdict] += 1
  return out
})

const filteredVisits = computed(() => {
  const rows = (visitorLog.value && visitorLog.value.recent) || []
  return visitFilter.value === 'all' ? rows : rows.filter((r) => r.verdict === visitFilter.value)
})
/** 打开「访客」分区时每 15 秒拉一次，关掉就停。 */
let visitorTimer = null
/* 待推送计数原来显示在右下角悬浮按钮的角标上，按钮收进来后这个提示也得跟过来。 */
const pendingPushCount = ref(0)
const isLoggedIn = useIsLoggedIn()

const currentAvatar = useAvatarSrc()
const avatarOptions = useAvatarOptions()
const currentHomeBackground = useHomeBackgroundSrc()
const currentHomePortrait = useHomePortraitSrc()
const homeBackgroundOptions = useHomeBackgroundOptions()
const homePortraitOptions = useHomePortraitOptions()

const showLoginEntry = computed(() => !isLoggedIn.value)

function syncVisitorStatsPref() {
  visitorStatsEnabled.value = readVisitorStatsEnabled()
}

function countStoredList(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function syncPendingPushCount() {
  if (typeof window === 'undefined') return
  pendingPushCount.value = countStoredList('lk_pending_articles') + countStoredList('lk_pending_deletes')
}

function openPublishPanel() {
  closeAvatarModal()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-publish-panel'))
  }
}

function openPushPanel() {
  closeAvatarModal()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-push-sheet'))
  }
}

/* PublishFab 只写 localStorage、不发事件，所以这里在打开后台和窗口回焦时各刷一次。 */
function onWindowFocus() {
  syncPendingPushCount()
}

async function loadVisitorLog() {
  if (!isLoggedIn.value) return
  visitorLogLoading.value = true
  try {
    visitorLog.value = await fetchVisitorLog(150)
    visitorLogError.value = ''
  } catch (err) {
    visitorLogError.value = err?.message || '读取失败'
  } finally {
    visitorLogLoading.value = false
  }
}

function startVisitorPolling() {
  stopVisitorPolling()
  loadVisitorLog()
  visitorTimer = setInterval(loadVisitorLog, 15000)
}

function stopVisitorPolling() {
  if (visitorTimer) {
    clearInterval(visitorTimer)
    visitorTimer = null
  }
}

async function onClearVisitorLog() {
  if (!isLoggedIn.value) return
  if (!window.confirm('清空全部访客记录？这一步不可撤销。')) return
  try {
    await clearVisitorLog()
    await loadVisitorLog()
  } catch (err) {
    visitorLogError.value = err?.message || '清空失败'
  }
}

/** 后台显示用：2026-08-26 09:41 这种本地时间，比 ISO 好读。 */
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtPlace(row) {
  const parts = [row?.country, row?.region, row?.city].filter(Boolean)
  return parts.length ? parts.join(' / ') : '未知'
}

function toggleVisitorStats() {
  if (!isLoggedIn.value) return
  const next = !visitorStatsEnabled.value
  writeVisitorStatsEnabled(next)
  visitorStatsEnabled.value = next
  if (next) ensureBusuanzi()
}

function closeLoginModal() {
  showLoginModal.value = false
}

function closeAvatarModal() {
  showAvatarModal.value = false
}

function openLoginModal() {
  showLoginModal.value = true
}

function syncLive2d() {
  live2dOn.value = readLive2dPref()
}

function syncHiddenNav() {
  hiddenNavIds.value = readHiddenNavItems()
}

function syncProtectedAccess() {
  blockedAccessIds.value = readProtectedAccessItems()
}

function toggleLive2d() {
  writeLive2dPref(!live2dOn.value)
  syncLive2d()
}

function onNavHideOptionClick(id) {
  if (!isLoggedIn.value) return
  toggleHiddenNavItem(id)
  syncHiddenNav()
}

async function onAccessOptionClick(id) {
  if (!isLoggedIn.value) return
  toggleProtectedAccessItem(id)
  syncProtectedAccess()
  const shouldBlockCurrent = accessControlledPageOptions.some(
    (item) => item.id === id && blockedAccessIds.value.includes(item.id) && item.matches(route.path),
  )
  if (shouldBlockCurrent) {
    closeAvatarModal()
    try {
      await router.replace('/')
    } catch {
      /* ignore navigation failure */
    }
  }
}

function onClearTranslateCache() {
  clearTranslationCache()
  cacheCleared.value = true
  setTimeout(() => {
    cacheCleared.value = false
  }, 1600)
}

function openAvatarModal(tab = 'visual') {
  if (!isLoggedIn.value) return
  syncAvatarEverywhere()
  syncVisitorStatsPref()
  syncPendingPushCount()
  syncLive2d()
  syncHiddenNav()
  syncProtectedAccess()
  ensureBusuanzi()
  adminTab.value = typeof tab === 'string' && ADMIN_TABS.some((t) => t.id === tab) ? tab : 'visual'
  showAvatarModal.value = true
}

/* 别处（比如导航栏）也能发事件把后台叫起来。 */
function onOpenAvatarModalEvent(event) {
  openAvatarModal(event?.detail?.tab)
}

function onAccountEntryClick() {
  if (isLoggedIn.value) openAvatarModal()
  else openLoginModal()
}

async function onSubmit(e) {
  e.preventDefault()
  if (loginPending.value) return
  errorMsg.value = ''
  loginPending.value = true

  const user = username.value
  const pass = password.value
  const result = await loginAdmin(user, pass)
  loginPending.value = false

  if (!result.ok) {
    errorMsg.value = result.error || 'Username or password is incorrect.'
    return
  }

  setAuthed(true)
  /*
   * 写接口（publish/delete/history）同时认会话 cookie 和请求体里的凭据。
   * 这里仍然把这次输入的账号密码留在 sessionStorage，是为了让还没改造的
   * PublishFab 路径继续可用；它们不再来自 bundle，而是来自这次手输。
   */
  writeSiteApiCreds(user, pass)
  currentSession.value = result.session || null
  replacedSession.value = result.replaced || null
  loginLog.value = result.logins || []
  username.value = ''
  password.value = ''
  showLoginModal.value = false
}

async function logout() {
  closeAvatarModal()
  try {
    await router.replace('/')
  } catch {
    /* ignore navigation failure */
  }
  await logoutAdmin()
  setAuthed(false)
  clearSiteApiCreds()
  currentSession.value = null
  replacedSession.value = null
  loginLog.value = []
}

/**
 * 本地那个 sessionStorage 标记只是为了刷新后不闪，真正说了算的是服务端会话。
 * 被别人顶下线时这一步会把本地标记清掉。
 */
async function verifyServerSession() {
  /*
   * 既没有会话线索、本地也不是登录态，就是个普通访客——一次接口都不用打。
   * 只有 hint 在（可能刚在别的标签页登录过）或本地标记在（可能已被顶下线）
   * 才值得跟服务端对一次。
   */
  if (!hasSessionHint() && !isLoggedIn.value) return

  const state = await fetchAdminSession()
  if (state.unavailable) return
  currentSession.value = state.session
  loginLog.value = state.logins || []
  if (!state.authed) {
    /*
     * hint 还在但服务端不认（被顶下线 / 会话过期）：必须把 hint 也清掉。
     * 它现在是 readAuthed() 的乐观标记，留着的话下次进页面又会先画出后台入口再被打回。
     */
    clearSessionHint()
  }
  if (!state.authed && isLoggedIn.value) {
    setAuthed(false)
    clearSiteApiCreds()
    showAvatarModal.value = false
  } else if (state.authed && !isLoggedIn.value) {
    setAuthed(true)
  }
}

function applyAvatarToDom(src) {
  if (typeof document === 'undefined') return
  const avatar = src || readAvatar()

  for (const img of document.querySelectorAll('img.vp-nav-logo')) {
    img.setAttribute('src', avatar)
  }
  for (const img of document.querySelectorAll('.about-avatar-large, .lk-card__avatar')) {
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

function syncAvatarEverywhere() {
  syncAvatarFromStorage()
  syncHomeVisualsFromStorage()
  applyAvatarToDom(currentAvatar.value)
}

function selectAvatar(src) {
  if (!isLoggedIn.value) return
  writeAvatar(src)
  syncAvatarEverywhere()
}

function selectHomeBackground(src) {
  if (!isLoggedIn.value) return
  writeHomeBackground(src)
  syncHomeVisualsFromStorage()
}

function selectHomePortrait(src) {
  if (!isLoggedIn.value) return
  writeHomePortrait(src)
  syncHomeVisualsFromStorage()
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

async function onAvatarUpload(e) {
  const file = e.target?.files?.[0]
  e.target.value = ''
  if (!file || !isLoggedIn.value) return
  const dataUrl = await readImageFile(file).catch(() => '')
  if (!dataUrl) return
  addAvatarUpload(dataUrl)
  syncAvatarEverywhere()
}

async function onHomeBackgroundUpload(e) {
  const file = e.target?.files?.[0]
  e.target.value = ''
  if (!file || !isLoggedIn.value) return
  const dataUrl = await readImageFile(file).catch(() => '')
  if (!dataUrl) return
  addHomeBackgroundUpload(dataUrl)
  syncHomeVisualsFromStorage()
}

async function onHomePortraitUpload(e) {
  const file = e.target?.files?.[0]
  e.target.value = ''
  if (!file || !isLoggedIn.value) return
  const dataUrl = await readImageFile(file).catch(() => '')
  if (!dataUrl) return
  addHomePortraitUpload(dataUrl)
  syncHomeVisualsFromStorage()
}

let brandLinkEl = null
let brandLogoCaptureHandler = null
let navbarObserver = null
let anchorRaf = null

function handleNavbarBrandLogoClick(e) {
  const t = e.target
  if (!t || typeof t.matches !== 'function' || !t.matches('img.vp-nav-logo')) return
  e.preventDefault()
  e.stopPropagation()
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation()
  onAccountEntryClick()
}

function bindNavbarLogoTrigger() {
  if (typeof document === 'undefined') return
  if (brandLinkEl && brandLogoCaptureHandler) {
    brandLinkEl.removeEventListener('click', brandLogoCaptureHandler, true)
    brandLinkEl = null
    brandLogoCaptureHandler = null
  }
  const link = document.querySelector('#navbar a.vp-brand')
  if (!link) return
  brandLogoCaptureHandler = handleNavbarBrandLogoClick
  brandLinkEl = link
  brandLinkEl.addEventListener('click', brandLogoCaptureHandler, true)
}

/*
 * 「设置」在宽屏是导航栏第五项（跟在「关于我」后面）。
 * 窄屏不行：行内导航的宽度是 `calc(100vw - 9.75rem)` 且 overflow:hidden，
 * 塞第五项会被齿轮压掉半截，所以 959px 以下改由齿轮弹层里的「站点后台」进入。
 * 注意这里的 959px 和 client.js 的 PHONE_INLINE_NAV_MEDIA（719px）不是一回事：
 * 那个是「主题导航被隐藏、需要补一份行内导航」的断点，这个是「导航居中区被裁成
 * calc(100vw - 9.75rem) + overflow:hidden」的断点，塞第五项会被裁掉。
 */
const NAV_CENTER_CLIPPED_MEDIA = '(max-width: 959px)'

function getSettingsNavHost() {
  if (window.matchMedia?.(NAV_CENTER_CLIPPED_MEDIA)?.matches) return null

  const center = document.querySelector('#navbar .vp-navbar-center')
  if (!center) return null

  return center.querySelector('.vp-nav-links') || center.querySelector('.vp-nav-items')
}

function ensureLogoutAnchor() {
  if (typeof document === 'undefined') return
  bindNavbarLogoTrigger()

  /*
   * 以前「设置」被塞在亮暗开关下面（`lk-logout-slot-col` 把那格改成两行），
   * 结果右上角多出一行、翻译/齿轮/亮暗三个图标对不齐。现在它是一个普通导航项。
   */
  for (const stale of document.querySelectorAll('.vp-nav-item.lk-logout-slot-col')) {
    stale.classList.remove('lk-logout-slot-col')
  }

  const host = getSettingsNavHost()
  if (!host) {
    document.getElementById(ANCHOR_ID)?.remove()
    logoutAnchorReady.value = false
    return
  }

  let el = document.getElementById(ANCHOR_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = ANCHOR_ID
  }
  el.className = 'vp-nav-item lk-nav-settings-item'

  // 只在真的没排在末尾时才搬，否则会和自己的 MutationObserver 互相触发。
  if (el.parentNode !== host || host.lastElementChild !== el) host.appendChild(el)

  logoutAnchorReady.value = true
}

function scheduleEnsureLogoutAnchor() {
  if (typeof document === 'undefined') return
  if (typeof requestAnimationFrame === 'function') {
    if (anchorRaf != null) cancelAnimationFrame(anchorRaf)
    anchorRaf = requestAnimationFrame(() => {
      anchorRaf = null
      ensureLogoutAnchor()
      syncAvatarEverywhere()
    })
  } else {
    nextTick(() => {
      ensureLogoutAnchor()
      syncAvatarEverywhere()
    })
  }
}

function onAvatarStorage(e) {
  if (
    !e ||
    e.key === AVATAR_PREF_KEY ||
    e.key === null
  ) {
    syncAvatarEverywhere()
  }
}

onMounted(() => {
  syncAuthedFromStorage()
  // 本地标记只是防闪，服务端说了算：被顶下线/会话过期在这一步被纠正。
  verifyServerSession()
  syncAvatarEverywhere()
  syncVisitorStatsPref()
  if (readVisitorStatsEnabled()) ensureBusuanzi()
  nextTick(ensureLogoutAnchor)
  if (typeof MutationObserver !== 'undefined') {
    const nav = document.getElementById('navbar')
    if (nav) {
      navbarObserver = new MutationObserver(() => {
        scheduleEnsureLogoutAnchor()
      })
      navbarObserver.observe(nav, { childList: true, subtree: true })
    }
  }
  syncLive2d()
  syncHiddenNav()
  syncProtectedAccess()
  syncPendingPushCount()
  // 跨越 959px 时行内导航会重建，「设置」得跟着换到另一份导航列表里。
  window.addEventListener('resize', scheduleEnsureLogoutAnchor)
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('storage', onAvatarStorage)
  window.addEventListener(AVATAR_PREF_EVENT, syncAvatarEverywhere)
  window.addEventListener(HOME_VISUAL_PREF_EVENT, syncAvatarEverywhere)
  window.addEventListener(VISITOR_STATS_EVENT, syncVisitorStatsPref)
  window.addEventListener(LIVE2D_PREF_EVENT, syncLive2d)
  window.addEventListener(HIDDEN_NAV_ITEMS_EVENT, syncHiddenNav)
  window.addEventListener(PROTECTED_ACCESS_EVENT, syncProtectedAccess)
  window.addEventListener(OPEN_AVATAR_MODAL_EVENT, onOpenAvatarModalEvent)
})

watch(
  () => route.fullPath,
  () => {
    closeLoginModal()
    closeAvatarModal()
    scheduleEnsureLogoutAnchor()
  },
)

watch(isLoggedIn, (v) => {
  if (!v) closeAvatarModal()
  scheduleEnsureLogoutAnchor()
})

watch(showLoginEntry, (v) => {
  if (!v) closeLoginModal()
})

watch(showAvatarModal, (open) => {
  if (open && isLoggedIn.value) ensureBusuanzi()
  if (open && isLoggedIn.value && adminTab.value === 'visitors') startVisitorPolling()
  if (!open) stopVisitorPolling()
})

/* 只有真的在看「访客」那一屏时才轮询，切走立刻停，别在后台空转。 */
watch(adminTab, (tab) => {
  if (tab === 'visitors' && showAvatarModal.value && isLoggedIn.value) {
    startVisitorPolling()
  } else {
    stopVisitorPolling()
  }
})

onUnmounted(() => {
  stopVisitorPolling()
  if (brandLinkEl && brandLogoCaptureHandler) {
    brandLinkEl.removeEventListener('click', brandLogoCaptureHandler, true)
    brandLinkEl = null
    brandLogoCaptureHandler = null
  }
  if (anchorRaf != null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(anchorRaf)
    anchorRaf = null
  }
  if (navbarObserver) {
    navbarObserver.disconnect()
    navbarObserver = null
  }
  window.removeEventListener('resize', scheduleEnsureLogoutAnchor)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('storage', onAvatarStorage)
  window.removeEventListener(AVATAR_PREF_EVENT, syncAvatarEverywhere)
  window.removeEventListener(HOME_VISUAL_PREF_EVENT, syncAvatarEverywhere)
  window.removeEventListener(VISITOR_STATS_EVENT, syncVisitorStatsPref)
  window.removeEventListener(LIVE2D_PREF_EVENT, syncLive2d)
  window.removeEventListener(HIDDEN_NAV_ITEMS_EVENT, syncHiddenNav)
  window.removeEventListener(PROTECTED_ACCESS_EVENT, syncProtectedAccess)
  window.removeEventListener(OPEN_AVATAR_MODAL_EVENT, onOpenAvatarModalEvent)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showLoginEntry && showLoginModal"
      class="lk-login-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-label="Login"
      @click.self="closeLoginModal"
    >
      <div class="lk-login-entry-card">
        <button type="button" class="lk-login-close" aria-label="关闭登录" @click="closeLoginModal">
          ×
        </button>
        <h2 class="lk-login-entry-title">登录</h2>
        <p class="lk-login-entry-hint">
          登录后可管理头像、首页视觉、文章发布与访客统计。账号密码与发布 API 相同。
        </p>
        <form class="lk-login-entry-form" @submit="onSubmit">
          <label class="lk-login-entry-label">
            <span>用户名</span>
            <input
              v-model="username"
              class="lk-login-entry-input"
              type="text"
              name="username"
              autocomplete="username"
              required
            />
          </label>
          <label class="lk-login-entry-label">
            <span>密码</span>
            <input
              v-model="password"
              class="lk-login-entry-input"
              type="password"
              name="password"
              autocomplete="current-password"
              required
            />
          </label>
          <p v-if="errorMsg" class="lk-login-entry-error" role="alert">{{ errorMsg }}</p>
          <button type="submit" class="lk-login-entry-submit" :disabled="loginPending">
            {{ loginPending ? '验证中…' : '登录' }}
          </button>
        </form>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="isLoggedIn && showAvatarModal"
      class="lk-login-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-label="Admin settings"
      @click.self="closeAvatarModal"
    >
      <div class="lk-login-entry-card lk-avatar-card">
        <button type="button" class="lk-login-close" aria-label="关闭站点后台" @click="closeAvatarModal">
          ×
        </button>
        <h2 class="lk-login-entry-title">站点后台</h2>
        <p class="lk-login-entry-hint">
          点击导航栏左侧头像即可进入。视觉、站点开关、文章发布与访客统计都集中在这里。
        </p>

        <nav class="lk-admin-tabs" aria-label="后台分区">
          <button
            v-for="tab in ADMIN_TABS"
            :key="tab.id"
            type="button"
            class="lk-admin-tab"
            :class="{ 'is-active': adminTab === tab.id }"
            @click="adminTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!--
          四个分区的内容长短差很多（视觉最长、访客最短），直接跟在卡片里会让弹窗
          随着切 tab 一会儿高一会儿矮。这里把面板统一装进一个定高的滚动区，卡片
          高度锁在「视觉」那一屏的尺寸上，切 tab 时外框纹丝不动。
        -->
        <div class="lk-admin-body">
        <div v-show="adminTab === 'visual'">
        <section class="lk-settings-section">
          <div class="lk-settings-section__head">
            <h3>头像</h3>
            <label class="lk-upload-btn">
              上传头像
              <input type="file" accept="image/*" @change="onAvatarUpload" />
            </label>
          </div>
          <div class="lk-avatar-grid">
            <button
              v-for="item in avatarOptions"
              :key="item.src"
              type="button"
              class="lk-avatar-option"
              :class="{ 'is-active': currentAvatar === item.src }"
              :title="item.label"
              @click="selectAvatar(item.src)"
            >
              <img :src="item.src" :alt="item.label" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>

        <section class="lk-settings-section">
          <div class="lk-settings-section__head">
            <h3>首页背景</h3>
            <label class="lk-upload-btn">
              上传背景
              <input type="file" accept="image/*" @change="onHomeBackgroundUpload" />
            </label>
          </div>
          <div class="lk-avatar-grid lk-media-grid">
            <button
              v-for="item in homeBackgroundOptions"
              :key="item.src || item.label"
              type="button"
              class="lk-avatar-option"
              :class="{ 'is-active': currentHomeBackground === item.src }"
              :title="item.label"
              @click="selectHomeBackground(item.src)"
            >
              <img :src="item.src" :alt="item.label" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>

        <section class="lk-settings-section">
          <div class="lk-settings-section__head">
            <h3>首页人像</h3>
            <label class="lk-upload-btn">
              上传人像
              <input type="file" accept="image/*" @change="onHomePortraitUpload" />
            </label>
          </div>
          <div class="lk-avatar-grid lk-media-grid">
            <button
              v-for="item in homePortraitOptions"
              :key="item.src || item.label"
              type="button"
              class="lk-avatar-option"
              :class="{ 'is-active': currentHomePortrait === item.src }"
              :title="item.label"
              @click="selectHomePortrait(item.src)"
            >
              <div v-if="!item.src" class="lk-empty-media">隐藏</div>
              <img v-else :src="item.src" :alt="item.label" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>
        </div>

        <div v-show="adminTab === 'site'" class="lk-admin-panel">
          <button
            type="button"
            class="lk-admin-toggle-row"
            role="switch"
            :aria-checked="live2dOn ? 'true' : 'false'"
            @click="toggleLive2d"
          >
            <span>显示看板娘</span>
            <span class="lk-admin-toggle" :class="{ 'is-on': live2dOn }">
              <span class="lk-admin-toggle__dot" />
            </span>
          </button>
          <p class="lk-admin-note">
            看板娘只在首页一类页面出现，文章、项目、关于页本来就不显示。
          </p>

          <section class="lk-settings-section">
            <div class="lk-settings-section__head">
              <h3>隐藏导航入口</h3>
            </div>
            <p class="lk-admin-note">只隐藏导航栏里的入口，页面本身照常可以访问。</p>
            <div class="lk-admin-page-grid">
              <button
                v-for="item in navbarPageOptions"
                :key="item.id"
                type="button"
                class="lk-admin-page-option"
                :class="{ 'is-active': hiddenNavIds.includes(item.id) }"
                @click="onNavHideOptionClick(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
          </section>

          <section class="lk-settings-section">
            <div class="lk-settings-section__head">
              <h3>限制页面访问</h3>
            </div>
            <p class="lk-admin-note">被限制的页面即使还在导航栏里，点进去也会被拦回首页。</p>
            <div class="lk-admin-page-grid">
              <button
                v-for="item in accessControlledPageOptions"
                :key="item.id"
                type="button"
                class="lk-admin-page-option"
                :class="{ 'is-active': blockedAccessIds.includes(item.id) }"
                @click="onAccessOptionClick(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
          </section>

          <!--
            服务端只保留一个会话 key，所以这里显示的就是「当前唯一在线的那台设备」。
            如果 isMine 为 false，说明你已经被别人顶下线了。
          -->
          <section class="lk-settings-section">
            <div class="lk-settings-section__head">
              <h3>登录会话</h3>
            </div>
            <p class="lk-admin-note">
              同一时间只允许一个管理会话。别人登录成功会立刻把你顶下线，反之亦然。
            </p>
            <ul v-if="currentSession" class="lk-admin-stats">
              <li><span>登录时间</span><strong>{{ fmtTime(currentSession.at) }}</strong></li>
              <li><span>IP</span><strong>{{ currentSession.ip || '—' }}</strong></li>
              <li>
                <span>是否本机</span>
                <strong>{{ currentSession.isMine ? '是' : '不是（你已被顶下线）' }}</strong>
              </li>
            </ul>
            <p v-else class="lk-admin-note">读取不到会话信息（可能是 KV 未配置）。</p>
            <p v-if="replacedSession" class="lk-admin-note">
              这次登录顶掉了 {{ replacedSession.ip || '一台设备' }}（{{ fmtTime(replacedSession.at) }}）。
            </p>

            <!--
              登录流水。失败那些才是重点：密码在旧 bundle 里公开过，
              「有人在试」必须看得见。同一 IP 15 分钟失败 10 次会被临时挡住。
            -->
            <div class="lk-visit-table lk-visit-table--logins" role="table">
              <div class="lk-visit-row lk-visit-row--head" role="row">
                <span>时间</span><span>结果</span><span>IP</span><span>设备</span><span>用户名</span>
              </div>
              <div
                v-for="(row, i) in loginLog"
                :key="`${row.t}-${i}`"
                class="lk-visit-row"
                :class="{ 'is-fail': !row.ok }"
                role="row"
              >
                <span>{{ fmtTime(row.t) }}</span>
                <span>{{ row.ok ? '成功' : '失败' }}</span>
                <span class="lk-visit-ip">{{ row.ip || '—' }}</span>
                <span :title="row.ua">{{ row.model || row.device }} · {{ row.os }} · {{ row.browser }}</span>
                <span>{{ row.user || '—' }}</span>
              </div>
              <p v-if="!loginLog.length" class="lk-admin-note">还没有登录记录。</p>
            </div>
            <p class="lk-admin-note">
              成功和失败都记，保留最近 50 条。<strong>不记录密码</strong>，只记尝试的用户名。
            </p>
          </section>

          <section class="lk-settings-section">
            <div class="lk-settings-section__head">
              <h3>翻译</h3>
            </div>
            <p class="lk-admin-note">
              译文按句缓存在浏览器里。改过文案后清一次，下次翻译会重新请求。
            </p>
            <div class="lk-admin-actions">
              <button type="button" class="lk-admin-secondary-btn" @click="onClearTranslateCache">
                {{ cacheCleared ? '已清除' : '清除翻译缓存' }}
              </button>
            </div>
          </section>
        </div>

        <div v-show="adminTab === 'publish'" class="lk-admin-panel">
          <p class="lk-admin-note">
            支持拖拽 Markdown 添加文章、多篇合并推送与待删除队列。批量勾选删除请在
            <strong>/article/</strong> 列表页操作。
          </p>
          <div class="lk-admin-actions">
            <button type="button" class="lk-login-entry-submit" @click="openPublishPanel">
              添加文章
            </button>
            <button type="button" class="lk-admin-secondary-btn" @click="openPushPanel">
              推送管理<span v-if="pendingPushCount" class="lk-admin-pending-count">{{ pendingPushCount }}</span>
            </button>
          </div>
        </div>

        <div v-show="adminTab === 'visitors'" class="lk-admin-panel">
          <button
            type="button"
            class="lk-admin-toggle-row"
            role="switch"
            :aria-checked="visitorStatsEnabled ? 'true' : 'false'"
            @click="toggleVisitorStats"
          >
            <span>公开展示访客统计</span>
            <span class="lk-admin-toggle" :class="{ 'is-on': visitorStatsEnabled }">
              <span class="lk-admin-toggle__dot" />
            </span>
          </button>
          <ul class="lk-admin-stats">
            <li><span>总浏览量 (PV)</span><strong>{{ visitorLog ? visitorLog.pv : busuanziState.pv || '—' }}</strong></li>
            <li><span>今日独立访客</span><strong>{{ visitorLog ? visitorLog.uvToday : busuanziState.uv || '—' }}</strong></li>
            <li><span>累计用户个体</span><strong>{{ visitorLog ? visitorLog.uniqueTotal : '—' }}</strong></li>
            <!-- 爬虫不进 PV/UV/明细，这个数是它们唯一的痕迹（见 api/visit.js）。 -->
            <li><span>爬虫请求</span><strong>{{ visitorLog ? visitorLog.bots : '—' }}</strong></li>
          </ul>

          <div class="lk-admin-actions">
            <button
              type="button"
              class="lk-admin-secondary-btn"
              :class="{ 'is-active': visitorView === 'recent' }"
              @click="visitorView = 'recent'"
            >
              实时访问
            </button>
            <button
              type="button"
              class="lk-admin-secondary-btn"
              :class="{ 'is-active': visitorView === 'people' }"
              @click="visitorView = 'people'"
            >
              访客个体
            </button>
            <button type="button" class="lk-admin-secondary-btn" @click="loadVisitorLog">
              {{ visitorLogLoading ? '刷新中…' : '刷新' }}
            </button>
          </div>

          <p v-if="visitorLogError" class="lk-admin-note lk-admin-error">
            {{ visitorLogError }}
          </p>

          <!--
            我的设备：站长自己的访问不进明细、不算 PV/UV，每台设备只在这里占一行，
            原地覆盖（见 api/visit.js 的 owner 分支），所以这块永远只有一两行。
          -->
          <div
            v-if="visitorView === 'recent' && visitorLog?.owner?.length"
            class="lk-visit-table lk-visit-table--owner"
            role="table"
          >
            <div class="lk-visit-row lk-visit-row--head" role="row">
              <span>我的设备</span><span>当前页面</span><span>地区</span><span>设备</span><span>次数</span>
            </div>
            <div v-for="row in visitorLog.owner" :key="row.vid" class="lk-visit-row is-owner" role="row">
              <span>{{ fmtTime(row.t) }}</span>
              <span :title="row.path">{{ row.path }}</span>
              <span :title="fmtPlace(row)">{{ fmtPlace(row) }}</span>
              <span>{{ row.model || row.device }} · {{ row.os }} · {{ row.browser }}</span>
              <span>{{ row.hits }}</span>
            </div>
          </div>

          <!--
            判定筛选：分数由服务端 lib/lk-visit-classify.js 算好随 recent 一起下发，
            这里只负责过滤和展示，不在浏览器里重算。
          -->
          <div v-if="visitorView === 'recent'" class="lk-visit-filter">
            <button
              v-for="key in ['all', 'human', 'suspect', 'bot', 'owner']"
              :key="key"
              type="button"
              class="lk-visit-filter__btn"
              :class="{ 'is-active': visitFilter === key }"
              @click="visitFilter = key"
            >
              {{ key === 'all' ? '全部' : VISIT_VERDICTS[key].label }}
              <em>{{ visitCounts[key] }}</em>
            </button>
          </div>

          <!-- 实时访问：一行一次访问，最近的在最上面。15 秒自动刷新一次。 -->
          <div v-if="visitorView === 'recent'" class="lk-visit-table" role="table">
            <div class="lk-visit-row lk-visit-row--head" role="row">
              <span>时间</span><span>页面</span><span>判定</span><span>地区</span><span>设备</span><span>IP</span>
            </div>
            <div
              v-for="(row, i) in filteredVisits"
              :key="`${row.t}-${i}`"
              class="lk-visit-row"
              role="row"
            >
              <span>{{ fmtTime(row.t) }}</span>
              <span :title="row.path">{{ row.path }}</span>
              <span>
                <em class="lk-visit-tag" :class="verdictOf(row).cls" :title="verdictTitle(row)">
                  {{ verdictOf(row).label }}
                </em>
              </span>
              <span :title="fmtPlace(row)">{{ fmtPlace(row) }}</span>
              <span :title="row.ua">{{ row.model || row.device }} · {{ row.os }} · {{ row.browser }}</span>
              <span class="lk-visit-ip" :title="ipTitle(row)">
                {{ row.ip || '—' }}<em v-if="isCloudIp(row)" class="lk-visit-cloud-badge" title="IP 属于云/主机托管商网段">☁</em>
              </span>
            </div>
            <p v-if="!filteredVisits.length" class="lk-admin-note">
              {{ visitorLogLoading ? '读取中…' : visitorLog?.recent?.length ? '这个分类下没有记录。' : '还没有记录。' }}
            </p>
          </div>

          <!-- 访客个体：按 IP+UA 哈希归并成人，按访问次数排。 -->
          <div v-else class="lk-visit-table lk-visit-table--people" role="table">
            <div class="lk-visit-row lk-visit-row--head" role="row">
              <span>访客</span><span>次数</span><span>首次</span><span>最近</span><span>地区 / 设备</span>
            </div>
            <div
              v-for="person in (visitorLog?.visitors || [])"
              :key="person.vid"
              class="lk-visit-row"
              role="row"
            >
              <span class="lk-visit-ip">{{ person.vid.slice(0, 8) }}</span>
              <span>{{ person.hits }}</span>
              <span>{{ fmtTime(person.first) }}</span>
              <span>{{ fmtTime(person.last) }}</span>
              <span>{{ fmtPlace(person) }} · {{ person.model || person.device }} / {{ person.browser }}</span>
            </div>
            <p v-if="!visitorLog?.visitors?.length" class="lk-admin-note">
              {{ visitorLogLoading ? '读取中…' : '还没有记录。' }}
            </p>
          </div>

          <p class="lk-admin-note">
            每次路由变化上报一条，同一访客同一页面 30 秒内只算一次。明细保留最近 800 条，
            访客身份按 <strong>IP + UA</strong> 归并。本地开发、爬虫、以及单 IP 每分钟 120 次以上的请求都不计入。
            <strong>我自己的访问也不计入</strong>：不进明细、不算 PV/UV，只在上面「我的设备」里
            每台设备留一行实时状态。上面那个开关只管首页公开展示的 PV/UV，不影响这里的记录。
          </p>
          <div class="lk-admin-actions">
            <button type="button" class="lk-admin-secondary-btn lk-admin-danger" @click="onClearVisitorLog">
              清空访客记录
            </button>
          </div>
        </div>
        </div>

        <div class="lk-avatar-actions">
          <button type="button" class="lk-logout-nav-btn" title="Logout" @click="logout">
            退出登录
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport v-if="logoutAnchorReady && isLoggedIn" to="#lk-logout-anchor">
    <button
      type="button"
      class="lk-account-nav-btn"
      :class="{ 'has-pending': pendingPushCount > 0 }"
      title="站点后台"
      @click="openAvatarModal"
    >
      设置
    </button>
  </Teleport>
</template>

<style scoped>
.lk-login-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 99990;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.lk-login-entry-card {
  position: relative;
  width: min(22rem, calc(100vw - 2rem));
  padding: 1.1rem 1rem 1rem;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.lk-login-close {
  position: absolute;
  right: 0.55rem;
  top: 0.45rem;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(51, 65, 85, 0.7);
}

.lk-login-entry-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 700;
  color: rgba(248, 250, 252, 0.96);
}

.lk-login-entry-hint {
  margin: 0 0 0.85rem;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(148, 163, 184, 0.95);
}

.lk-login-entry-form {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.lk-login-entry-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: rgba(203, 213, 225, 0.9);
}

.lk-login-entry-input {
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid rgba(100, 116, 139, 0.45);
  background: rgba(15, 23, 42, 0.65);
  color: rgba(248, 250, 252, 0.96);
  font-size: 0.88rem;
}

.lk-login-entry-input:focus {
  outline: none;
  border-color: rgba(74, 144, 217, 0.75);
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
}

.lk-login-entry-error {
  margin: 0;
  font-size: 0.72rem;
  color: #fca5a5;
}

.lk-login-entry-submit {
  margin-top: 0.15rem;
  padding: 0.5rem 0.85rem;
  border: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: rgba(15, 23, 42, 0.92);
  background: linear-gradient(135deg, #7eb8ea 0%, #4a90d9 100%);
}

.lk-login-entry-submit:hover {
  filter: brightness(1.06);
}

.lk-avatar-card {
  width: min(42rem, calc(100vw - 2.25rem));
  /* 定高而不是 max-height：切 tab 时弹窗不再忽高忽低，尺寸永远是「视觉」那一屏。 */
  height: min(84vh, 56rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.9rem 0.85rem 0.8rem;
  border-radius: 10px;
}

.lk-avatar-card > .lk-login-entry-title,
.lk-avatar-card > .lk-login-entry-hint,
.lk-avatar-card > .lk-admin-tabs,
.lk-avatar-card > .lk-avatar-actions {
  flex: none;
}

/* 标题、分区按钮和底部「退出登录」固定，只有这块跟着内容滚。 */
.lk-admin-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.15rem;
}

.lk-settings-section + .lk-settings-section {
  margin-top: 0.9rem;
}

.lk-settings-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
}

.lk-settings-section__head h3 {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.92);
}

.lk-avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.lk-media-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.lk-avatar-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem;
  border-radius: 7px;
  border: 1px solid rgba(100, 116, 139, 0.42);
  background: rgba(15, 23, 42, 0.55);
  color: rgba(226, 232, 240, 0.96);
  cursor: pointer;
}

.lk-avatar-option img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 8px;
}

.lk-avatar-option span {
  font-size: 0.6rem;
  line-height: 1.2;
}

.lk-avatar-option.is-active {
  border-color: rgba(74, 144, 217, 0.85);
  box-shadow: 0 0 0 1px rgba(74, 144, 217, 0.22);
}

.lk-avatar-actions {
  margin-top: 0.7rem;
  display: flex;
  justify-content: flex-end;
}

.lk-upload-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.55);
  color: rgba(226, 232, 240, 0.94);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
}

.lk-upload-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.lk-empty-media {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(51, 65, 85, 0.6);
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.78rem;
  font-weight: 700;
}

@media (max-width: 719px) {
  .lk-avatar-grid,
  .lk-media-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.lk-admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0 0 0.75rem;
}

.lk-admin-tab {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(100, 116, 139, 0.42);
  background: rgba(15, 23, 42, 0.55);
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.lk-admin-tab.is-active {
  border-color: rgba(74, 144, 217, 0.85);
  background: rgba(74, 144, 217, 0.22);
}

.lk-admin-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lk-admin-note {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(148, 163, 184, 0.95);
}

.lk-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.lk-admin-secondary-btn {
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  color: rgba(226, 232, 240, 0.94);
  background: rgba(15, 23, 42, 0.55);
}

.lk-admin-page-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.lk-admin-page-option {
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  border: 1px solid rgba(100, 116, 139, 0.42);
  background: rgba(15, 23, 42, 0.55);
  color: rgba(226, 232, 240, 0.96);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.lk-admin-page-option.is-active {
  border-color: rgba(244, 114, 182, 0.88);
  background: rgba(131, 24, 67, 0.38);
  color: rgba(255, 228, 236, 0.98);
}

[data-theme='light'] .lk-admin-page-option {
  background: rgba(248, 250, 252, 0.96);
  color: rgba(30, 41, 59, 0.95);
}

[data-theme='light'] .lk-admin-page-option.is-active {
  background: rgba(252, 231, 243, 0.92);
  color: rgba(157, 23, 77, 0.96);
}

.lk-admin-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(100, 116, 139, 0.42);
  background: rgba(15, 23, 42, 0.55);
  color: rgba(226, 232, 240, 0.94);
  font-size: 0.78rem;
  cursor: pointer;
}

.lk-admin-toggle {
  position: relative;
  width: 2.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.45);
  transition: background 0.2s ease;
}

.lk-admin-toggle.is-on {
  background: rgba(74, 144, 217, 0.85);
}

.lk-admin-toggle__dot {
  position: absolute;
  top: 0.12rem;
  left: 0.12rem;
  width: 0.96rem;
  height: 0.96rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.lk-admin-toggle.is-on .lk-admin-toggle__dot {
  transform: translateX(1rem);
}

.lk-admin-stats {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.45rem;
}

.lk-admin-stats li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.45);
  font-size: 0.75rem;
  color: rgba(203, 213, 225, 0.92);
}

.lk-admin-stats strong {
  font-size: 0.85rem;
  color: rgba(248, 250, 252, 0.96);
}

.lk-admin-secondary-btn.is-active {
  border-color: rgba(74, 144, 217, 0.85);
  background: rgba(74, 144, 217, 0.22);
}

.lk-admin-danger {
  border-color: rgba(248, 113, 113, 0.45);
  color: rgba(254, 202, 202, 0.95);
}

.lk-admin-error {
  color: #fca5a5;
}

/*
 * 访客明细。列宽固定 + 每格 ellipsis，长 UA/长路径不会把弹窗撑破；
 * 窄屏交给外层横向滚动，不做换行——一行一次访问读起来才快。
 */
.lk-visit-table {
  display: block;
  max-height: 22rem;
  overflow: auto;
  border-radius: 8px;
  border: 1px solid rgba(100, 116, 139, 0.32);
  background: rgba(15, 23, 42, 0.4);
}

.lk-visit-row {
  display: grid;
  grid-template-columns: 4.6rem minmax(5rem, 1.25fr) 3.1rem minmax(4.2rem, 0.85fr) minmax(6.5rem, 1.15fr) 6.6rem;
  gap: 0.45rem;
  padding: 0.34rem 0.55rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: rgba(203, 213, 225, 0.92);
  border-top: 1px solid rgba(100, 116, 139, 0.16);
}

.lk-visit-table--people .lk-visit-row {
  grid-template-columns: 4.6rem 3rem 4.6rem 4.6rem minmax(8rem, 1.6fr);
}

.lk-visit-table--logins {
  max-height: 13rem;
  margin-top: 0.5rem;
}

.lk-visit-table--logins .lk-visit-row {
  grid-template-columns: 4.6rem 2.6rem 7.5rem minmax(8rem, 1.4fr) minmax(4rem, 0.8fr);
}

/* 失败的登录尝试标红——这是唯一需要一眼扫到的一行。 */
.lk-visit-row.is-fail {
  color: #fca5a5;
}

[data-theme='light'] .lk-visit-row.is-fail {
  color: rgba(185, 28, 28, 0.95);
}

.lk-visit-row > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lk-visit-row--head {
  position: sticky;
  top: 0;
  z-index: 1;
  border-top: none;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.96);
  background: rgba(30, 41, 59, 0.96);
}

/*
 * 我的设备：不是流水账，是「每台设备一行」的实时状态，所以单独一块、高度按两三行给，
 * 颜色也不再像以前那样淡化——它就这么两行，不需要一眼跳过。
 */
.lk-visit-table--owner {
  max-height: 8rem;
  margin-bottom: 0.5rem;
  border-color: rgba(56, 189, 248, 0.42);
}

.lk-visit-table--owner .lk-visit-row {
  grid-template-columns: 4.6rem minmax(6rem, 1.4fr) minmax(5rem, 1fr) minmax(8rem, 1.3fr) 3rem;
}

.lk-visit-row.is-owner {
  color: rgba(186, 230, 253, 0.92);
}

[data-theme='light'] .lk-visit-row.is-owner {
  color: rgba(7, 89, 133, 0.95);
}

/*
 * 判定标签：三档配色刻意不用绿/红的常规语义——这是倾向性分数不是结论，
 * 所以「机器」用低饱和的灰橙提示，而不是报错红，避免看成告警。
 */
.lk-visit-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.5rem 0 0.4rem;
}

.lk-visit-filter__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.16rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(100, 116, 139, 0.4);
  background: rgba(15, 23, 42, 0.36);
  color: rgba(203, 213, 225, 0.9);
  font-size: 0.66rem;
  cursor: pointer;
}

.lk-visit-filter__btn > em {
  font-style: normal;
  opacity: 0.68;
}

.lk-visit-filter__btn.is-active {
  border-color: rgba(56, 189, 248, 0.7);
  background: rgba(56, 189, 248, 0.18);
  color: rgba(224, 242, 254, 0.98);
}

.lk-visit-tag {
  display: inline-block;
  padding: 0 0.3rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-style: normal;
  line-height: 1.5;
  cursor: help;
}

.lk-visit-tag.is-me {
  background: rgba(167, 139, 250, 0.22);
  color: rgba(233, 213, 255, 0.98);
}

.lk-visit-tag.is-human {
  background: rgba(56, 189, 248, 0.2);
  color: rgba(186, 230, 253, 0.98);
}

.lk-visit-tag.is-suspect {
  background: rgba(148, 163, 184, 0.22);
  color: rgba(226, 232, 240, 0.92);
}

.lk-visit-tag.is-bot {
  background: rgba(217, 119, 6, 0.2);
  color: rgba(253, 230, 138, 0.96);
}

.lk-visit-tag.is-unknown {
  background: rgba(100, 116, 139, 0.18);
  color: rgba(203, 213, 225, 0.8);
}

[data-theme='light'] .lk-visit-filter__btn {
  background: rgba(248, 250, 252, 0.9);
  border-color: rgba(148, 163, 184, 0.45);
  color: rgba(51, 65, 85, 0.92);
}

[data-theme='light'] .lk-visit-filter__btn.is-active {
  border-color: rgba(2, 132, 199, 0.6);
  background: rgba(186, 230, 253, 0.6);
  color: rgba(7, 89, 133, 0.98);
}

[data-theme='light'] .lk-visit-tag.is-me {
  background: rgba(221, 214, 254, 0.8);
  color: rgba(76, 29, 149, 0.98);
}

[data-theme='light'] .lk-visit-tag.is-human {
  background: rgba(186, 230, 253, 0.7);
  color: rgba(7, 89, 133, 0.98);
}

[data-theme='light'] .lk-visit-tag.is-suspect {
  background: rgba(226, 232, 240, 0.85);
  color: rgba(51, 65, 85, 0.95);
}

[data-theme='light'] .lk-visit-tag.is-bot {
  background: rgba(254, 215, 170, 0.8);
  color: rgba(154, 52, 18, 0.98);
}

.lk-visit-ip {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.64rem;
}

.lk-visit-cloud-badge {
  margin-left: 2px;
  font-style: normal;
  opacity: 0.75;
}

[data-theme='light'] .lk-visit-table {
  background: rgba(248, 250, 252, 0.9);
  border-color: rgba(148, 163, 184, 0.4);
}

[data-theme='light'] .lk-visit-row {
  color: rgba(51, 65, 85, 0.92);
}

[data-theme='light'] .lk-visit-row--head {
  color: rgba(15, 23, 42, 0.94);
  background: rgba(226, 232, 240, 0.96);
}

.lk-admin-pending-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1rem;
  height: 1.1rem;
  margin-left: 0.4rem;
  padding: 0 0.28rem;
  border-radius: 999px;
  background: #ef4444;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
}
</style>

<style>
/* 「设置」现在是导航栏第五项，样式要和 首页/项目/文章/关于我 一模一样：纯文字、无边框。 */
#lk-logout-anchor.lk-nav-settings-item {
  display: flex;
  align-items: center;
  line-height: inherit;
}

/*
 * 只做「把 <button> 还原成一段文字」这件事：字号、颜色、内边距、hover 下划线
 * 都交给 index.scss 里那套 `.vp-nav-item` 规则（已把本类加进它的选择器组），
 * 这样「设置」和 首页/项目/文章/关于我 永远保持同一套样式，不会各改各的。
 */
.lk-nav-settings-item .lk-account-nav-btn {
  display: inline-block;
  margin: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

/* 有待推送的文章/删除时给个小圆点——原来这个提示挂在右下角悬浮按钮的角标上。 */
.lk-nav-settings-item .lk-account-nav-btn.has-pending::after {
  content: '';
  width: 0.36rem;
  height: 0.36rem;
  margin-left: 0.28rem;
  border-radius: 999px;
  background: #ef4444;
}

.lk-logout-nav-btn {
  margin: 0;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: rgba(226, 232, 240, 0.88);
  background: rgba(30, 41, 59, 0.75);
  white-space: nowrap;
}

.lk-logout-nav-btn:hover {
  border-color: rgba(148, 163, 184, 0.55);
  color: rgba(248, 250, 252, 0.96);
  background: rgba(51, 65, 85, 0.88);
}

[data-theme='light'] .lk-login-entry-card {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(100, 116, 139, 0.25);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

[data-theme='light'] .lk-login-entry-title,
[data-theme='light'] .lk-settings-section__head h3 {
  color: rgba(15, 23, 42, 0.92);
}

[data-theme='light'] .lk-login-entry-hint {
  color: rgba(71, 85, 105, 0.95);
}

[data-theme='light'] .lk-login-entry-label {
  color: rgba(51, 65, 85, 0.9);
}

[data-theme='light'] .lk-login-entry-input {
  border-color: rgba(148, 163, 184, 0.55);
  background: rgba(248, 250, 252, 0.95);
  color: rgba(15, 23, 42, 0.92);
}

[data-theme='light'] .lk-logout-nav-btn,
[data-theme='light'] .lk-upload-btn {
  border-color: rgba(100, 116, 139, 0.35);
  color: rgba(51, 65, 85, 0.9);
  background: rgba(241, 245, 249, 0.9);
}

[data-theme='light'] .lk-logout-nav-btn:hover {
  border-color: rgba(71, 85, 105, 0.45);
  background: rgba(226, 232, 240, 0.95);
}

[data-theme='light'] .lk-avatar-option {
  background: rgba(248, 250, 252, 0.9);
  color: rgba(30, 41, 59, 0.94);
  border-color: rgba(148, 163, 184, 0.45);
}

[data-theme='light'] .lk-empty-media {
  background: rgba(226, 232, 240, 0.85);
  color: rgba(51, 65, 85, 0.94);
}
</style>
