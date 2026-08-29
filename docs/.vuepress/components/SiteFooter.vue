<template>
  <footer class="lk-footer" aria-label="站点页脚">
    <div class="lk-footer__bg" aria-hidden="true" />

    <div class="lk-footer__inner">
      <!-- 仿图 1：单行三列 — 左版权 | 中 badge | 右运行时间 -->
      <div class="lk-footer__row">
        <div class="lk-footer__copy">
          <span class="lk-footer__copy-line">© {{ copyStart }} - {{ year }} By</span>
          <span class="lk-footer__copy-line lk-footer__copy-line--brand">Luke's Space</span>
        </div>

        <nav class="lk-footer__badges" aria-label="技术栈与协议">
          <a
            v-for="badge in badges"
            :key="badge.label"
            :href="badge.href"
            class="lk-footer__badge"
            :class="badge.tone"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`${badge.label}: ${badge.value}`"
          >
            <span class="lk-footer__badge-icon" aria-hidden="true">{{ badge.icon }}</span>
            <span class="lk-footer__badge-label">{{ badge.label }}</span>
            <span class="lk-footer__badge-value">{{ badge.value }}</span>
          </a>
        </nav>

        <div class="lk-footer__uptime" aria-live="polite">
          <div class="lk-footer__uptime-inner">
            <span class="lk-footer__uptime-line lk-footer__uptime-line--label">这个小破站已运行</span>
            <span
              class="lk-footer__uptime-line lk-footer__uptime-line--time"
              data-lk-no-translate
              >{{ uptimeDurationLine }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'

const isEnglish = computed(() => pageLang.value !== SOURCE_LANG)

const year = __LK_SITE_YEAR__
/** 与版权年范围起点一致，仅展示用 */
const copyStart = 2025

/** 开站起算时间由构建注入，见 `docs/.vuepress/config.js` 的 `lkSiteOnlineSinceIso` 或环境变量 `LK_SITE_ONLINE_SINCE` */
const SITE_ONLINE_SINCE_ISO = __LK_SITE_ONLINE_SINCE_ISO__

const badges = [
  { label: 'Frame', value: 'VuePress', icon: '⚡', tone: 'tone-blue', href: 'https://v2.vuepress.vuejs.org/' },
  { label: 'Theme', value: 'Hope', icon: '✨', tone: 'tone-purple', href: 'https://theme-hope.vuejs.press/' },
  { label: 'Host', value: 'Vercel', icon: '▲', tone: 'tone-dark', href: 'https://vercel.com/' },
  { label: 'CDN', value: 'Cloudflare', icon: '🔶', tone: 'tone-orange', href: 'https://cloudflare.com/' },
  { label: 'Source', value: 'GitHub', icon: '🐙', tone: 'tone-green', href: 'https://github.com/' },
  {
    label: 'Copyright',
    value: 'CC BY-NC 4.0',
    icon: '©',
    tone: 'tone-red',
    href: 'https://creativecommons.org/licenses/by-nc/4.0/',
  },
]

/** 仅第二行：年天时分秒，与首行「这个小破站已运行」分离，避免在不当位置换行 */
const uptimeDurationLine = ref('…')

// 每秒才刷新一次，切语言时不等下一拍，立刻重拼一次。
watch(isEnglish, () => {
  uptimeDurationLine.value = formatUptimeDurationLine()
})

function formatUptimeDurationLine() {
  const start = new Date(SITE_ONLINE_SINCE_ISO).getTime()
  if (Number.isNaN(start)) {
    return isEnglish.value ? 'Uptime unavailable' : '运行时间计算异常'
  }
  const now = Date.now()
  const diff = Math.max(0, now - start)
  const totalSec = Math.floor(diff / 1000)
  const daysAll = Math.floor(totalSec / 86400)
  const years = Math.floor(daysAll / 365)
  const remDays = daysAll - years * 365
  const remSec = totalSec - daysAll * 86400
  const hours = Math.floor(remSec / 3600)
  const minutes = Math.floor((remSec % 3600) / 60)
  const seconds = remSec % 60
  /*
   * 这一行每秒重写自己，属于 characterData 变更，pageTranslate 的增量扫描看不到它
   * （而且每秒都是一个新字符串，缓存也永远命中不了），所以不能指望翻译层兜底，直接按语言拼。
   */
  if (isEnglish.value) {
    return `${years}y ${remDays}d ${hours}h ${minutes}m ${seconds}s`
  }
  return `${years} 年 ${remDays} 天 ${hours} 时 ${minutes} 分 ${seconds} 秒`
}

let timerId

onMounted(() => {
  const tick = () => {
    uptimeDurationLine.value = formatUptimeDurationLine()
  }
  tick()
  timerId = window.setInterval(tick, 1000)
})

onUnmounted(() => {
  if (timerId) window.clearInterval(timerId)
})
</script>

<style scoped>
.lk-footer {
  /* 在主题主列内 breakout 到整屏：须用 100vw，且不能用 max-width:100%（会等于父级内容宽，黑底拉不满） */
  position: relative;
  width: 100vw;
  max-width: none;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  font-family: inherit;
}

.lk-footer__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #0a0a0b;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .lk-footer__bg {
  background: #0a0a0b;
}

