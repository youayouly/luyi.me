<template>
  <div class="lk-gb-page">
    <!-- 统计条 -->
    <section v-if="items.length" class="lk-gb__stats">
      <span class="lk-gb__stats-item">
        💬 <strong data-lk-no-translate>{{ items.length }}</strong> 条留言
      </span>
      <span class="lk-gb__stats-sep" aria-hidden="true">·</span>
      <span class="lk-gb__stats-item">
        最新一条 <span data-lk-no-translate>{{ latestRelative }}</span>
      </span>
    </section>

    <div class="lk-gb">
    <!-- 右栏：发送留言 -->
    <aside class="lk-gb-rail">
    <!-- 发送留言 -->
    <section class="lk-gb__composer">
      <h2 class="lk-gb__title">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path
            d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
          />
        </svg>
        <span>{{ replyTo ? '回复留言' : '发送留言' }}</span>
      </h2>

      <p v-if="replyTo" class="lk-gb__replying">
        正在回复 <strong data-lk-no-translate>{{ replyTo.nick }}</strong>
        <button class="lk-gb__link-btn" type="button" @click="replyTo = null">取消</button>
      </p>

      <div class="lk-gb__compose">
        <span class="lk-gb__me" :title="form.contact || ''">
          <img v-if="myAvatar" :src="myAvatar" alt="" />
          <span v-else data-lk-no-translate>{{ form.nick ? initial(form.nick) : '?' }}</span>
        </span>

        <div class="lk-gb__editor">
          <textarea
            v-model="form.content"
            class="lk-gb__textarea"
            rows="11"
            :maxlength="MAX_CHARS"
            :placeholder="ph.content"
            @keydown.ctrl.enter="submit"
            @keydown.meta.enter="submit"
          />
          <span class="lk-gb__count-chars" :class="{ 'lk-gb__count-chars--near': form.content.length > MAX_CHARS * 0.9 }" data-lk-no-translate>
            {{ form.content.length }}/{{ MAX_CHARS }}
          </span>
        </div>
      </div>

      <div v-if="previewHtml" class="lk-gb__preview">
        <span class="lk-gb__preview-tag">预览</span>
        <div class="lk-gb__content" data-lk-no-translate v-html="previewHtml" />
      </div>

      <div class="lk-gb__fields">
        <label class="lk-gb__field">
          <span class="lk-gb__field-icon" aria-hidden="true">◍</span>
          <input v-model="form.nick" type="text" maxlength="24" :placeholder="ph.nick" />
        </label>
        <label class="lk-gb__field">
          <span class="lk-gb__field-icon" aria-hidden="true">✉</span>
          <input
            v-model="form.contact"
            type="text"
            maxlength="64"
            :placeholder="ph.contact"
            @blur="refreshMyAvatar"
          />
        </label>
        <label class="lk-gb__field">
          <span class="lk-gb__field-icon" aria-hidden="true">🔗</span>
          <input v-model="form.site" type="url" maxlength="200" :placeholder="ph.site" />
        </label>
      </div>

      <!-- 验证码是可选的：不验照样能发，验了拿一个「已验证」小标 -->
      <div v-if="mailReady && form.contact" class="lk-gb__verify">
        <button class="lk-gb__verify-btn" type="button" :disabled="codeSending" @click="sendCode">
          {{ codeSent ? '重新发送' : '发送验证码' }}
        </button>
        <label v-if="codeSent" class="lk-gb__field lk-gb__field--code">
          <span class="lk-gb__field-icon" aria-hidden="true">🔑</span>
          <input v-model="form.code" type="text" inputmode="numeric" maxlength="6" :placeholder="ph.code" />
        </label>
        <span class="lk-gb__verify-hint">选填。验过的留言会带一个「已验证」标。</span>
      </div>

      <!--
        蜜罐：真人看不见也点不到，脚本会老老实实填。服务端见到非空就假装成功。
        用 CSS 藏而不是 type=hidden —— 后者对自动填表脚本反而是显眼的跳过信号。
      -->
      <div class="lk-gb__trap" aria-hidden="true">
        <label>网址<input v-model="form.website" type="text" tabindex="-1" autocomplete="off" /></label>
      </div>

      <div class="lk-gb__options">
        <label class="lk-gb__check">
          <input v-model="form.private" type="checkbox" />
          <span>悄悄话</span>
        </label>
        <label class="lk-gb__check">
          <input v-model="form.notify" type="checkbox" />
          <span>回复邮件提醒</span>
        </label>

        <div class="lk-gb__spacer" />

        <div class="lk-gb__kaomoji">
          <button
            v-for="face in KAOMOJI"
            :key="face"
            class="lk-gb__kaomoji-btn"
            type="button"
            :title="`插入 ${face}`"
            @click="insertFace(face)"
          >
            {{ face }}
          </button>
        </div>

        <button class="lk-gb__preview-btn" type="button" @click="togglePreview">
          {{ previewHtml ? '收起预览' : '预览' }}
        </button>

        <button class="lk-gb__send" type="button" :disabled="submitting" @click="submit">
          <span v-if="submitting">发送中…</span>
          <span v-else>发送</span>
        </button>
      </div>

      <p v-if="notice" class="lk-gb__notice" :class="{ 'lk-gb__notice--bad': noticeBad }">
        {{ notice }}<span v-if="!noticeBad" aria-hidden="true"> (๑˃ᴗ˂)✧</span>
      </p>
      <p class="lk-gb__hint">
        支持 <code>**粗体**</code>、<code>`代码`</code>、<code>&gt; 引用</code> 和链接。悄悄话只有站长看得见。
      </p>
    </section>
    </aside>

    <!-- 左栏：友链墙 + 申请友链 + 留言列表 -->
    <div class="lk-gb-main">
    <!-- 友链墙：数据来自 data/friendLinks.js，和关于页侧栏那张卡共用一份 -->
    <section class="lk-gb-friends">
      <header class="lk-gb-friends__head">
        <h2 class="lk-gb-friends__title">🔗 友链</h2>
        <span v-if="friends.length" class="lk-gb__count" data-lk-no-translate>{{ friends.length }}</span>
        <button class="lk-gb-friends__apply" type="button" @click="fillFriendTemplate">申请友链</button>
      </header>

      <p v-if="!friends.length" class="lk-gb-friends__empty">
        还没有友链，欢迎来申请 —— 下面写了怎么申请。
      </p>

      <ul v-else class="lk-gb-friends__grid">
        <li v-for="friend in friends" :key="friend.id">
          <a
            class="lk-gb-friends__card no-external-link-icon"
            :href="friend.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="lk-gb-friends__avatar" aria-hidden="true">
              <img v-if="friend.avatar" :src="friend.avatar" :alt="friend.name" loading="lazy" />
              <span v-else data-lk-no-translate>{{ initial(friend.name) }}</span>
            </span>
            <span class="lk-gb-friends__meta">
              <span class="lk-gb-friends__name" data-lk-no-translate>{{ friend.name }}</span>
              <span v-if="friend.desc" class="lk-gb-friends__desc" data-lk-no-translate>{{ friend.desc }}</span>
            </span>
          </a>
        </li>
      </ul>
    </section>

    <!-- 申请友链 -->
    <section class="lk-gb-apply">
      <h2 class="lk-gb-apply__title">🤝 申请友链</h2>
      <p class="lk-gb-apply__text">
        不用先加我，直接在上面留一条言就行。我加上你之后会在你那条留言下回复，你再把本站加上，互链完成。
      </p>

      <div class="lk-gb-apply__self">
        <p class="lk-gb-apply__self-title">加本站用这份信息</p>
        <dl data-lk-no-translate>
          <div><dt>名称</dt><dd>Luke 的空间</dd></div>
          <div><dt>网址</dt><dd>https://www.luyi.me</dd></div>
          <div><dt>简介</dt><dd>产品、技术、留学与生活</dd></div>
          <div><dt>头像</dt><dd>https://www.luyi.me{{ siteAvatar }}</dd></div>
        </dl>
      </div>

    </section>

    <!-- 留言列表 -->
    <section class="lk-gb__list">
      <header v-if="threads.length" class="lk-gb__list-head">
        <span>全部留言</span>
        <span class="lk-gb__count" data-lk-no-translate>{{ items.length }}</span>
      </header>
      <p v-if="loading" class="lk-gb__state">正在读取留言…</p>
      <p v-else-if="loadError" class="lk-gb__state lk-gb__state--bad">{{ loadError }}</p>

      <article v-for="thread in threads" :key="thread.id" class="lk-gb__thread">
        <div class="lk-gb__item">
          <span class="lk-gb__avatar" :class="{ 'lk-gb__avatar--owner': thread.owner }">
            <img
              v-if="avatarOf(thread) && !failedAvatars.has(thread.id)"
              :src="avatarOf(thread)"
              alt=""
              loading="lazy"
              @error="failedAvatars.add(thread.id)"
            />
            <span v-else data-lk-no-translate>{{ initial(thread.nick) }}</span>
          </span>

          <div class="lk-gb__body">
            <header class="lk-gb__meta">
              <component
                :is="thread.site ? 'a' : 'span'"
                class="lk-gb__nick no-external-link-icon"
                :href="thread.site || undefined"
                :target="thread.site ? '_blank' : undefined"
                :rel="thread.site ? 'nofollow noopener noreferrer' : undefined"
                data-lk-no-translate
                >{{ thread.nick }}</component
              >
              <span v-if="thread.owner" class="lk-gb__badge">站长</span>
              <span v-if="thread.verified" class="lk-gb__badge lk-gb__badge--ok">已验证</span>
              <span v-if="thread.private" class="lk-gb__badge lk-gb__badge--quiet">悄悄话</span>
              <span v-if="placeOf(thread)" class="lk-gb__place" data-lk-no-translate>{{ placeOf(thread) }}</span>
              <span class="lk-gb__date" :title="thread.at">{{ formatDate(thread.at) }}</span>
            </header>

            <div v-if="thread.redacted" class="lk-gb__redacted">这是一条悄悄话，只有站长看得到。</div>
            <div v-else class="lk-gb__content" data-lk-no-translate v-html="thread.html" />

            <footer class="lk-gb__actions">
              <span class="lk-gb__reacts">
                <button
                  v-for="emoji in REACTIONS"
                  :key="emoji"
                  class="lk-gb__react"
                  :class="{ 'lk-gb__react--on': hasReacted(thread.id, emoji) }"
                  type="button"
                  @click="react(thread, emoji)"
                >
                  <span aria-hidden="true">{{ emoji }}</span>
                  <span v-if="thread.reactions && thread.reactions[emoji]" data-lk-no-translate>{{ thread.reactions[emoji] }}</span>
                </button>
              </span>
              <button class="lk-gb__link-btn" type="button" @click="startReply(thread)">回复</button>
              <button
                v-if="isLoggedIn"
                class="lk-gb__link-btn lk-gb__link-btn--danger"
                type="button"
                @click="remove(thread)"
              >
                删除
              </button>
              <span v-if="isLoggedIn && thread.contact" class="lk-gb__admin-note" data-lk-no-translate>
                {{ thread.contact }} · {{ thread.device }}
              </span>
            </footer>
          </div>
        </div>

        <div v-for="reply in thread.replies" :key="reply.id" class="lk-gb__item lk-gb__item--reply">
          <span class="lk-gb__avatar" :class="{ 'lk-gb__avatar--owner': reply.owner }">
            <img
              v-if="avatarOf(reply) && !failedAvatars.has(reply.id)"
              :src="avatarOf(reply)"
              alt=""
              loading="lazy"
              @error="failedAvatars.add(reply.id)"
            />
            <span v-else data-lk-no-translate>{{ initial(reply.nick) }}</span>
          </span>
          <div class="lk-gb__body">
            <header class="lk-gb__meta">
              <component
                :is="reply.site ? 'a' : 'span'"
                class="lk-gb__nick no-external-link-icon"
                :href="reply.site || undefined"
                :target="reply.site ? '_blank' : undefined"
                :rel="reply.site ? 'nofollow noopener noreferrer' : undefined"
                data-lk-no-translate
                >{{ reply.nick }}</component
              >
              <span v-if="reply.owner" class="lk-gb__badge">站长</span>
              <span v-if="reply.verified" class="lk-gb__badge lk-gb__badge--ok">已验证</span>
              <span v-if="placeOf(reply)" class="lk-gb__place" data-lk-no-translate>{{ placeOf(reply) }}</span>
              <span class="lk-gb__date" :title="reply.at">{{ formatDate(reply.at) }}</span>
            </header>
            <div v-if="reply.redacted" class="lk-gb__redacted">这是一条悄悄话，只有站长看得到。</div>
            <div v-else class="lk-gb__content" data-lk-no-translate v-html="reply.html" />
            <footer class="lk-gb__actions">
              <span class="lk-gb__reacts">
                <button
                  v-for="emoji in REACTIONS"
                  :key="emoji"
                  class="lk-gb__react"
                  :class="{ 'lk-gb__react--on': hasReacted(reply.id, emoji) }"
                  type="button"
                  @click="react(reply, emoji)"
                >
                  <span aria-hidden="true">{{ emoji }}</span>
                  <span v-if="reply.reactions && reply.reactions[emoji]" data-lk-no-translate>{{ reply.reactions[emoji] }}</span>
                </button>
              </span>
              <button class="lk-gb__link-btn" type="button" @click="startReply(thread)">回复</button>
              <button
                v-if="isLoggedIn"
                class="lk-gb__link-btn lk-gb__link-btn--danger"
                type="button"
                @click="remove(reply)"
              >
                删除
              </button>
            </footer>
          </div>
        </div>
      </article>
    </section>
    </div>
    </div>

  </div>
