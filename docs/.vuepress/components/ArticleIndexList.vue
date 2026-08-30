<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { articles } from '../data/articleIndex.generated.js'
import AiAssistantWidget from './AiAssistantWidget.vue'

const pageSize = 4
const currentPage = ref(1)
/** null = 全部文章 */
const selectedTag = ref(null)
const searchQuery = ref('')

function articleTime(article) {
  const t = new Date(article.date).getTime()
  return Number.isNaN(t) ? 0 : t
}

const sortedArticles = computed(() =>
  [...articles].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return articleTime(b) - articleTime(a)
  }),
)

/** 文章可检索文本（标题 + 摘要 + 标签），小写 */
function articleHaystack(article) {
  return `${article.title}\n${article.excerpt}\n${article.tags.join(' ')}`.toLowerCase()
}

/** 关键字模糊：不区分大小写；多空格视为多个词，须同时命中（各自 substring） */
function articleMatchesKeyword(article, rawQuery) {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const hay = articleHaystack(article)
  return tokens.every((t) => hay.includes(t))
}

/** 仅按搜索框过滤后的列表（供「全部」数量与标签统计） */
const listMatchingKeyword = computed(() =>
  sortedArticles.value.filter((a) => articleMatchesKeyword(a, searchQuery.value)),
)

const tagCounts = computed(() => {
  const counts = {}
  for (const article of listMatchingKeyword.value) {
    for (const tag of article.tags) counts[tag] = (counts[tag] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
})

const totalArticleCount = computed(() => listMatchingKeyword.value.length)

const filteredArticles = computed(() => {
  let list = listMatchingKeyword.value
  if (selectedTag.value != null) {
    list = list.filter((a) => a.tags.includes(selectedTag.value))
  }
  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredArticles.value.length / pageSize)))

const visibleArticles = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredArticles.value.slice(start, start + pageSize)
})

function setSelectedTag(tag) {
  selectedTag.value = tag
  currentPage.value = 1
}

watch(searchQuery, () => {
  currentPage.value = 1
  if (selectedTag.value != null) {
    const still = listMatchingKeyword.value.some((a) => a.tags.includes(selectedTag.value))
    if (!still) selectedTag.value = null
  }
})

watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}
</script>

<template>
  <!-- 根级 lk-blog / lk-article-three 在 article/README 等页里用静态 <div> 包一层，避免子组件未挂载时 :has() 不成立、出现左对齐后闪到居中 -->
  <div class="lk-article-three__content">
      <aside class="lk-article-three__left">
        <div class="lk-article-three__panel">
          <div class="lk-article-three__panel-head">
            <h3>搜索文章</h3>
          </div>

          <input
            v-model="searchQuery"
            type="search"
            class="lk-article-three__search-input"
            placeholder="标题、摘要、标签…"
            autocomplete="off"
            aria-label="按关键字模糊搜索文章"
          />

          <div class="lk-article-three__tag-cloud">
            <button
              type="button"
              class="lk-article-three__tag-pill"
              :class="{ 'is-active': selectedTag === null }"
              @click="setSelectedTag(null)"
            >
              全部 <span class="lk-article-three__tag-count">{{ totalArticleCount }}</span>
            </button>
            <button
              v-for="[tag, count] in tagCounts"
              :key="tag"
              type="button"
              class="lk-article-three__tag-pill"
              :class="{ 'is-active': selectedTag === tag }"
              @click="setSelectedTag(tag)"
            >
              {{ tag }} <span class="lk-article-three__tag-count">{{ count }}</span>
            </button>
          </div>
        </div>

        <AiAssistantWidget class="lk-article-three__assistant" />
      </aside>

      <main class="lk-article-three__middle">
        <div class="lk-article-three__list-body">
        <ol class="lk-article-three__list">
          <li
            v-for="article in visibleArticles"
            :key="article.href"
            class="lk-article-three__item"
            :class="{
              'is-pinned': article.pinned,
              'is-external': article.external,
            }"
          >
            <component
              :is="article.external ? 'a' : RouterLink"
              class="lk-article-three__card"
              v-bind="article.external ? { href: article.href } : { to: article.href }"
              :aria-label="(article.external ? '打开' : '阅读') + '：' + article.title"
            >
              <span class="lk-article-three__corner-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
              <div class="lk-article-three__text">
                <!-- 元信息行：仅日期，避免与下方 tags 重复 -->
                <div class="lk-article-three__meta-row">
                  <time class="lk-article-three__meta-date" :datetime="article.date">
                    <span class="lk-article-three__meta-icon" aria-hidden="true">📅</span>
                    {{ formatDate(article.date) }}
                  </time>
                </div>
                <h3 class="lk-article-three__title">{{ article.title }}</h3>
                <p class="lk-article-three__excerpt">{{ article.excerpt }}</p>
                <div class="lk-article-three__meta">
                  <span v-for="tag in article.tags" :key="tag" class="lk-article-three__tag">{{ tag }}</span>
                </div>
              </div>

              <div class="lk-article-three__cover-wrap">
                <img
                  v-if="article.cover"
                  class="lk-article-three__cover"
                  :src="article.cover"
                  :alt="article.title"
                  loading="lazy"
                />
              </div>
            </component>

            <!-- 浮动分页：叠在最后一张卡片的封面区上，跟着列表滚动。
                 是卡片（<a>/RouterLink）的兄弟节点而非其内部子节点——按钮嵌进链接里会
                 点哪儿都触发跳转。position:absolute 相对这个 li 自身定位，跟随它的
                 实际高度居中，不用给卡片高度猜一个固定的负 margin。 -->
            <nav
              v-if="totalPages > 1 && article === visibleArticles[visibleArticles.length - 1]"
              class="lk-article-three__pager"
              aria-label="Articles pagination"
            >
              <button
                v-for="page in totalPages"
                :key="page"
                type="button"
                class="lk-article-three__pager-button"
                :class="{ 'is-active': page === currentPage }"
                :aria-current="page === currentPage ? 'page' : undefined"
                @click="currentPage = page"
              >
                {{ page }}
              </button>
            </nav>
          </li>
        </ol>
        </div>
      </main>
    </div>
