<template>
  <!-- 图 1：首页小卡片 — 浅底、方角头像、Luke、三枚社交圆钮 -->
  <aside
    v-if="mini"
    class="lk-card lk-card--mini"
    :class="{ 'lk-card--mini-embedded': embedded }"
  >
    <div class="lk-card--mini__avatar">
      <img class="lk-card--mini__avatar-img" :src="avatarSrc" :alt="author.name" />
    </div>
    <div class="lk-card--mini__name">{{ author.name }}</div>
    <nav class="lk-card--mini__dock" aria-label="社交与联系">
      <a
        class="lk-card--mini__btn lk-card--mini__btn--email"
        :href="mailtoUrl"
        title="Email"
        aria-label="Email"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
          <path
            d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
          />
        </svg>
      </a>
      <a
        class="lk-card--mini__btn lk-card--mini__btn--github no-external-link-icon"
        :href="githubUrl"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub"
        aria-label="GitHub"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
          <path
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
          />
        </svg>
      </a>
      <div class="lk-card--mini__wechat-wrap">
        <button
          type="button"
          class="lk-card--mini__btn lk-card--mini__btn--wechat"
          title="微信"
          aria-label="微信"
        >
          <!-- 单一封闭路径的微信 logo（避免 fill-rule 留出白色镂空） -->
          <svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11.6 4C5.7 4 1 8 1 13c0 2.7 1.4 5.1 3.7 6.7l-.9 2.7 3.2-1.6c1.5.4 3.1.6 4.6.6.4 0 .8 0 1.2-.1-.3-.9-.4-1.8-.4-2.7 0-4.7 4.4-8.4 9.7-8.4.5 0 1 0 1.4.1C22.8 7 17.7 4 11.6 4zm-3.9 4.6c.7 0 1.2.5 1.2 1.2s-.5 1.2-1.2 1.2-1.2-.5-1.2-1.2.5-1.2 1.2-1.2zm7.7 0c.7 0 1.2.5 1.2 1.2s-.5 1.2-1.2 1.2-1.2-.5-1.2-1.2.5-1.2 1.2-1.2z"
            />
            <path
              fill="currentColor"
              d="M30 18.9c0-4.1-3.9-7.4-8.6-7.4s-8.6 3.3-8.6 7.4 3.9 7.4 8.6 7.4c1 0 2-.2 3-.5l2.7 1.5-.8-2.4c2.3-1.4 3.7-3.5 3.7-6zm-11.4-1.6c-.6 0-1-.4-1-1s.5-1 1-1 1 .5 1 1-.4 1-1 1zm5.8 0c-.6 0-1-.4-1-1s.5-1 1-1 1 .5 1 1-.4 1-1 1z"
            />
          </svg>
        </button>
        <div class="lk-card--mini__wechat-pop">
          <img
            v-show="!qrFailed"
            class="lk-card--mini__wechat-qr"
            :src="qrSrc"
            alt="微信二维码"
            @error="onQrError"
          />
        </div>
      </div>
    </nav>
    <p v-if="repoUrl" class="lk-card--mini__star-hint">
      觉得有帮助的话，给本站点个 Star 吧<span class="lk-card--mini__star-kaomoji" aria-hidden="true"
        >(๑˃ᴗ˂)✧</span
      >
    </p>
    <a
      v-if="repoUrl"
      class="lk-card--mini__star no-external-link-icon"
      :href="repoUrl"
      target="_blank"
      rel="noopener noreferrer"
      :title="`欢迎 Star ⭐ ${repoName}`"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true">
        <path
          d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
        />
      </svg>
      <span>点个 Star</span>
      <span v-if="repoStats" class="lk-card--mini__star-stats">
        <span class="lk-card--mini__star-stat" :title="`${repoStats.stars} stars`">
          <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12" aria-hidden="true">
            <path
              d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
            />
          </svg>
          {{ formatCount(repoStats.stars) }}
        </span>
        <span class="lk-card--mini__star-stat" :title="`${repoStats.forks} forks`">
          <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" aria-hidden="true">
            <path
              d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"
            />
          </svg>
          {{ formatCount(repoStats.forks) }}
        </span>
      </span>
    </a>
  </aside>

  <aside v-else class="lk-card" :class="{ 'lk-card--embedded': embedded }">
    <!-- Avatar — click/hover rotates clockwise; release reverses counter-clockwise -->
    <div class="lk-card__avatar-wrap">
      <img class="lk-card__avatar" :src="avatarSrc" :alt="author.name" />
    </div>

    <!-- Name with gradient text -->
    <div class="lk-card__name">{{ author.name }}</div>
    <div class="lk-card__sub">Incoming HKU ECIC</div>

    <!-- Tags -->
    <div class="lk-card__tags">
      <span class="lk-card__tag">Tech</span>
      <span class="lk-card__tag">Travel</span>
      <span class="lk-card__tag">Study Abroad</span>
    </div>

    <div class="lk-card__divider" />

    <!-- Social dock -->
    <nav class="lk-card__dock" aria-label="Social links">

      <a class="lk-card__dock-btn" href="/" title="Home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/><path d="M3 12v9h18v-9"/>
        </svg>
      </a>

      <!-- GitHub — hover shows profile popover -->
      <div class="lk-card__gh-wrap">
        <a class="lk-card__dock-btn" :href="githubUrl"
          target="_blank" rel="noopener noreferrer" title="GitHub">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
        </a>
        <!-- GitHub hover card -->
        <div class="lk-card__gh-popup">
          <div class="lk-card__gh-avatar-row">
            <img class="lk-card__gh-avatar" :src="avatarSrc" :alt="author.name" />
            <div>
              <div class="lk-card__gh-name">{{ author.name }}</div>
              <div class="lk-card__gh-handle">@{{ author.github }}</div>
            </div>
          </div>
          <p class="lk-card__gh-bio">Incoming HKU ECIC · 前端 / AI / 嵌入式</p>
          <a class="lk-card__gh-cta" :href="githubUrl" target="_blank" rel="noopener">
            查看 GitHub →
          </a>
        </div>
      </div>

      <a class="lk-card__dock-btn" :href="author.bilibili"
        target="_blank" rel="noopener noreferrer" title="Bilibili">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .356-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
        </svg>
      </a>

      <a class="lk-card__dock-btn" :href="mailtoUrl" title="Email">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </a>

      <span class="lk-card__dock-sep" aria-hidden="true"></span>

      <a class="lk-card__dock-btn" :href="author.qq"
        target="_blank" rel="noopener noreferrer" title="QQ">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.003 2c-4.265 0-8.006 2.59-8.006 7.723 0 2.25.765 3.767 1.572 4.838C5.07 15.44 4.5 16.632 4.5 17.4c0 1.29.876 1.63 1.73 1.63.278 0 .674-.03 1.064-.09C7.83 20.51 9.765 22 12.003 22c2.238 0 4.173-1.49 4.71-3.06.39.06.786.09 1.064.09.854 0 1.73-.34 1.73-1.63 0-.768-.57-1.96-1.069-2.839.807-1.071 1.572-2.588 1.572-4.838C20.01 4.59 16.268 2 12.003 2zM9.5 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
        </svg>
      </a>

      <!-- WeChat — hover shows QR popup -->
      <div class="lk-card__wechat-wrap">
        <button class="lk-card__dock-btn lk-card__dock-btn--wechat" title="微信">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.623-6.348-7.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.064-6.088v-.034zm-2.01 3.1c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.543.434-.983.969-.983zm4.017 0c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.543.434-.983.969-.983z"/>
          </svg>
        </button>
        <!-- QR popup card -->
        <div class="lk-card__wechat-popup">
          <!-- 将 /wechat-qr.jpg 放入 docs/.vuepress/public/ 即可显示 -->
          <img class="lk-card__wechat-qr" :src="qrSrc" alt="微信二维码"
            @error="onQrError" />
          <div v-if="qrFailed" class="lk-card__wechat-qr-ph">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/>
              <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
              <rect x="18" y="19" width="3" height="2"/>
            </svg>
            <span>请放置二维码图片</span>
          </div>
          <p class="lk-card__wechat-label">扫码添加好友</p>
          <!-- speech bubble arrow -->
        </div>
      </div>

    </nav>

    <!-- 毛玻璃底部区域 -->
    <div class="lk-card__footer">
      <span class="lk-card__footer-text">Personal Space</span>
    </div>
  </aside>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { syncAvatarFromStorage, useAvatarSrc } from '../utils/avatarPref.js'
