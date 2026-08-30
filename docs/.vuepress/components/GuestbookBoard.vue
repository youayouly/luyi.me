<template>
  <div class="lk-gb-page">
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
            class="lk-gb__kaomoji-toggle"
            type="button"
            :aria-expanded="kaomojiOpen"
            :title="kaomojiOpen ? '收起表情' : '插入颜文字'"
            @click="kaomojiOpen = !kaomojiOpen"
          >
            😊
          </button>

          <div v-if="kaomojiOpen" class="lk-gb__kaomoji-panel">
            <div class="lk-gb__kaomoji-grid">
              <button
                v-for="face in KAOMOJI_CATEGORIES[kaomojiTab].items"
                :key="face"
                class="lk-gb__kaomoji-btn"
                type="button"
                :title="`插入 ${face}`"
                @click="insertFace(face)"
              >
                {{ face }}
              </button>
            </div>
            <div class="lk-gb__kaomoji-tabs">
              <button
                v-for="(cat, idx) in KAOMOJI_CATEGORIES"
                :key="cat.name"
                type="button"
                class="lk-gb__kaomoji-tab"
                :class="{ 'lk-gb__kaomoji-tab--on': kaomojiTab === idx }"
                @click="kaomojiTab = idx"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>
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
      <p v-if="!isEnglish" class="lk-gb__hint">
        支持 <code>**粗体**</code>、<code>`代码`</code>、<code>&gt; 引用</code> 和链接。悄悄话只有站长看得见。
      </p>
      <p v-else class="lk-gb__hint">
        Supports <code>**bold**</code>, <code>`code`</code>, <code>&gt; quote</code>, and links. Whispers are only visible to the site administrator.
      </p>
    </section>

    <!-- 访客留言：跟下面那份分开放的占位卡——下面那份现在还是测试数据，
         真实访客来留言之前先用这张空状态卡片占住位置，纯展示，不接数据。 -->
    <section class="lk-gb__list">
      <h2 class="lk-gb__list-title">{{ isEnglish ? '💬 Visitor Comments' : '💬 访客留言' }}</h2>
      <p class="lk-gb__state">
        {{ isEnglish ? 'No visitor comments yet — write the first one!' : '还没有访客留言，来写第一条吧。' }}
      </p>
    </section>

    <!-- 测试留言：跟发送框同一栏，目前是开发期留的测试数据（Zephyr / octocat 那些
         带 [TEST] 前缀的），不是真实访客发的。悄悄话游客看不到，不放在这一栏里，
         免得它的高度牵连上面「左栏跟右栏对齐」的伸展计算——见下面整行的 lk-gb-whispers。 -->
    <GuestbookThreadList
      :title="isEnglish ? '💬 Test Comments' : '💬 测试留言'"
      :threads="publicThreads"
      :loading="loading"
      :load-error="loadError"
      :empty-text="isEnglish ? 'No public comments yet.' : '还没有公开留言，来写第一条。'"
      :is-logged-in="isLoggedIn"
      :avatar-of="avatarOf"
      :initial="initial"
      :place-of="placeOf"
      :format-date="formatDate"
      :has-reacted="hasReacted"
      :failed-avatars="failedAvatars"
      @react="react"
      @reply="startReply"
      @remove="remove"
    />
    </aside>

    <!-- 左栏：友链墙 + 申请友链 -->
    <div class="lk-gb-main">
    <!-- 友链墙：数据来自 data/friendLinks.js，和关于页侧栏那张卡共用一份 -->
    <section class="lk-gb-friends">
      <header class="lk-gb-friends__head">
        <h2 class="lk-gb-friends__title">🔗 友链</h2>
        <span v-if="friends.length" class="lk-gb__count" data-lk-no-translate>{{ friends.length }}</span>
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

      <div class="lk-gb-apply__self">
        <p class="lk-gb-apply__self-title">加本站用这份信息</p>
        <dl>
          <div><dt>名称</dt><dd>Luke 的空间</dd></div>
          <div><dt>网址</dt><dd data-lk-no-translate>https://www.luyi.me</dd></div>
          <div><dt>简介</dt><dd>产品、技术、留学与生活</dd></div>
          <div><dt>头像</dt><dd data-lk-no-translate>https://www.luyi.me{{ siteAvatar }}</dd></div>
        </dl>
      </div>

      <button class="lk-gb-apply__btn" type="button" @click="fillFriendTemplate">自动申请友链</button>
    </section>

    <AiAssistantWidget class="lk-gb-assistant" />
    </div>

    <!-- 悄悄话：单独一整行，横跨两栏，放在左右栏下面——游客看不到这部分内容，
         它的高度不该影响上面左栏（含 AI 问答）跟右栏对齐时的伸展计算。 -->
    <section class="lk-gb-whispers">
    <GuestbookThreadList
      :title="isEnglish ? '🤫 Whispers' : '🤫 悄悄话'"
      :threads="privateThreads"
      :is-logged-in="isLoggedIn"
      :empty-text="isEnglish ? 'No whispers yet.' : '还没有悄悄话。'"
      :avatar-of="avatarOf"
      :initial="initial"
      :place-of="placeOf"
      :format-date="formatDate"
      :has-reacted="hasReacted"
      :failed-avatars="failedAvatars"
      @react="react"
      @reply="startReply"
      @remove="remove"
    />
    </section>
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
import { guestbookDraft } from '../utils/guestbookDraft.js'
import GuestbookThreadList from './GuestbookThreadList.vue'
import AiAssistantWidget from './AiAssistantWidget.vue'
import { friendLinks } from '../data/friendLinks.js'
import { formatPlace } from '../data/placeNames.js'
import { siteConfig } from '../site.config.js'