</template>

<script setup>
/**
 * 留言板。数据全部走 `/api/guestbook`（见那个文件的头注释）。
 *
 * 两件必须记住的事：
 *
 * 1. **`v-html` 渲染的 HTML 来自服务端的 `lib/lk-markdown.js`**，那里是先整段
 *    转义再加标签，所以这里直接渲染是安全的。绝对不要改成在前端解析 Markdown ——
 *    那样等于把唯一那道防线搬到访客能碰到的地方。
 * 2. **访客写的内容不能进翻译**：昵称和正文都挂 `data-lk-no-translate`。
 *    留言是运行时内容，永远进不了构建期词典，交给运行时接口翻译既慢又无意义。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useIsLoggedIn } from '../utils/authGate.js'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'
import { readSiteApiCreds } from '../utils/siteApiCreds.js'
import { formatRelativeTime } from '../utils/relativeTimeZh.js'
import { guestbookDraft } from '../utils/guestbookDraft.js'
import { friendLinks } from '../data/friendLinks.js'
import { formatPlace } from '../data/placeNames.js'
import { siteConfig } from '../site.config.js'

const API = '/api/guestbook'
/** 和服务端 REACTIONS 白名单一一对应，改一边要改两边 */
const REACTIONS = ['👍', '🎉', '🤝', '😂']
/** 点过的表情记在本地，只为把按钮点亮；真正的一次限制在服务端的 SET NX 上 */
const REACTED_KEY = 'lk_gb_reacted'
/** 正文草稿见 utils/guestbookDraft.js：站内切页面不丢，整页刷新会丢 */
/** 和服务端 MAX_CHARS 对齐；计数器和 maxlength 都读它 */
const MAX_CHARS = 1000