import { siteConfig } from '../site.config.js'

const author = siteConfig.author
const githubUrl = `https://github.com/${author.github}`
const mailtoUrl = `mailto:${author.email}`
/** 本站开源仓库；小卡片底部的 Star CTA 指向它（siteConfig.repo 为空则不渲染） */
const repoName = siteConfig.repo || ''
const repoUrl = repoName ? `https://github.com/${repoName}` : ''

defineProps({
  /** 嵌入侧栏控制面板时：去大阴影与 min-height，占满所在列 */
  embedded: { type: Boolean, default: false },
  /** 图 1 首页小卡片：浅底、方头像、Luke、三社交 */
  mini: { type: Boolean, default: false },
})

/**
 * Star 行右侧的 star / fork 数。走 GitHub 匿名 API（每 IP 60 次/小时），
 * 结果在 localStorage 缓存 6 小时——这张卡片在首页每次进入都会挂载，实时请求
 * 很快就会把额度用光，而这两个数字并不需要实时。
 * 任何一步失败都保持 null、整段不渲染：卡片不能因为拿不到数字而变形或报错。
 */
const REPO_STATS_KEY = 'lk_repo_stats'
const REPO_STATS_TTL = 6 * 60 * 60 * 1000
const repoStats = ref(null)

/** 1200 → 1.2k，12000 → 12k；数字不是 CJK 文本节点，不进翻译词典 */
function formatCount(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return String(n)
  if (n < 10000) {
    const k = (n / 1000).toFixed(1)
    return `${k.endsWith('.0') ? k.slice(0, -2) : k}k`
  }
  return `${Math.round(n / 1000)}k`
}