.lk-footer__inner {
  position: relative;
  z-index: 1;
  max-width: min(1280px, 100%);
  margin: 0 auto;
  padding: 0.9rem 1.25rem 0.85rem;
  box-sizing: border-box;
}

/* 三列 Grid：左 1fr | 中 auto | 右 1fr，与徽章的 column-gap 左右对称；侧栏内容各自在 1fr 内居中 */
.lk-footer__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 1.25rem;
  row-gap: 0.75rem;
  width: 100%;
}

.lk-footer__copy {
  justify-self: center;
  min-width: 0;
  max-width: 15rem;
  width: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.2rem;
  font-size: 0.8rem;
  line-height: 1.35;
  font-weight: 500;
  color: rgba(163, 163, 163, 0.95);
  letter-spacing: 0.01em;
}

.lk-footer__copy-line {
  display: block;
  max-width: 100%;
}

.lk-footer__copy-line--brand {
  font-weight: 700;
  color: #e5e5e5;
  letter-spacing: 0.02em;
}

.lk-footer__badges {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  align-self: center;
  gap: 0.28rem;
  min-width: 0;
  max-width: min(56rem, 100%);
}

.lk-footer__uptime {
  justify-self: center;
  min-width: 0;
  max-width: 15rem;
  width: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  line-height: 1.35;
  font-weight: 500;
  color: rgba(163, 163, 163, 0.95);
  letter-spacing: 0.01em;
}

.lk-footer__uptime-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.22rem;
  width: max-content;
  max-width: 100%;
}

.lk-footer__uptime-line {
  display: block;
  max-width: 100%;
}

.lk-footer__uptime-line--label {
  color: rgba(180, 180, 180, 0.92);
  font-size: 0.76rem;
}

.lk-footer__uptime-line--time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  overflow-wrap: normal;
  word-break: keep-all;
}

/* 双色 pill：略紧凑，配合 nowrap 尽量保持一行六枚 */
.lk-footer__badge {
  display: inline-flex;
  align-items: stretch;
  flex: 0 0 auto;
  border-radius: 4px;
  overflow: hidden;
  font-size: 0.62rem;
  font-weight: 600;
  font-family: 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif;
  text-decoration: none;
  letter-spacing: 0.01em;
  line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
    box-shadow 0.22s ease;
}

.lk-footer__badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
  text-decoration: none;
}

.lk-footer__badge-icon,
.lk-footer__badge-label {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.38rem;
  background: #3f4449;
  color: #ffffff;
  white-space: nowrap;
}

.lk-footer__badge-icon {
  padding-right: 0.2rem;
  font-size: 0.62rem;
}

.lk-footer__badge-label {
  padding-left: 0.08rem;
  padding-right: 0.42rem;
}

.lk-footer__badge-value {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.45rem;
  color: #ffffff;
  white-space: nowrap;
}

.lk-footer__badge.tone-blue .lk-footer__badge-value {
  background: #1e88e5;
}
.lk-footer__badge.tone-purple .lk-footer__badge-value {
  background: #8e44ad;
}
.lk-footer__badge.tone-dark .lk-footer__badge-value {
  background: #1f2937;
}
.lk-footer__badge.tone-orange .lk-footer__badge-value {
  background: #f56b1a;
}
.lk-footer__badge.tone-green .lk-footer__badge-value {
  background: #2ea44f;
}
.lk-footer__badge.tone-red .lk-footer__badge-value {
  background: #c62828;
}

/* 窄屏：单列堆叠；徽章可换行 */
@media (max-width: 1024px) {
  .lk-footer__row {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    row-gap: 0.55rem;
  }

  .lk-footer__copy {
    max-width: 100%;
  }

  .lk-footer__badges {
    flex-wrap: wrap;
    max-width: 100%;
  }

  .lk-footer__uptime {
    max-width: 100%;
  }

  .lk-footer__uptime-line--time {
    white-space: normal;
  }
}

@media (max-width: 719px) {
  /* 强制 footer 相对视口横向 100vw 居中，避免父级（#app / theme-container）
     在某些移动浏览器下让 width: 100vw + margin-left: calc(50% - 50vw) 反推不到屏幕边。
     left:50% + translateX(-50%) 是等价但更稳的「viewport 居中」反推。 */
  .lk-footer {
    position: relative !important;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) !important;
    width: 100vw !important;
    max-width: 100vw !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .lk-footer__bg {
    inset: 0 !important;
    width: 100% !important;
    height: 100%;
  }

  .lk-footer__inner {
    padding: 0.85rem 0.75rem 0.8rem;
    max-width: 100% !important;
    width: 100%;
    box-sizing: border-box;
  }

  .lk-footer__copy,
  .lk-footer__uptime {
    font-size: 0.74rem;
  }

  .lk-footer__badge {
    font-size: 0.64rem;
  }
}
</style>