const KAOMOJI = ['(๑˃ᴗ˂)✧', '(੭ˊ꒳ˋ)੭', '(´｡• ᵕ •｡`)', '(๑•̀ㅂ•́)و', '(◍•ᴗ•◍)', 'ヾ(≧▽≦*)o']

const isLoggedIn = useIsLoggedIn()

/**
 * 占位符和 title 是**属性**，而 pageTranslate 只翻文本节点——属性它够不着。
 * 所以这几条不进词典，自带中英两份跟着 pageLang 走。文本节点照旧走词典。
 */
const isEnglish = computed(() => pageLang.value !== SOURCE_LANG)
const ph = computed(() =>
  isEnglish.value
    ? {
        content: 'Your message. Markdown supported',
        nick: 'Nickname',
        contact: 'Email / QQ number (optional, used for your avatar)',
        site: 'Your site (optional)',
        code: '6-digit code',
      }
    : {
        content: '留言内容，支持 Markdown',
        nick: '昵称',
        contact: '邮箱 / QQ 号（选填，用来取头像）',
        site: '你的网站（选填）',
        code: '6 位验证码',
      },
)

const items = ref([])
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const notice = ref('')
const noticeBad = ref(false)
const replyTo = ref(null)
const failedAvatars = reactive(new Set())
const reacted = ref(new Set())