function readCachedStats() {
  try {
    const cached = JSON.parse(localStorage.getItem(REPO_STATS_KEY) || 'null')
    if (!cached || cached.repo !== repoName) return null
    if (!(Date.now() - cached.at < REPO_STATS_TTL)) return null
    return { stars: cached.stars, forks: cached.forks }
  } catch {
    return null
  }
}

async function loadRepoStats() {
  if (!repoName) return
  const cached = readCachedStats()
  if (cached) {
    repoStats.value = cached
    return
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repoName}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return
    const data = await res.json()
    const stars = Number(data.stargazers_count)
    const forks = Number(data.forks_count)
    if (!Number.isFinite(stars) || !Number.isFinite(forks)) return
    repoStats.value = { stars, forks }
    localStorage.setItem(
      REPO_STATS_KEY,
      JSON.stringify({ repo: repoName, stars, forks, at: Date.now() })
    )
  } catch {
    /* 限速、离线、localStorage 不可写：保持不渲染即可 */
  }
}

const qrSrc = ref(siteConfig.author.wechatQr)
const qrFailed = ref(false)
const avatarSrc = useAvatarSrc()

function onQrError(e) {
  e.target.style.display = 'none'
  qrFailed.value = true
}

onMounted(() => {
  syncAvatarFromStorage()
  loadRepoStats()
})
</script>

