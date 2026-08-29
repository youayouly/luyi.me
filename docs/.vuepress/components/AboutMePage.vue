<script setup>
import NoticeCard from './NoticeCard.vue'
import SiteStatsCard from './SiteStatsCard.vue'
import VisitedChinaFootprints from './VisitedChinaFootprints.vue'
import { siteConfig } from '../site.config.js'

const author = siteConfig.author

const wechatQrSrc = author.wechatQr
const wechatId = author.wechatId

function openWechatPopup() {
  if (typeof window === 'undefined') return
  const w = 360
  const h = 460
  const left = Math.max(0, Math.floor((window.screen.availWidth - w) / 2))
  const top = Math.max(0, Math.floor((window.screen.availHeight - h) / 2))
  const popup = window.open(
    '',
    'lk-wechat-qr',
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`,
  )
  if (!popup) return
  popup.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${author.name} 的微信</title>
    <style>
      html,body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;height:100%;}
      .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;gap:12px;}
      .qr{width:280px;height:280px;background:#fff;padding:10px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);}
      .qr img{display:block;width:100%;height:100%;object-fit:contain;}
      .id{font-size:14px;letter-spacing:.04em;color:#bbf7d0;}
      .id code{background:rgba(34,197,94,.18);padding:2px 8px;border-radius:6px;color:#dcfce7;font-family:ui-monospace,Menlo,Consolas,monospace;}
      .hint{font-size:12px;color:#94a3b8;}
    </style></head><body><div class="wrap">
    <div class="qr"><img src="${wechatQrSrc}" alt="微信二维码"></div>
    <div class="id">微信号：<code>${wechatId}</code></div>
    <div class="hint">扫码或复制添加 · 关闭窗口可返回站点</div>
    </div></body></html>`)
  popup.document.close()
  popup.focus?.()
}
</script>