</template>

<style>
.lk-article-three {
  /* 280px：跟 guestbook / tech hub / about 的侧栏宽度看齐，统一四个页面的比例。 */
  --lk-article-side-w: 280px;
  --lk-article-gap: 2rem;
  /* 顶距减为原先 (navbar+0.9rem) 的约 1/3；sticky 单独用安全值避免吸顶时压导航 */
  --lk-article-content-pad-top: calc((var(--navbar-height, 3.6rem) + 0.9rem) / 3);
  /* 与 Projects hub 对齐：max-width 1200；父级为 flex+align-items:center 时勿用 width:100% 撑满整行 */
  width: min(100%, 1200px);
  max-width: 1200px;
  flex: 0 1 auto;
  margin: 0 auto;
  padding: 0 1rem 2rem;
  box-sizing: border-box;
}

.lk-article-three__intro {
  max-width: none;
  margin: 0 0 1.25rem;
  text-align: left;
  color: rgba(226, 232, 240, 0.82);
  line-height: 1.7;
}

.lk-article-three__content {
  display: grid;
  grid-template-columns: var(--lk-article-side-w) minmax(0, 1fr);
  gap: var(--lk-article-gap);
  /*
   * stretch，不是 start：跟 about/guestbook 同一套取舍。中列（分页文章卡）
   * 换页时高度会变，stretch 会让侧栏（含 AiAssistantWidget，靠 flex:1 1 auto
   * 填满剩余高度）跟着重新拉伸/收缩——早先为了避免这点改成过 start + 写死
   * px 高度、又改成过 100vh 封顶 + 内部滚动条，但前者只在某一种缩放/当页
   * 篇数下凑得上，后者会在内容超出视口时把 AI 卡片挤到滚动条下面看不见
   * （都是用户反馈翻出来的）。翻页时 AI 卡跟着长高一点、也不再吸顶滚动，
   * 好过两栏对不齐或者内容被滚动条吞掉。
   */
  align-items: stretch;
  /* 整组（搜索栏 + 文章列表）作为一块在容器中居中 */
  justify-content: center;
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding-top: var(--lk-article-content-pad-top);
}

/* 不再 position:sticky——跟 .lk-article-three__content 的注释同一个取舍：
 * 这一栏是 grid item，父级已 align-items:stretch，flex:1 1 auto 把高度
 * 透传给最后一张卡（AI 问答），任何缩放/任何一页文章数量下都跟中列严丝
 * 合缝，不需要 max-height 封顶也不需要内部滚动条。 */
.lk-article-three__left {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
}

/* 最后一张卡（AI 问答）吃掉搜索卡之外的剩余高度：选择器要凑够 3 个 class，
   AiAssistantWidget 自己 <style scoped> 里的 .lk-ai-asst 规则会被 Vue 编译
   成 .lk-ai-asst[data-v-xxxx]，属性选择器和 class 权重相同，specificity
   是 (0,2,0)——只写 .lk-article-three__assistant (0,1,0) 覆盖不掉它，写两个
   class 又跟它打平、谁赢看打包后的先后顺序、不可靠。 */