<style scoped>
/* ── Card shell — dark gradient glass ──────────────────────────── */
.lk-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 10px 18px 20px;
  box-sizing: border-box;
  background: linear-gradient(
    160deg,
    rgba(12, 18, 52, 0.82) 0%,
    rgba(48, 18, 72, 0.8) 100%
  );
  backdrop-filter: blur(22px) saturate(1.6);
  -webkit-backdrop-filter: blur(22px) saturate(1.6);
  border: 1px solid rgba(180, 140, 255, 0.28);
  border-radius: 24px;
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
  color: white;
}

.lk-card:not(.lk-card--embedded):not(.lk-card--mini) {
  max-width: 260px;
  min-height: 420px;
}

@media (min-width: 1440px) {
  .lk-card:not(.lk-card--embedded):not(.lk-card--mini) {
    min-height: 460px;
    padding-top: 6px;
  }
}

.lk-card--embedded {
  min-height: 0;
  max-width: 100%;
  width: 100%;
  padding: 12px 8px 14px 12px; /* 左12px，右8px，上12px，下14px */
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(248, 250, 252, 0.78) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  color: #0f172a;
}

/* Dark mode: embedded card (homepage sidebar) should match overall theme. */
[data-theme='dark'] .lk-card--embedded {
  box-shadow: 0 2px 18px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  background: rgba(15, 23, 42, 0.62) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  color: rgba(226, 232, 240, 0.98) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__dock {
  background: rgba(2, 6, 23, 0.25) !important;
  border-color: rgba(148, 163, 184, 0.2) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__name {
  color: rgba(199, 210, 254, 0.98) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__sub {
  color: rgba(148, 163, 184, 0.98) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__tag {
  color: rgba(196, 181, 253, 0.98) !important;
  background: rgba(99, 102, 241, 0.16) !important;
  border-color: rgba(99, 102, 241, 0.35) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__dock-btn {
  color: rgba(199, 210, 254, 0.95) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__dock-btn:hover {
  color: rgba(255, 255, 255, 0.98) !important;
  background: rgba(99, 102, 241, 0.22) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__dock-sep {
  background: rgba(148, 163, 184, 0.35) !important;
}

[data-theme='dark'] .lk-card--embedded .lk-card__divider {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(148, 163, 184, 0.3),
    transparent
  ) !important;
}

.lk-card--embedded .lk-card__avatar-wrap {
  margin-bottom: 10px;
}

.lk-card--embedded .lk-card__sub {
  margin-bottom: 8px;
}

.lk-card--embedded .lk-card__tags {
  margin-bottom: 10px;
}

.lk-card--embedded .lk-card__divider {
  margin-bottom: 10px;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.45), transparent);
}

.lk-card--embedded .lk-card__avatar-wrap {
  width: 82px;
  height: 82px;
}

.lk-card--embedded .lk-card__dock {
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 4px;
  max-width: 100%;
  background: rgba(255, 255, 255, 0.45);
  border-color: rgba(148, 163, 184, 0.35);
}

.lk-card--embedded .lk-card__name {
  background: none;
  -webkit-text-fill-color: unset;
  color: #312e81;
  filter: none;
}

.lk-card--embedded .lk-card__sub {
  color: #4b5563;
}

.lk-card--embedded .lk-card__tag {
  color: #4338ca;
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.28);
}

.lk-card--embedded .lk-card__dock-btn {
  color: #4338ca;
}

.lk-card--embedded .lk-card__dock-btn:hover {
  color: #1e1b4b;
  background: rgba(99, 102, 241, 0.15);
}

.lk-card--embedded .lk-card__dock-sep {
  background: rgba(148, 163, 184, 0.45);
}

.lk-card--embedded .lk-card__divider {
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.45), transparent);
}

/* ── Avatar — circle + clockwise spin on hover（头像 crop 偏上显眼部）── */
.lk-card__avatar-wrap {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, #7dd3fc, #a78bfa, #f472b6);
  margin-top: 0;
  margin-bottom: 14px;
  box-shadow: 0 4px 20px rgba(167, 139, 250, 0.45);
  cursor: pointer;
  transition: transform 0.85s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

@media (min-width: 1440px) {
  .lk-card__avatar-wrap {
    margin-top: 2px;
  }
}

.lk-card__avatar-wrap:hover {
  transform: rotate(360deg);               /* clockwise; CSS reverses on mouse-leave */
}

.lk-card__avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 22%;
  display: block;
}

/* ── Name — gradient text ──────────────────────────────────────── */
.lk-card__name {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  margin-bottom: 4px;
  background: linear-gradient(90deg, #60a5fa, #8b5cf6, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 1px 6px rgba(0, 0, 0, 0.5));
}

.lk-card__sub {
  font-size: 0.85rem;
  color: #4b5563;
  margin-bottom: 12px;
}

/* ── Tags ──────────────────────────────────────────────────────── */
.lk-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
  margin-bottom: 14px;
}

.lk-card__tag {
  font-size: 0.68rem;
  font-weight: 500;
  color: #c4b5fd;
  background: rgba(167, 139, 250, 0.18);
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 100px;
  padding: 2px 9px;
}

/* ── Divider ───────────────────────────────────────────────────── */
.lk-card__divider {
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(180, 140, 255, 0.4), transparent);
  margin-bottom: 14px;
}