const API = '/api/guestbook'
/** 表情白名单现在只在 GuestbookThreadList.vue 里用（渲染按钮那份），这边不用重复声明 */
/** 点过的表情记在本地，只为把按钮点亮；真正的一次限制在服务端的 SET NX 上 */
const REACTED_KEY = 'lk_gb_reacted'
/** 正文草稿见 utils/guestbookDraft.js：站内切页面不丢，整页刷新会丢 */
/** 和服务端 MAX_CHARS 对齐；计数器和 maxlength 都读它 */
const MAX_CHARS = 1000

/** 颜文字面板：原来是一整排铺开的 6 个，现在按情绪分了几个 tab，点表情按钮展开/收起。 */
const KAOMOJI_CATEGORIES = [
  { name: '经典', items: ['(๑˃ᴗ˂)✧', '(੭ˊ꒳ˋ)੭', '(´｡• ᵕ •｡`)', '(๑•̀ㅂ•́)و', '(◍•ᴗ•◍)', 'ヾ(≧▽≦*)o'] },
  { name: '卖萌', items: ['(＾▽＾)', '(´▽`)', '٩(◕‿◕｡)۶', '(๑´ㅁ`)ﻭ✧', '(⁎⁍̴̛ᴗ⁍̴̛⁎)', '(๑˘͈ᵕ˘͈)◞'] },
  { name: '生气', items: ['(｀Д´)', '(╯°□°）╯', '（＃｀Д´）', '(￣^￣)', '(っ˘̩╭╮˘̩)っ', '(；ﾟДﾟ)'] },
  { name: '疑惑', items: ['(⊙ｏ⊙)', '(°ロ°)', '( ゜Д゜)', 'Σ(っ°Д°;)っ', '(・∀・)', '(´･ω･`)'] },
  { name: '加油', items: ['٩(๑❛ᴗ❛๑)۶', '(ง •_•)ง', 'o(*￣▽￣*)ブ', '(ノ°ο°)ノ', 'ᕙ(⇀‸↼‶)ᕗ'] },
  { name: '难过', items: ['(；´Д｀)', '(っ °Д °;)っ', '(╥﹏╥)', '(；へ：)', '(ᵕ人ᵕ)'] },
  { name: '比心', items: ['(づ｡◕‿‿◕｡)づ', '♡(˃͈ દ ˂͈ ༶ )', '(づ￣ ³￣)づ', '( •ॢ◡-ॢ)-♡', 'ᕕ( ᐛ )ᕗ'] },
  { name: '动物', items: ['ฅ(＾・ω・＾ฅ)', '(=^･ω･^=)', '▽・ω・▽', '/(=^･ω･^=)＼', '(ㅅ´ ˘ `)'] },
]
const kaomojiOpen = ref(false)
const kaomojiTab = ref(0)

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
        contact: 'Email / QQ / GitHub (optional, used for your avatar)',
        site: 'Your site (optional)',
        code: '6-digit code',
      }
    : {
        content: '留言内容，支持 Markdown',
        nick: '昵称',
        contact: '邮箱 / QQ 号 / GitHub（选填，用来取头像）',
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

/** 悄悄话跟公开留言分两栏显示：按 private 拆，回复跟着父留言走，不单独拆。 */
const privateThreads = computed(() => threads.value.filter((top) => top.private))
const publicThreads = computed(() => threads.value.filter((top) => !top.private))

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
 * 点一个表情，再点一次取消。前端先乐观更新，服务端拒绝再退回来——
 * 这个动作太轻量，等一个往返再变色会显得很迟钝。
 */
async function react(item, emoji) {
  const mark = `${item.id}:${emoji}`
  const already = reacted.value.has(mark)

  const before = item.reactions ? { ...item.reactions } : {}
  const beforeReacted = new Set(reacted.value)

  item.reactions = { ...before, [emoji]: Math.max(0, (before[emoji] || 0) + (already ? -1 : 1)) }
  const nextReacted = new Set(reacted.value)
  already ? nextReacted.delete(mark) : nextReacted.add(mark)
  reacted.value = nextReacted
  try {
    localStorage.setItem(REACTED_KEY, JSON.stringify([...reacted.value]))
  } catch {
    /* 无痕模式写不了就算了，服务端那把锁才是真的 */
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: already ? 'unreact' : 'react', id: item.id, emoji }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '点不上')
    /* 服务端返回真实计数（可能别人也点了/取消了），以它为准 */
    if (Number.isFinite(data.count)) item.reactions = { ...item.reactions, [emoji]: data.count }
  } catch {
    item.reactions = before
    reacted.value = beforeReacted
    try {
      localStorage.setItem(REACTED_KEY, JSON.stringify([...reacted.value]))
    } catch {
      /* 无痕模式写不了就算了 */
    }
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


/** 友链申请模板：填进输入框并把焦点移过去，省得访客自己想格式。跟 isEnglish 走，别让页面是英文、模板还是中文。 */
function fillFriendTemplate() {
  form.content = isEnglish.value
    ? ['Friend link application', 'Name:', 'URL:', 'Description:', 'Avatar: (optional, direct image link)'].join('\n')
    : ['申请友链', '名称：', '网址：', '简介：', '头像：（可选，图片直链）'].join('\n')
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
 * 悄悄话（lk-gb-whispers）不算进这两栏——游客看不到它，它单独占一整行放在
 * 两栏下面，这样左栏（含 AI 问答）跟右栏的 stretch 高度只看「组成 + 公开留言」，
 * 不会被悄悄话的高度拖长。
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
    /* 280px：跟 about / article / tech hub 的侧栏宽度看齐，统一四个页面的比例。 */
    grid-template-columns: 280px minmax(0, 1fr);
    /* stretch：跟 about / article / tech 侧栏同一套——左栏（友链+AI 问答）跟着
       右栏（发送框 + 留言）的高度长，而不是各走各的。右栏本身不参与「被撑
       高」，靠下面 .lk-gb-rail 的 align-self:start 单独跳出去，右栏永远按
       自己内容的高度出。左栏万一比右栏还高（AI 问答卡自己有 260px
       min-height，留言很少的时候可能发生），右栏就矮一截、底下露一小段
       背景。 */
    align-items: stretch;
  }

  .lk-gb-rail {
    order: 2;
    align-self: start;
  }

  .lk-gb-main {
    order: 1;
    /* 最后一张卡 flex:1 1 auto 把 stretch 让出来的高度填成自己的卡片背景。
       不设 position:sticky——试过（连同 .lk-gb-whispers 单独拆一个 grid 隔离
       包含块）发现这条浏览器规则：sticky 元素如果被 align-items:stretch 撑到
       跟兄弟一样高（height 正好等于包含块高度），sticky 就完全失效、退化成
       普通静态定位——因为「贴住视口」需要元素比包含块矮，留出可以贴着滑动
       的余量，撑满之后没有余量可言。两个目标（撑到跟右栏一样高 / 滚动时贴
       在顶部）在这个场景下互斥，选前者：情願失去「滚动时 AI 问答卡吸顶」，
       也不要一会儿跟右栏对不齐、一会儿悬浮盖住下面的整行模块。 */
  }

  .lk-gb-main > :last-child {
    flex: 1 1 auto;
  }

  /* 悄悄话独占一整行，横跨两栏——它不参与上面这一行 stretch 的高度计算，
     所以左栏（含 AI 问答）的伸展只跟着右栏「组成 + 真实留言占位 + 公开留言」走，
     不会被游客看不见的悄悄话拖长。 */
  .lk-gb-whispers {
    order: 3;
    grid-column: 1 / -1;
  }
}