.lk-article-three__left .lk-ai-asst.lk-article-three__assistant {
  flex: 1 1 auto;
}

.lk-article-three__middle {
  min-width: 0;
  width: 100%;
  /* 不再硬卡 860，让中列吃 grid 1fr 平均分布，整块在容器内居中 */
  max-width: none;
}

.lk-article-three__panel {
  flex: none;
  border: 1px solid rgba(110, 231, 223, 0.18);
  border-radius: 20px;
  padding: 1rem;
  background: linear-gradient(180deg, rgba(11, 19, 35, 0.94), rgba(12, 20, 37, 0.9));
  box-shadow: 0 20px 48px rgba(2, 6, 23, 0.24);
}

.lk-article-three__panel-head {
  margin-bottom: 0.75rem;
}

.lk-article-three__panel-head h3 {
  margin: 0 0 0.35rem;
  color: #67e8f9;
  font-size: 1rem;
}

.lk-article-three__panel-head p {
  margin: 0;
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.82rem;
}

.lk-article-three__list-body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.lk-article-three__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: 1.1rem;
}

.lk-article-three__item {
  /* 斜率 = diagonal-frac × 封面列宽；文字区右缘用 --lk-seam-shift 与封面 clip-path 共线。
     定义在 item 上（而非 card 上）是因为浮动分页跟卡片是兄弟节点，要用同一个封面列宽把
     自己居中到封面列——变量定义在 card 上时子级看得到、兄弟级看不到。 */
  --lk-diagonal-frac: 0.16;
  --lk-cover-w: 240px;
  --lk-seam-shift: calc(var(--lk-diagonal-frac) * var(--lk-cover-w));
  position: relative;
  margin: 0;
}

.lk-article-three__card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--lk-cover-w);
  overflow: hidden;
  border-radius: 24px;
  text-decoration: none;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(12, 20, 36, 0.92));
  box-shadow: 0 22px 56px rgba(2, 6, 23, 0.28);
  min-height: 200px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.lk-article-three__card:hover {
  transform: translateY(-4px);
  border-color: rgba(125, 211, 252, 0.38);
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.44);
  text-decoration: none;
}

.lk-article-three__corner-arrow {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  z-index: 3;
  width: 1.45rem;
  height: 1.45rem;
  color: #67e8f9;
  pointer-events: none;
  transform: rotate(-45deg);
  transition: transform 0.22s ease, color 0.2s ease;
}

.lk-article-three__corner-arrow svg {
  display: block;
  width: 100%;
  height: 100%;
}

.lk-article-three__card:hover .lk-article-three__corner-arrow,
.lk-article-three__card:focus-visible .lk-article-three__corner-arrow {
  transform: rotate(0deg);
  color: #a5f3fc;
}

.lk-article-three__card,
.lk-article-three__card:hover,
.lk-article-three__card:focus,
.lk-article-three__card:active,
.lk-article-three__card *,
.lk-article-three__card *:hover,
.lk-article-three__card *:focus,
.lk-article-three__card *:active {
  text-decoration: none !important;
}

.lk-article-three__item.is-pinned .lk-article-three__card {
  border-color: rgba(45, 212, 191, 0.34);
}

.lk-article-three__item.is-external .lk-article-three__card {
  border-color: rgba(96, 165, 250, 0.32);
}

.lk-article-three__text {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.72rem;
  padding: 1.2rem 1.25rem 1.15rem;
  min-width: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(12, 20, 36, 0.98));
  /* 与封面共用一条直斜边（避免「竖 + 斜」两段接缝） */
  -webkit-clip-path: polygon(0 0, 100% 0, calc(100% + var(--lk-seam-shift)) 100%, 0 100%);
  clip-path: polygon(0 0, 100% 0, calc(100% + var(--lk-seam-shift)) 100%, 0 100%);
}

/* 元信息行：日期 + 分类，单行不换行 */
.lk-article-three__meta-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
  overflow: hidden;
  white-space: nowrap;
}

.lk-article-three__meta-date,
.lk-article-three__meta-cat {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: rgba(148, 163, 184, 0.78);
  line-height: 1;
  white-space: nowrap;
}

.lk-article-three__meta-icon {
  font-size: 0.72rem;
  line-height: 1;
}

.lk-article-three__meta-sep {
  color: rgba(148, 163, 184, 0.45);
  font-size: 0.76rem;
}