/* ── Dock ──────────────────────────────────────────────────────── */
.lk-card__dock {
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(180, 140, 255, 0.22);
  border-radius: 100px;
  padding: 7px 12px;
}

.lk-card__dock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: rgba(200, 210, 255, 0.85);
  transition: color 0.18s, background 0.18s;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.lk-card__dock-btn:hover {
  color: #fff;
  background: rgba(167, 139, 250, 0.28);
}

.lk-card__dock-btn svg {
  width: 17px;
  height: 17px;
}

.lk-card__dock-sep {
  display: inline-block;
  width: 1px;
  height: 18px;
  background: rgba(180, 140, 255, 0.35);
  margin: 0 3px;
}

/* ── WeChat popup ──────────────────────────────────────────────── */
.lk-card__wechat-wrap {
  position: relative;
  display: flex;
}

.lk-card__wechat-popup {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  width: 158px;
  padding: 12px 12px 8px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  transform: translateX(-50%) translateY(6px);
  z-index: 100;
}

.lk-card__wechat-wrap:hover .lk-card__wechat-popup {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.lk-card__wechat-qr {
  width: 134px;
  height: 134px;
  object-fit: contain;
  border-radius: 8px;
  display: block;
}

/* placeholder shown when QR image fails to load */
.lk-card__wechat-qr-ph {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 134px;
  height: 134px;
  background: #f3f4f6;
  border-radius: 8px;
  color: #9ca3af;
  font-size: 0.7rem;
  gap: 6px;
  text-align: center;
}

.lk-card__wechat-qr-ph svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

.lk-card__wechat-label {
  font-size: 0.72rem;
  color: #4b5563;
  margin: 0;
}


/* 毛玻璃底部区域 */
.lk-card__footer {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(2);
  -webkit-backdrop-filter: blur(24px) saturate(2);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.lk-card__footer-text {
  font-size: 0.75rem;
  color: #4b5563;
  font-weight: 500;
}

/* 暗色主题适配 */
[data-theme='dark'] .lk-card__footer {
  background: rgba(15, 23, 42, 0.75) !important;
  border: 1px solid rgba(148, 163, 184, 0.3) !important;
}

[data-theme='dark'] .lk-card__footer-text {
  color: rgba(226, 232, 240, 0.9) !important;
}

/* ── GitHub hover popover ─────────────────────────────────────────────── */
.lk-card__gh-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.lk-card__gh-popup {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  z-index: 200;
  min-width: 200px;
  padding: 0.85rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.10);
  box-shadow:
    0 16px 40px rgba(15, 23, 42, 0.16),
    0 2px 8px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}

.lk-card__gh-wrap:hover .lk-card__gh-popup {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.lk-card__gh-avatar-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.lk-card__gh-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(33, 37, 41, 0.12);
  object-fit: cover;
}

.lk-card__gh-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.lk-card__gh-handle {
  font-size: 0.75rem;
  color: #64748b;
  font-family: var(--lk-font-mono, monospace);
}

.lk-card__gh-bio {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #334155;
}

.lk-card__gh-cta {
  display: inline-block;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: #0f172a;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  text-align: center;
  transition: background 0.18s ease-out;
}

.lk-card__gh-cta:hover {
  background: #343A40;
  color: #ffffff;
  text-decoration: none;
}

[data-theme='dark'] .lk-card__gh-popup {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(222, 226, 230, 0.14);
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

[data-theme='dark'] .lk-card__gh-name {
  color: #f8fafc;
}

[data-theme='dark'] .lk-card__gh-handle {
  color: #94a3b8;
}

[data-theme='dark'] .lk-card__gh-bio {
  color: #cbd5e1;
}

[data-theme='dark'] .lk-card__gh-cta {
  background: #f8fafc;
  color: #0f172a;
}

/* ── 图 1 迷你卡 ───────────────────────────────────────────── */
.lk-card--mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 220px;
  min-height: 0;
  margin: 0 auto;
  padding: 1rem 1.1rem 1.1rem;
  box-sizing: border-box;
  border-radius: 1.1rem;
  background: linear-gradient(180deg, #e3f0fb 0%, #dbeafe 100%);
  border: 1px solid rgba(125, 211, 252, 0.65);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.lk-card--mini-embedded {
  max-width: 100%;
}

.lk-card--mini__avatar {
  width: 108px;
  height: 108px;
  border-radius: 1.05rem;
  padding: 0;
  border: 2px solid rgba(125, 211, 252, 0.95);
  background: linear-gradient(145deg, #e2e8f0, #cbd5e1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.lk-card--mini__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 24%;
  display: block;
}

.lk-card--mini__name {
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #0b1222;
  margin-bottom: 0.85rem;
  text-align: center;
  line-height: 1.35;
}

.lk-card--mini__dock {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.lk-card--mini__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: #ffffff;
  color: #334155;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.1);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.lk-card--mini__btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18);
}

/* 三个圆钮配品牌色（和 hover 反白） */
.lk-card--mini__btn--email {
  background: #fb7185; /* 柔和的玫瑰红，比纯 Gmail 红温和很多 */
  color: #ffffff;
}
.lk-card--mini__btn--email:hover {
  background: #f43f5e;
  color: #ffffff;
}

.lk-card--mini__btn--github {
  background: #181717;
  color: #ffffff;
}
.lk-card--mini__btn--github:hover {
  background: #0f0f0f;
  color: #ffffff;
}

.lk-card--mini__btn--wechat {
  background: #07c160; /* 微信绿 */
  color: #ffffff;
}
.lk-card--mini__btn--wechat:hover {
  background: #069d50;
  color: #ffffff;
}

/* 胶囊上方的一行小字：可换行，长句放这里，胶囊本身保持一行 */
.lk-card--mini__star-hint {
  margin: 0.7rem 0 0;
  font-size: 0.68rem;
  line-height: 1.35;
  text-align: center;
  color: rgba(15, 23, 42, 0.62);
}

/* 颜文字：不含汉字，翻译扫描跳过它，中英文一律原样 */
.lk-card--mini__star-kaomoji {
  margin-left: 0.22em;
  white-space: nowrap;
  color: #d97706;
}

[data-theme='dark'] .lk-card--mini__star-kaomoji {
  color: #fbbf24;
}

.lk-card--mini__star-hint + .lk-card--mini__star {
  margin-top: 0.34rem;
}

/* 底部 Star CTA：整行胶囊，和三枚圆钮同一视觉体系 */
.lk-card--mini__star {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.32rem;
  width: 100%;
  margin-top: 0.7rem;
  padding: 0.4rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2;
  /* 文案和计数必须同一行：卡片 220px，不加这条中文文案会在 "给本站点个 / Star" 处断行 */
  white-space: nowrap;
  text-decoration: none;
  color: #7c4a03;
  background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid rgba(217, 119, 6, 0.35);
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.08);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

/*
 * 主题的 `[vp-content] a:not(.header-anchor):hover` 会给正文里所有 a 加下划线，
 * 它和「类 + scoped 属性 + :hover」同为 (0,3,0)，后加载的它赢。
 * 按仓库约定不用 !important，改成多带一层父类把特异度抬到 (0,4,0)。
 */
.lk-card--mini .lk-card--mini__star:hover,
.lk-card--mini .lk-card--mini__star:focus,
.lk-card--mini .lk-card--mini__star:focus-visible,
.lk-card--mini .lk-card--mini__star:active {
  text-decoration: none;
}

.lk-card--mini__star:hover {
  transform: translateY(-1px);
  background: linear-gradient(180deg, #fde68a 0%, #fcd34d 100%);
  box-shadow: 0 3px 10px rgba(180, 83, 9, 0.25);
}

.lk-card--mini__star svg {
  flex: none;
}

/* star / fork 计数：和文案同一行，用一道竖线隔开；拿不到数字时整段不渲染 */
.lk-card--mini__star-stats {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: 0.1rem;
  padding-left: 0.38rem;
  /* 比文案小一号：卡片只有 220px，中文文案 + 四位数计数要留得下 */
  font-size: 0.72rem;
  border-left: 1px solid rgba(217, 119, 6, 0.35);
  font-variant-numeric: tabular-nums;
}

.lk-card--mini__star-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  opacity: 0.85;
}

/* Hope 主题外链 ↗ 箭头：这里也一律隐藏 */
.lk-card--mini__star::after,
.lk-card--mini__star .external-link-icon {
  display: none !important;
  content: none !important;
}

/* Hope 主题给外链 a 加的 ↗ 小箭头：mini 圆钮里一律隐藏 */
.lk-card--mini__btn::after,
.lk-card--mini__btn::before,
.lk-card--mini__btn .external-link-icon,
.lk-card--mini__btn > .icon {
  display: none !important;
  content: none !important;
}

.lk-card--mini__wechat-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lk-card--mini__wechat-pop {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  width: 168px;
  height: 168px;
  padding: 8px;
  box-sizing: content-box;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 200;
  display: block;
}

.lk-card--mini__wechat-wrap:hover .lk-card--mini__wechat-pop,
.lk-card--mini__wechat-wrap:focus-within .lk-card--mini__wechat-pop {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.lk-card--mini__wechat-qr {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  background: #fff;
  border-radius: 6px;
}

[data-theme='dark'] .lk-card--mini {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.92) 100%);
  border-color: rgba(125, 211, 252, 0.35);
  color: #e2e8f0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
}

[data-theme='dark'] .lk-card--mini__name {
  color: #f1f5f9;
}

[data-theme='dark'] .lk-card--mini__btn {
  background: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
}

[data-theme='dark'] .lk-card--mini__star {
  color: #fde68a;
  background: linear-gradient(180deg, rgba(120, 53, 15, 0.55) 0%, rgba(69, 26, 3, 0.6) 100%);
  border-color: rgba(251, 191, 36, 0.35);
}

[data-theme='dark'] .lk-card--mini__star-hint {
  color: rgba(226, 232, 240, 0.7);
}

[data-theme='dark'] .lk-card--mini__star-stats {
  border-left-color: rgba(251, 191, 36, 0.35);
}

[data-theme='dark'] .lk-card--mini__star:hover {
  background: linear-gradient(180deg, rgba(146, 64, 14, 0.7) 0%, rgba(120, 53, 15, 0.7) 100%);
}
</style>