const myAvatar = ref('')
const previewHtml = ref('')
/** 服务端说发信没配好就不露出「发送验证码」——按了也只会得到 503 */
const mailReady = ref(false)
const codeSent = ref(false)
const codeSending = ref(false)

const form = reactive({
  nick: '',
  contact: '',
  site: '',
  code: '',
  content: '',
  private: false,
  notify: false,
  website: '',
})

/** 顶层留言按新→旧，回复按旧→新挂在下面，读起来才像对话。 */
const threads = computed(() => {
  const tops = items.value.filter((item) => !item.parent)
  const byParent = new Map()
  for (const item of items.value) {
    if (!item.parent) continue
    if (!byParent.has(item.parent)) byParent.set(item.parent, [])
    byParent.get(item.parent).push(item)
  }
  return tops.map((top) => ({
    ...top,
    replies: (byParent.get(top.id) || []).slice().reverse(),
  }))
})

/** 统计条用：所有留言（含回复）里最新的一条时间，纯本地算，不必再问服务端。 */
const latestAt = computed(() => {
  let best = ''
  let bestT = -Infinity
  for (const item of items.value) {
    const t = new Date(item.at).getTime()
    if (!Number.isNaN(t) && t > bestT) {
      bestT = t
      best = item.at
    }
  }
  return best
})
const latestRelative = computed(() =>
  latestAt.value ? formatRelativeTime(latestAt.value, isEnglish.value) : '',
)

function say(text, bad = false) {
  notice.value = text
  noticeBad.value = bad
  if (!bad) setTimeout(() => (notice.value = ''), 4000)
}

/** 站长自己回复时不会填邮箱/QQ，用站点头像顶上，别掉到首字母色块。 */
function avatarOf(item) {
  if (item.avatar) return item.avatar
  return item.owner ? siteConfig.avatar : ''
}

/** 「来自 广东」。查不到就返回空串，模板据此不渲染这个标签。 */
/**
 * 头像预览：把联系方式丢给服务端算 URL。
 * 为什么不在前端算——Gravatar 要 md5，为一个预览往 bundle 里塞一份 md5 实现不划算；
 * 而且规则（QQ 号 / QQ 邮箱 / 普通邮箱）只该有一份，就放在 lk-guest.js 那份。
 * 绑在 blur 上而不是每次按键，一次输入只打一个请求。
 */
async function refreshMyAvatar() {
  const contact = form.contact.trim()
  if (!contact) {
    myAvatar.value = ''
    return
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'identity', contact }),
    })
    const data = await res.json()
    myAvatar.value = data.ok ? data.avatar || '' : ''
  } catch {
    myAvatar.value = ''
  }
}

/**
 * 预览走服务端渲染。前端不解析 Markdown——那道「先整段转义、再加标签」的防线
 * 只有一份，放在 lib/lk-markdown.js，不能为了预览再复制一份到浏览器里。
 */
/**
 * 要一封验证码。验证码是可选的：不验也能发言，验了只是多一个「已验证」标，
 * 所以这里失败不拦发送，只提示一句。
 */
async function sendCode() {
  if (codeSending.value) return
  codeSending.value = true
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send-code', contact: form.contact }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '发不出去')
    codeSent.value = true
    say('验证码发出去了，去邮箱看看')
  } catch (err) {
    say(String(err.message || err), true)
  } finally {
    codeSending.value = false
  }
}

async function togglePreview() {
  if (previewHtml.value) {
    previewHtml.value = ''
    return
  }
  if (!form.content.trim()) return say('先写点什么再预览', true)
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'preview', content: form.content }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '预览失败')
    previewHtml.value = data.html
  } catch (err) {
    say(String(err.message || err), true)
  }
}

function placeOf(item) {
  const name = formatPlace(item.place, isEnglish.value ? 'en' : 'zh')
  if (!name) return ''
  return isEnglish.value ? `from ${name}` : `来自 ${name}`
}

function hasReacted(id, emoji) {
  return reacted.value.has(`${id}:${emoji}`)
}

/**
 * 点一个表情。前端先把数字加上去（乐观更新），服务端拒绝再退回来——
 * 这个动作太轻量，等一个往返再变色会显得很迟钝。
 */
async function react(item, emoji) {
  const mark = `${item.id}:${emoji}`
  if (reacted.value.has(mark)) return

  const before = item.reactions ? { ...item.reactions } : {}
  item.reactions = { ...before, [emoji]: (before[emoji] || 0) + 1 }
  reacted.value = new Set([...reacted.value, mark])
  try {
    localStorage.setItem(REACTED_KEY, JSON.stringify([...reacted.value]))
  } catch {
    /* 无痕模式写不了就算了，服务端那把锁才是真的 */
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'react', id: item.id, emoji }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '点不上')
    /* 服务端返回真实计数（可能别人也点了），以它为准 */
    if (Number.isFinite(data.count)) item.reactions = { ...item.reactions, [emoji]: data.count }
  } catch {
    item.reactions = before
  }
}