<template>
  <div class="lk-aboutme">
    <div class="lk-aboutme__shell">
      <aside class="lk-aboutme__side" aria-label="侧栏：公告与网站信息">
        <NoticeCard embedded class="lk-aboutme__card lk-aboutme__card--notice" />
        <SiteStatsCard
          variant="sidebar"
          embedded
          class="lk-aboutme__card lk-aboutme__card--stats"
        />
      </aside>

      <main class="lk-aboutme__main" aria-label="关于我正文">
        <article class="lk-aboutme__panel">
          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">简介</h2>
            <ul class="lk-aboutme__bullets">
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">👋</span>
                <span class="lk-aboutme__text">我是 <strong>{{ author.name }}</strong></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🎓</span>
                <span class="lk-aboutme__text">本科是 <strong>计算机科学</strong></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🛠</span>
                <span class="lk-aboutme__text">兴趣方向：嵌入式开发、前端体验、AI 工具与产品规划</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📦</span>
                <span class="lk-aboutme__text">喜欢把复杂信息整理成更清晰的结构，做项目偏好「能用 + 好看 + 自洽」</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">💬</span>
                <span class="lk-aboutme__text">欢迎联系我，不论是聊产品、技术、留学规划，还是新加坡生活都可以。</span>
              </li>
            </ul>
          </section>

          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">正在做与正在学</h2>
            <ul class="lk-aboutme__bullets">
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">⚡</span>
                <span class="lk-aboutme__text">嵌入式 / STM32 / RTOS / 总线与协议</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🖥</span>
                <span class="lk-aboutme__text">前端 / Vue 3 / VuePress 2 / Hope 主题与 SCSS 工程化</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🤖</span>
                <span class="lk-aboutme__text">AI 工具链 / 模型 Key 路由 / Claude Code 实践</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📐</span>
                <span class="lk-aboutme__text">产品 PRD 与作品集整理（详见 <a href="/article/pm-portfolio-prd.html">PM Portfolio PRD</a>）</span>
              </li>
            </ul>
          </section>

          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">最近写过的</h2>
            <ul class="lk-aboutme__bullets">
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📝</span>
                <span class="lk-aboutme__text"><a href="/article/pm-projects-pagination-galaxy.html">Projects 作品集分页：把岗位、项目和文章串成招聘入口</a></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📝</span>
                <span class="lk-aboutme__text"><a href="/article/ai-key-router-one-api-zcode-ccswitch.html">AI Key 路由：SiliconFlow / DeepSeek / Qwen / One API / ZCode / CCSwitch</a></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📝</span>
                <span class="lk-aboutme__text"><a href="/article/git-release-map.html">Git 发布流水线：从本地改动到 Vercel Release</a></span>
              </li>
            </ul>
          </section>

          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">联系方式</h2>
            <ul class="lk-aboutme__bullets lk-aboutme__bullets--contacts">
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">✉️</span>
                <span class="lk-aboutme__text">E-mail：<a :href="`mailto:${author.email}`">{{ author.email }}</a></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🐙</span>
                <span class="lk-aboutme__text">GitHub：<a
                  :href="`https://github.com/${author.github}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >{{ author.github }}</a></span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">💬</span>
                <span class="lk-aboutme__text">
                  微信：<span class="lk-aboutme__wechat-tip" tabindex="0">
                    <button
                      type="button"
                      class="lk-aboutme__wechat-trigger"
                      aria-label="点击在新窗口查看微信二维码"
                      @click="openWechatPopup"
                    >
                      <code>{{ wechatId }}</code>
                    </button>
                    <span class="lk-aboutme__wechat-pop" aria-hidden="true">
                      <img :src="wechatQrSrc" :alt="`${author.name} 的微信二维码`" />
                      <span class="lk-aboutme__wechat-pop-tip">悬停查看 / 点击在新窗口放大</span>
                    </span>
                  </span>
                </span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">📍</span>
                <span class="lk-aboutme__text">地点：长期新加坡 / 中国内地往返</span>
              </li>
            </ul>
          </section>

          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">本站构建</h2>
            <ul class="lk-aboutme__bullets">
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🌐</span>
                <span class="lk-aboutme__text">域名：在 <a
                  href="https://www.namesilo.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >NameSilo</a> 注册</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🖼</span>
                <span class="lk-aboutme__text">网站背景：<a
                  href="https://steamcommunity.com/app/431960/workshop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >Steam Workshop · Wallpaper Engine</a> 的「黄昏湖畔（hangmoon gaze）」类作品</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🎨</span>
                <span class="lk-aboutme__text">个人介绍头像：像素卡皮巴拉切纸，来自 <a
                  href="https://www.pixiv.net/artworks/102538289"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >Pixiv 102538289</a>，已把原图鲜黄底调淡作为站点头像</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">🅰</span>
                <span class="lk-aboutme__text">字体：<a
                  href="https://vercel.com/font"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >Geist Variable</a>（Vercel）</span>
              </li>
              <li>
                <span class="lk-aboutme__icon" aria-hidden="true">⌨️</span>
                <span class="lk-aboutme__text">代码块字体：<a
                  href="https://github.com/subframe7536/maple-font"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="no-external-link-icon"
                >Maple Mono</a>（subframe7536 / OFL）</span>
              </li>
            </ul>
          </section>
        </article>

        <div class="lk-aboutme__globe-panel">
          <section class="lk-aboutme__section">
            <h2 class="lk-aboutme__h2">去过的地方</h2>
            <VisitedChinaFootprints />
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── 微信号 hover/focus 弹出二维码 ────────────────────────────────────── */
.lk-aboutme__wechat-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  outline: none;
}

.lk-aboutme__wechat-trigger {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  line-height: inherit;
}

.lk-aboutme__wechat-trigger code {
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.lk-aboutme__wechat-tip:hover .lk-aboutme__wechat-trigger code,
.lk-aboutme__wechat-tip:focus-within .lk-aboutme__wechat-trigger code {
  background: rgba(7, 193, 96, 0.18);
  color: #166534;
}

.lk-aboutme__wechat-pop {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  width: 200px;
  padding: 12px 12px 9px;
  background: #ffffff;
  color: #0f172a;
  border-radius: 14px;
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 200;
}

.lk-aboutme__wechat-tip:hover .lk-aboutme__wechat-pop,
.lk-aboutme__wechat-tip:focus-within .lk-aboutme__wechat-pop {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.lk-aboutme__wechat-pop img {
  display: block;
  width: 176px;
  height: 176px;
  object-fit: contain;
  background: #ffffff;
  border: 1px solid rgba(7, 193, 96, 0.28);
  border-radius: 8px;
}

.lk-aboutme__wechat-pop-tip {
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(15, 23, 42, 0.6);
  text-align: center;
}

[data-theme='dark'] .lk-aboutme__wechat-pop {
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .lk-aboutme__wechat-pop img {
  background: #ffffff;
  border-color: rgba(7, 193, 96, 0.45);
}

[data-theme='dark'] .lk-aboutme__wechat-pop-tip {
  color: rgba(226, 232, 240, 0.6);
}
</style>