/* 隐藏旧的独立 date（已整合进 meta-row） */
.lk-article-three__date {
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.82rem;
  font-weight: 600;
  display: none;
}

.lk-article-three__title {
  margin: 0;
  color: #f8fafc;
  font-size: 1.28rem;
  line-height: 1.42;
}

.lk-article-three__excerpt {
  margin: 0;
  color: rgba(226, 232, 240, 0.82);
  line-height: 1.62;
  font-size: 0.94rem;
}

.lk-article-three__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: auto;
}

.lk-article-three__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  font-size: 0.76rem;
  color: rgba(248, 250, 252, 0.92);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.lk-article-three__cover-wrap {
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 100%;
  width: 100%;
  background: rgba(9, 14, 26, 0.94);
  isolation: isolate;
  -webkit-clip-path: polygon(calc(var(--lk-diagonal-frac) * 100%) 0, 100% 0, 100% 100%, 0 100%);
  clip-path: polygon(calc(var(--lk-diagonal-frac) * 100%) 0, 100% 0, 100% 100%, 0 100%);
}

/* 仅用上下方向的弱压暗，避免斜向 gradient 在斜切边上像「第二段斜线」 */
.lk-article-three__cover-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.18) 0%, transparent 42%);
  mix-blend-mode: multiply;
}

.lk-article-three__cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.08) contrast(1.03);
}

.lk-article-three__search-input {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 0.65rem;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.4);
  color: #e2e8f0;
  font-size: 0.82rem;
  line-height: 1.35;
}

.lk-article-three__search-input::placeholder {
  color: rgba(148, 163, 184, 0.75);
}

.lk-article-three__search-input:focus {
  outline: none;
  border-color: rgba(125, 211, 252, 0.45);
}

.lk-article-three__tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.lk-article-three__tag-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font: inherit;
  cursor: pointer;
  appearance: none;
  text-decoration: none;
  color: rgba(226, 232, 240, 0.92);
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.22);
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.lk-article-three__tag-pill:hover {
  background: rgba(103, 232, 249, 0.15);
  border-color: rgba(103, 232, 249, 0.38);
  color: #67e8f9;
}

.lk-article-three__tag-pill.is-active {
  background: #f3b03e;
  border-color: rgba(180, 120, 40, 0.55);
  color: #0f172a;
}

.lk-article-three__tag-pill.is-active:hover {
  background: #f5bd52;
  border-color: rgba(160, 100, 30, 0.55);
  color: #0f172a;
}

.lk-article-three__tag-pill.is-active .lk-article-three__tag-count {
  color: rgba(15, 23, 42, 0.65);
}

.lk-article-three__tag-count {
  margin-left: 0.35rem;
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.74rem;
}

/* 分页：贴在最后一张卡片底边、横向居中，横向居中方式跟 ProjectCardsGrid 的分页保持一致
   （整卡居中，不局限于封面列）。分页是那张卡片（<a>/RouterLink）的兄弟节点，不是子节点——
   模板里有为什么。position:absolute 相对它俩共同的父级 li 定位，bottom 量的是 li 自己的
   框，卡片高度变了不用跟着改数字。卡片 hover 时会 translateY(-4px) 上浮，但那是卡片自己的
   transform、不影响这个绝对定位的兄弟节点——不跟着一起浮，底边间距就会在 hover 时被过滤掉，
   分页视觉上探出卡片下边缘。所以 hover 态在 li 上再镜像同一个位移，让分页跟卡片同步浮起。 */
.lk-article-three__pager {
  position: absolute;
  z-index: 5;
  left: 50%;
  bottom: 0.9rem;
  transform: translateX(-50%);
  transition: transform 0.2s ease;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
}

.lk-article-three__item:hover .lk-article-three__pager {
  transform: translate(-50%, -4px);
}

.lk-article-three__pager-button {
  min-width: 2.2rem;
  height: 2.2rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: rgba(0, 0, 0, 0.22);
  color: #f1f5f9;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.lk-article-three__pager-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.55);
}

.lk-article-three__pager-button.is-active {
  background: #ffffff;
  color: #0a0a0a;
  border-color: #ffffff;
}