function initial(nick) {
  return String(nick || '?').trim().slice(0, 1).toUpperCase()
}

function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function insertFace(face) {
  form.content = `${form.content}${face}`
}

const friends = friendLinks
const siteAvatar = siteConfig.avatar


/** 友链申请模板：填进输入框并把焦点移过去，省得访客自己想格式。 */
function fillFriendTemplate() {
  form.content = ['申请友链', '名称：', '网址：', '简介：', '头像：（可选，图片直链）'].join('\n')
  replyTo.value = null
  const box = document.querySelector('.lk-gb__textarea')
  box?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  box?.focus()
}

function startReply(thread) {
  replyTo.value = thread
  document.querySelector('.lk-gb__textarea')?.focus()
}

/** 登录后才带凭据：删除和「站长」身份都靠它。 */
function withCreds(payload) {
  if (!isLoggedIn.value) return payload
  const { user, pass } = readSiteApiCreds()
  if (!user || !pass) return payload
  return { ...payload, authUser: user, authPass: pass }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    /* GET 也要带凭据（走 query 太脏，这里用 header），否则站长看不到悄悄话。 */
    const { user, pass } = isLoggedIn.value ? readSiteApiCreds() : { user: '', pass: '' }
    const headers = user && pass ? { 'x-lk-user': user, 'x-lk-pass': pass } : {}
    const res = await fetch(API, { headers })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '读取失败')
    if (data.configured === false) {
      loadError.value = '留言板还没接上存储，稍后再来看看。'
      items.value = []
      return
    }
    items.value = Array.isArray(data.items) ? data.items : []
    mailReady.value = data.mailReady === true
  } catch (err) {
    loadError.value = `留言读不出来：${String(err.message || err)}`
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (submitting.value) return
  if (!form.nick.trim()) return say('先填个昵称吧', true)
  if (!form.content.trim()) return say('留言不能是空的', true)

  submitting.value = true
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        withCreds({
          nick: form.nick,
          contact: form.contact,
          site: form.site,
          code: form.code,
          content: form.content,
          private: form.private,
          notify: form.notify,
          website: form.website,
          parent: replyTo.value ? replyTo.value.id : '',
        }),
      ),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '发送失败')

    form.content = ''
    form.code = ''
    codeSent.value = false
    previewHtml.value = ''
    clearDraft()
    replyTo.value = null
    say(data.skipped ? '收到啦' : '留言成功，谢谢你')
    await load()
  } catch (err) {
    say(String(err.message || err), true)
  } finally {
    submitting.value = false
  }
}

async function remove(item) {
  if (!isLoggedIn.value) return
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(withCreds({ action: 'delete', id: item.id })),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '删除失败')
    await load()
  } catch (err) {
    say(String(err.message || err), true)
  }
}

function clearDraft() {
  guestbookDraft.value = ''
}

/* 正文每次变动就同步进内存草稿（utils/guestbookDraft.js）。 */
watch(
  () => form.content,
  (text) => {
    guestbookDraft.value = text
  },
)

onMounted(() => {
  try {
    if (guestbookDraft.value) form.content = guestbookDraft.value
    const marks = JSON.parse(localStorage.getItem(REACTED_KEY) || '[]')
    if (Array.isArray(marks)) reacted.value = new Set(marks)
  } catch {
    /* ignore */
  }
  load()
})
</script>

<style scoped>
/*
 * 两栏：左边友链墙 + 申请友链 + 留言列表（主内容），右边只放发送留言，
 * 宽度放大到原先 320~400px 的 1.5 倍（480~600px），输入框更宽敞。
 * DOM 顺序是 rail（发送）在前、main 在后——小屏堆叠时先看到发送框更顺手；
 * 桌面宽度靠 grid order 把视觉顺序换成「main 在左、rail 在右」，
 * 和 /tech、/article 页一样中间两栏分布。
 * 断点提到 1200px：右栏变宽后，更窄的话会把左边挤没。
 */
.lk-gb-page {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  max-width: 1220px;
  margin: 0 auto;
  /* 跟 /about（.lk-aboutme）、/article、/tech 同一条「离导航栏 1.5rem」的规矩，
     那几页都是靠自己根节点的 padding-top 撑开，主题的 [vp-content] 本身没有。 */
  padding-top: 1.5rem;
  /* 两侧留白也是同一件事：把 [vp-content] 的 padding-inline 清零去掉 780px 阅读宽度上限
     之后，两栏在窄于 1220px 的视口下会贴着视口边缘——/article 的 .lk-article-three 是
     靠自己的 padding: 0 1rem 2rem 留白，这里跟它对齐，同一个 1rem。 */
  padding-inline: 1rem;
  box-sizing: border-box;
}

.lk-gb {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.2rem;
  min-width: 0;
}

@media (min-width: 1200px) {
  .lk-gb {
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    align-items: start;
  }

  .lk-gb-rail {
    order: 2;
    position: sticky;
    top: calc(var(--navbar-height, 3.75rem) + 1rem);
  }

  .lk-gb-main {
    order: 1;
  }
}

.lk-gb-rail,
.lk-gb-main {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-width: 0;
}

/* ── 统计条 ─────────────────────────────────────────────── */
.lk-gb__stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;
  max-width: 100%;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--vp-c-text-2, #475569);
  background: rgba(224, 242, 254, 0.55);
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.lk-gb__stats-item {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  white-space: nowrap;
}