.lk-gb-rail,
.lk-gb-main {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-width: 0;
}

.lk-gb-whispers {
  min-width: 0;
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

/* 表情按钮 + 展开的浮层面板，面板往上开（工具条贴在输入框底部，往下开会被卡片边界切掉）。 */
.lk-gb__kaomoji {
  position: relative;
  display: flex;
}

.lk-gb__kaomoji-toggle {
  padding: 0.16rem 0.5rem;
  font-size: 0.95rem;
  line-height: 1.2;
  border-radius: 0.5rem;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(224, 242, 254, 0.7);
  cursor: pointer;
}

.lk-gb__kaomoji-toggle:hover {
  background: rgba(186, 230, 253, 0.9);
}

.lk-gb__kaomoji-panel {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0;
  z-index: 5;
  width: 260px;
  padding: 0.55rem 0.55rem 0.4rem;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.3);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(10px);
}

.lk-gb__kaomoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
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

.lk-gb__kaomoji-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
}

.lk-gb__kaomoji-tab {
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
  color: var(--vp-c-text-2, #475569);
  border-radius: 999px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
}

.lk-gb__kaomoji-tab:hover {
  background: rgba(226, 232, 240, 0.7);
}

.lk-gb__kaomoji-tab--on {
  color: #0369a1;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(224, 242, 254, 0.9);
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

[data-theme='dark'] .lk-gb__kaomoji-toggle,
[data-theme='dark'] .lk-gb__kaomoji-btn {
  color: #7dd3fc;
  background: rgba(30, 58, 138, 0.35);
  border-color: rgba(56, 189, 248, 0.35);
}

[data-theme='dark'] .lk-gb__kaomoji-panel {
  background: rgba(15, 23, 42, 0.96);
  border-color: rgba(71, 85, 105, 0.6);
}

[data-theme='dark'] .lk-gb__kaomoji-tabs {
  border-top-color: rgba(71, 85, 105, 0.5);
}

[data-theme='dark'] .lk-gb__kaomoji-tab--on {
  color: #7dd3fc;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(30, 58, 138, 0.45);
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

@media (max-width: 560px) {
  .lk-gb__options {
    gap: 0.5rem;
  }
}
</style>

<style>
/*
 * 留言列表用的样式，专门不带 scoped：留言板拆成两栏后，这些类名同时用在
 * GuestbookBoard.vue 自己（发言预览区）和 GuestbookThreadList.vue（两份列表）
 * 两个文件的模板里，scoped 的 data-v-xxx 只会点到当前文件，够不到子组件，
 * 所以干脆搬成全局选择器——反正 lk- 前缀本来就是为了不跟别处撞名。
 * :deep() 是 scoped 专用语法，搬出来之后改回普通选择器就行，效果一样。
 */
/*
 * 留言列表现在是「一张卡片，逐行，中间细分割线」——跟 AboutTimeline.vue 改版
 * 同一个思路：一堆各自带背景/圆角/阴影的小卡片摞在一起太碎，合成一张卡更清爽。
 * .lk-gb__thread 因此从「自己是一张卡」变成「卡片里的一行」，横向留白交给
 * 外层 .lk-gb__list 的 padding，自己只留竖直方向的行间距 + 底边分割线。
 */
.lk-gb__list {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0.85rem 1rem 0.4rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.26);
  backdrop-filter: blur(8px);
}

.lk-gb__list-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
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
  padding: 0.9rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.lk-gb__thread:last-of-type {
  border-bottom: none;
  padding-bottom: 0.45rem;
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

.lk-gb__badge.lk-gb__badge--ok {
  color: #065f46;
  background: rgba(167, 243, 208, 0.9);
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

.lk-gb__content p {
  margin: 0.3rem 0;
}

.lk-gb__content pre {
  padding: 0.55rem 0.7rem;
  overflow-x: auto;
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.06);
}

.lk-gb__content blockquote {
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

[data-theme='dark'] .lk-gb__list {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(71, 85, 105, 0.5);
}

[data-theme='dark'] .lk-gb__thread {
  border-bottom-color: rgba(71, 85, 105, 0.45);
}

[data-theme='dark'] .lk-gb__avatar {
  color: #7dd3fc;
  background: linear-gradient(180deg, rgba(30, 58, 138, 0.6) 0%, rgba(30, 41, 59, 0.8) 100%);
  border-color: rgba(56, 189, 248, 0.4);
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

[data-theme='dark'] .lk-gb__content pre {
  background: rgba(226, 232, 240, 0.1);
}

@media (max-width: 560px) {
  .lk-gb__item--reply {
    margin-left: 1.2rem;
  }
}
</style>