@media (max-width: 1400px) {
  .lk-article-three {
    --lk-article-side-w: 260px;
  }

  .lk-article-three__content {
    /* 跟外层一起收缩，整块仍居中 */
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .lk-article-three__item {
    --lk-cover-w: 220px;
  }
}

@media (max-width: 1100px) {
  .lk-article-three__intro {
    margin-left: 0;
  }

  .lk-article-three__content {
    grid-template-columns: 1fr;
  }

  /* 移动端：单列 grid 下每栏各占一行，stretch 无从对齐，flex:1 1 auto 也就
     没有多余空间可吃，天然按自身内容定高——搜索卡置于最上方，文章列表在下 */
  .lk-article-three__left {
    order: 1;
  }

  .lk-article-three__middle {
    order: 2;
  }

  .lk-article-three__card {
    grid-template-columns: 1fr;
  }

  .lk-article-three__text {
    -webkit-clip-path: none;
    clip-path: none;
  }

  .lk-article-three__cover-wrap {
    height: 200px;
    width: 100%;
    -webkit-clip-path: none;
    clip-path: none;
  }

  /* 分页贴的是整个 li 的底边（卡片自己的底边），单列布局下依然成立，不需要再为
     封面通栏单独算一次偏移量。 */
}

/* Light mode */
[data-theme='light'] .lk-article-three__panel {
  background: rgba(248, 250, 252, 0.9);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

[data-theme='light'] .lk-article-three__panel-head h3 {
  color: #0d9488;
}

[data-theme='light'] .lk-article-three__panel-head p {
  color: #64748b;
}

[data-theme='light'] .lk-article-three__tag-pill {
  color: #475569;
  background: rgba(241, 245, 249, 0.8);
  border-color: rgba(15, 23, 42, 0.08);
}

[data-theme='light'] .lk-article-three__tag-pill:hover {
  background: rgba(13, 148, 136, 0.1);
  border-color: rgba(13, 148, 136, 0.3);
  color: #0d9488;
}

[data-theme='light'] .lk-article-three__tag-pill.is-active {
  background: #f3b03e;
  border-color: rgba(180, 120, 40, 0.45);
  color: #0f172a;
}

[data-theme='light'] .lk-article-three__tag-pill.is-active:hover {
  background: #f5bd52;
  color: #0f172a;
}

[data-theme='light'] .lk-article-three__tag-pill.is-active .lk-article-three__tag-count {
  color: rgba(15, 23, 42, 0.62);
}

[data-theme='light'] .lk-article-three__search-input {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(15, 23, 42, 0.1);
  color: #0f172a;
}

[data-theme='light'] .lk-article-three__search-input::placeholder {
  color: #94a3b8;
}

[data-theme='light'] .lk-article-three__tag-count {
  color: #94a3b8;
}

[data-theme='light'] .lk-article-three__card {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

[data-theme='light'] .lk-article-three__card:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
}

[data-theme='light'] .lk-article-three__text {
  background: rgba(255, 255, 255, 0.98);
}

[data-theme='light'] .lk-article-three__date {
  color: #94a3b8;
}

[data-theme='light'] .lk-article-three__meta-date,
[data-theme='light'] .lk-article-three__meta-cat {
  color: #94a3b8;
}

[data-theme='light'] .lk-article-three__meta-sep {
  color: #cbd5e1;
}

[data-theme='light'] .lk-article-three__title {
  color: #0f172a;
}

[data-theme='light'] .lk-article-three__excerpt {
  color: #475569;
}

[data-theme='light'] .lk-article-three__tag {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(15, 23, 42, 0.12);
}

[data-theme='light'] .lk-article-three__pager-button {
  border-color: rgba(15, 23, 42, 0.2);
  background: rgba(255, 255, 255, 0.9);
  color: #0f172a;
}

[data-theme='light'] .lk-article-three__pager-button:hover {
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(15, 23, 42, 0.28);
}

[data-theme='light'] .lk-article-three__pager-button.is-active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

[data-theme='light'] .lk-article-three__corner-arrow {
  color: #0d9488;
}

[data-theme='light'] .lk-article-three__card:hover .lk-article-three__corner-arrow,
[data-theme='light'] .lk-article-three__card:focus-visible .lk-article-three__corner-arrow {
  color: #0f766e;
}

[data-theme='light'] .lk-article-three__cover-wrap {
  background: #f8fafc;
}

[data-theme='light'] .lk-article-three__cover-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 45%);
  mix-blend-mode: normal;
  display: block;
}

[data-theme='light'] .lk-article-three__cover {
  opacity: 0.85;
  filter: brightness(1.18) contrast(0.85) saturate(0.82);
  transition: opacity 0.2s ease, filter 0.2s ease;
}

[data-theme='light'] .lk-article-three__card:hover .lk-article-three__cover {
  opacity: 1;
  filter: brightness(1.08) contrast(0.95) saturate(0.98);
}
</style>