.lk-gb__stats-item strong {
  color: #0369a1;
  font-variant-numeric: tabular-nums;
}

.lk-gb__stats-sep {
  color: var(--vp-c-text-3, #94a3b8);
}

[data-theme='dark'] .lk-gb__stats {
  background: rgba(30, 58, 138, 0.28);
  border-color: rgba(56, 189, 248, 0.28);
  color: rgba(226, 232, 240, 0.82);
}

[data-theme='dark'] .lk-gb__stats-item strong {
  color: #7dd3fc;
}

/* ── 发送区 ─────────────────────────────────────────────── */
.lk-gb__composer {
  padding: 1.1rem 1.2rem 1rem;
  border-radius: 1.1rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86) 0%, rgba(241, 245, 249, 0.86) 100%);
  border: 1px solid rgba(148, 163, 184, 0.32);
  box-shadow: 0 8px 26px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

.lk-gb__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--vp-c-text-1, #0f172a);
  border: none;
}

.lk-gb__replying {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2, #475569);
}

/* 输入区：左边一颗大头像跟着联系方式走，右边是输入框 */
.lk-gb__compose {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
}

.lk-gb__me {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 50%;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0369a1;
  background: linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%);
  border: 1px solid rgba(125, 211, 252, 0.6);
}

.lk-gb__me img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lk-gb__editor {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

/* 字数：贴在输入框右下角，快满了变红 */
.lk-gb__count-chars {
  position: absolute;
  right: 0.7rem;
  bottom: 0.5rem;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-3, #94a3b8);
  pointer-events: none;
}

.lk-gb__count-chars--near {
  color: #dc2626;
}

/* 预览块：和留言正文用同一套排版，所见即所得 */
.lk-gb__preview {
  position: relative;
  margin-top: 0.6rem;
  padding: 0.6rem 0.8rem 0.5rem;
  border-radius: 0.8rem;
  border: 1px dashed rgba(56, 189, 248, 0.55);
  background: rgba(240, 249, 255, 0.7);
}

.lk-gb__preview-tag {
  position: absolute;
  top: -0.55rem;
  left: 0.7rem;
  padding: 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #0369a1;
  background: rgba(240, 249, 255, 1);
}

.lk-gb__preview-btn {
  padding: 0.4rem 0.9rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2, #475569);
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.lk-gb__preview-btn:hover {
  background: rgba(241, 245, 249, 0.95);
}

.lk-gb__textarea {
  width: 100%;
  padding: 0.7rem 0.8rem;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.6;
  color: inherit;
  resize: vertical;
  border-radius: 0.8rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.7);
  box-sizing: border-box;
}

.lk-gb__textarea:focus {
  outline: none;
  border-color: rgba(56, 189, 248, 0.7);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
}

.lk-gb__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.6rem;
  margin-top: 0.6rem;
}

.lk-gb__field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.7rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.7);
}

.lk-gb__field-icon {
  flex: none;
  opacity: 0.55;
}

.lk-gb__field input {
  width: 100%;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.85rem;
  color: inherit;
  outline: none;
}

/* 蜜罐：视觉上彻底消失，但对脚本仍是一个普通输入框 */
.lk-gb__trap {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

/* 验证码那一行：默认只有一颗按钮，发过之后才长出输入框 */
.lk-gb__verify {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.lk-gb__verify-btn {
  padding: 0.34rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0369a1;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(224, 242, 254, 0.75);
  cursor: pointer;
}

.lk-gb__verify-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.lk-gb__field--code {
  flex: 0 0 auto;
  width: 150px;
}

.lk-gb__verify-hint {
  font-size: 0.72rem;
  color: var(--vp-c-text-3, #94a3b8);
}

.lk-gb__badge.lk-gb__badge--ok {
  color: #065f46;
  background: rgba(167, 243, 208, 0.9);
}

.lk-gb__options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.7rem;
}

.lk-gb__check {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2, #475569);
  cursor: pointer;
}

.lk-gb__spacer {
  flex: 1 1 auto;
}

.lk-gb__kaomoji {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.lk-gb__kaomoji-btn {
  padding: 0.16rem 0.4rem;
  font-size: 0.78rem;
  line-height: 1.2;
  color: #0369a1;
  border-radius: 0.5rem;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(224, 242, 254, 0.7);
  cursor: pointer;
}

.lk-gb__kaomoji-btn:hover {
  background: rgba(186, 230, 253, 0.9);
}

.lk-gb__send {
  padding: 0.44rem 1.3rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
  box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.lk-gb__send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
}

.lk-gb__send:disabled {
  opacity: 0.6;
  cursor: default;
}

.lk-gb__notice {
  margin: 0.6rem 0 0;
  font-size: 0.82rem;
  color: #047857;
}

.lk-gb__notice--bad {
  color: #b91c1c;
}

.lk-gb__hint {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--vp-c-text-3, #64748b);
}

.lk-gb__hint code {
  font-size: 0.72rem;
}

/* ── 列表 ───────────────────────────────────────────────── */
.lk-gb__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.lk-gb__list-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.2rem 0.1rem;
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--vp-c-text-2, #475569);
}

.lk-gb__count {
  padding: 0.02rem 0.42rem;
  font-size: 0.74rem;
  border-radius: 999px;
  color: #0369a1;
  background: rgba(224, 242, 254, 0.9);
}

/* ── 友链墙 ─────────────────────────────────────────────── */
.lk-gb-friends {
  padding: 0.85rem 1rem 0.95rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.26);
  backdrop-filter: blur(8px);
}

.lk-gb-friends__head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
}

.lk-gb-friends__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
}

.lk-gb-friends__apply {
  margin-left: auto;
  padding: 0.2rem 0.6rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: #0369a1;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(224, 242, 254, 0.75);
  cursor: pointer;
}

.lk-gb-friends__apply:hover {
  background: rgba(186, 230, 253, 0.95);
}

.lk-gb-friends__empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-3, #64748b);
}

/* 卡片自己按 200px 起排，窄屏自然落成一列，不用再写断点 */
.lk-gb-friends__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lk-gb-friends__card {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.6);
  color: inherit;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.lk-gb-friends__card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1);
}

/* 主题会给正文里的 a 加下划线和外链箭头，这两样在卡片里都不要 */
.lk-gb-friends .lk-gb-friends__card:hover,
.lk-gb-friends .lk-gb-friends__card:focus {
  text-decoration: none;
}

.lk-gb-friends__card::after,
.lk-gb-friends__card .external-link-icon {
  display: none;
}

.lk-gb-friends__avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 700;
  color: #0369a1;
  background: linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%);
}

.lk-gb-friends__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lk-gb-friends__meta {
  min-width: 0;
}

.lk-gb-friends__name {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
}

.lk-gb-friends__desc {
  display: block;
  overflow: hidden;
  font-size: 0.74rem;
  color: var(--vp-c-text-3, #64748b);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 友链申请卡：和右边栏其它卡片同一套玻璃质感 */
.lk-gb-apply {
  padding: 0.75rem 0.9rem 0.85rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px) saturate(1.6);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.lk-gb-apply__title {
  margin: 0 0 0.45rem;
  font-size: 0.92rem;
  font-weight: 700;
  border: none;
}

.lk-gb-apply__text {
  margin: 0 0 0.6rem;
  font-size: 0.78rem;
  line-height: 1.65;
  color: var(--vp-c-text-2, #475569);
}

.lk-gb-apply__self {
  margin-bottom: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.7rem;
  background: rgba(241, 245, 249, 0.8);
}

.lk-gb-apply__self-title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
}

/* 单栏够宽，四行信息横着铺开，别再堆成一竖条 */
.lk-gb-apply__self dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.15rem 0.9rem;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
}

.lk-gb-apply__self dl > div {
  display: flex;
  gap: 0.35rem;
  min-width: 0;
}

.lk-gb-apply__self dd {
  overflow-wrap: anywhere;
}

.lk-gb-apply__self dt {
  flex: none;
  color: var(--vp-c-text-3, #94a3b8);
}

.lk-gb-apply__self dd {
  margin: 0;
  overflow-wrap: anywhere;
}




.lk-gb-apply__btn {
  padding: 0.36rem 1.1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #0369a1;
  border-radius: 0.7rem;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(224, 242, 254, 0.75);
  cursor: pointer;
  transition: background 0.18s ease;
}

.lk-gb-apply__btn:hover {
  background: rgba(186, 230, 253, 0.95);
}

.lk-gb__state {
  margin: 1.2rem 0;
  text-align: center;
  font-size: 0.88rem;
  color: var(--vp-c-text-3, #64748b);
}

.lk-gb__state--bad {
  color: #b91c1c;
}

.lk-gb__thread {
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.26);
  backdrop-filter: blur(8px);
}

.lk-gb__item {
  display: flex;
  gap: 0.7rem;
}

.lk-gb__item--reply {
  margin: 0.7rem 0 0 2.6rem;
  padding-top: 0.7rem;
  border-top: 1px dashed rgba(148, 163, 184, 0.35);
}

.lk-gb__avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 50%;
  font-size: 1rem;
  font-weight: 700;
  color: #0369a1;
  background: linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%);
  border: 1px solid rgba(125, 211, 252, 0.6);
}

.lk-gb__avatar--owner {
  border-color: rgba(251, 191, 36, 0.75);
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.25);
}

.lk-gb__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lk-gb__body {
  flex: 1 1 auto;
  min-width: 0;
}

.lk-gb__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.lk-gb__nick {
  font-weight: 700;
  font-size: 0.9rem;
  color: inherit;
}

/* 填了网址的昵称是链接：主题会给它加下划线和 ↗，这里都不要 */
a.lk-gb__nick:hover {
  color: #0284c7;
  text-decoration: none;
}

a.lk-gb__nick::after {
  display: none;
}

.lk-gb__badge {
  padding: 0.05rem 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #92400e;
  border-radius: 999px;
  background: rgba(253, 230, 138, 0.9);
}

.lk-gb__badge--quiet {
  color: #475569;
  background: rgba(226, 232, 240, 0.9);
}

/* 「来自 广东」：淡一点，别跟昵称抢 */
.lk-gb__place {
  padding: 0.03rem 0.38rem;
  font-size: 0.68rem;
  border-radius: 999px;
  color: var(--vp-c-text-3, #64748b);
  background: rgba(226, 232, 240, 0.75);
}

.lk-gb__date {
  margin-left: auto;
  font-size: 0.74rem;
  color: var(--vp-c-text-3, #94a3b8);
}

.lk-gb__content {
  margin-top: 0.3rem;
  font-size: 0.9rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.lk-gb__content :deep(p) {
  margin: 0.3rem 0;
}

.lk-gb__content :deep(pre) {
  padding: 0.55rem 0.7rem;
  overflow-x: auto;
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.06);
}

.lk-gb__content :deep(blockquote) {
  margin: 0.4rem 0;
  padding-left: 0.7rem;
  border-left: 3px solid rgba(147, 197, 253, 0.9);
  color: var(--vp-c-text-2, #475569);
}

.lk-gb__redacted {
  margin-top: 0.3rem;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--vp-c-text-3, #94a3b8);
}

.lk-gb__actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.35rem;
}

/* 表情条：默认是一排灰按钮，点过的那颗高亮并留住数字 */
.lk-gb__reacts {
  display: inline-flex;
  gap: 0.25rem;
  margin-right: 0.35rem;
}

.lk-gb__react {
  display: inline-flex;
  align-items: center;
  gap: 0.16rem;
  padding: 0.1rem 0.4rem;
  font-size: 0.76rem;
  line-height: 1.3;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}

.lk-gb__react:hover {
  transform: translateY(-1px);
  background: rgba(241, 245, 249, 0.95);
}

.lk-gb__react--on {
  color: #0369a1;
  border-color: rgba(56, 189, 248, 0.6);
  background: rgba(224, 242, 254, 0.9);
  cursor: default;
}

.lk-gb__link-btn {
  padding: 0;
  font-size: 0.78rem;
  color: #0284c7;
  border: none;
  background: none;
  cursor: pointer;
}

.lk-gb__link-btn:hover {
  text-decoration: underline;
}

.lk-gb__link-btn--danger {
  color: #dc2626;
}

.lk-gb__admin-note {
  font-size: 0.72rem;
  color: var(--vp-c-text-3, #94a3b8);
}

/* ── 暗色 ───────────────────────────────────────────────── */
[data-theme='dark'] .lk-gb__composer {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.9) 100%);
  border-color: rgba(71, 85, 105, 0.6);
}

[data-theme='dark'] .lk-gb__textarea,
[data-theme='dark'] .lk-gb__field {
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(71, 85, 105, 0.7);
  color: #e2e8f0;
}

[data-theme='dark'] .lk-gb__thread {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(71, 85, 105, 0.5);
}

[data-theme='dark'] .lk-gb__avatar {
  color: #7dd3fc;
  background: linear-gradient(180deg, rgba(30, 58, 138, 0.6) 0%, rgba(30, 41, 59, 0.8) 100%);
  border-color: rgba(56, 189, 248, 0.4);
}

[data-theme='dark'] .lk-gb__kaomoji-btn {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.35);
  border-color: rgba(56, 189, 248, 0.35);
}

[data-theme='dark'] .lk-gb__count {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.4);
}

[data-theme='dark'] .lk-gb-friends {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(71, 85, 105, 0.5);
}

[data-theme='dark'] .lk-gb-friends__card {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(71, 85, 105, 0.6);
}

[data-theme='dark'] .lk-gb-friends__apply {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.35);
  border-color: rgba(56, 189, 248, 0.35);
}

[data-theme='dark'] .lk-gb-apply__self {
  background: rgba(15, 23, 42, 0.55);
}


[data-theme='dark'] .lk-gb-apply {
  background: linear-gradient(160deg, rgba(12, 18, 52, 0.82) 0%, rgba(48, 18, 72, 0.8) 100%);
  border-color: rgba(180, 140, 255, 0.28);
  color: rgba(230, 235, 255, 0.92);
}

[data-theme='dark'] .lk-gb-apply__btn {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.35);
  border-color: rgba(56, 189, 248, 0.35);
}

[data-theme='dark'] .lk-gb__me {
  color: #7dd3fc;
  background: linear-gradient(180deg, rgba(30, 58, 138, 0.6) 0%, rgba(30, 41, 59, 0.8) 100%);
  border-color: rgba(56, 189, 248, 0.4);
}

[data-theme='dark'] .lk-gb__preview {
  background: rgba(15, 23, 42, 0.5);
  border-color: rgba(56, 189, 248, 0.4);
}

[data-theme='dark'] .lk-gb__preview-tag {
  background: #16233c;
  color: #7dd3fc;
}

[data-theme='dark'] .lk-gb__preview-btn {
  color: rgba(226, 232, 240, 0.9);
  background: rgba(15, 23, 42, 0.6);
  border-color: rgba(71, 85, 105, 0.7);
}

[data-theme='dark'] .lk-gb__verify-btn {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.35);
  border-color: rgba(56, 189, 248, 0.35);
}

[data-theme='dark'] .lk-gb__badge.lk-gb__badge--ok {
  color: #a7f3d0;
  background: rgba(6, 78, 59, 0.85);
}

[data-theme='dark'] .lk-gb__place {
  color: rgba(226, 232, 240, 0.75);
  background: rgba(51, 65, 85, 0.7);
}

[data-theme='dark'] .lk-gb__react {
  border-color: rgba(71, 85, 105, 0.7);
  background: rgba(15, 23, 42, 0.55);
}

[data-theme='dark'] .lk-gb__react--on {
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(30, 58, 138, 0.45);
}

[data-theme='dark'] .lk-gb__content :deep(pre) {
  background: rgba(226, 232, 240, 0.1);
}

@media (max-width: 560px) {
  .lk-gb__item--reply {
    margin-left: 1.2rem;
  }

  .lk-gb__options {
    gap: 0.5rem;
  }
}
</style>
