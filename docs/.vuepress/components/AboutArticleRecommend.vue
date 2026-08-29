<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { recommendedArticles } from '../data/aboutArticleFeed.js'

const defaultCover = '/gallery/about-bg-bright-starfield.svg'

/*
 * 站内跳转必须走 RouterLink：原生 <a> 会整页重载，服务端发的是中文 HTML，
 * 译文要等 bundle 执行完才盖上去，中间实测有 200-300ms 的中文闪烁。
 * 写法与 ArticleIndexList 一致，external 的条目仍旧用原生 <a>。
 */
function linkTag(post) {
  return post.external ? 'a' : RouterLink
}

function linkProps(post) {
  return post.external ? { href: post.href } : { to: post.href }
}

const articles = computed(() =>
  [...recommendedArticles]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 4),
)

function coverFor(post) {
  return post.cover || defaultCover
}

function primaryCategory(post) {
  return post.categories?.[0] || '随笔'
}

/** 卡片序号：按显示顺序 1-indexed，零填两位（01 / 02 …）。
 *  ARTICLE 板块独立编号，不与 PROJECT 重叠。 */
function indexLabel(i) {
  return String(i + 1).padStart(2, '0')
}
</script>

<template>
  <div class="lk-about-articles">
    <h3 class="lk-about-articles__heading">短文推荐</h3>
    <ul class="lk-about-articles__list">
      <li v-for="(post, i) in articles" :key="i" class="lk-about-articles__card">
        <!-- 整张卡片就是一个链接：点封面、摘要、页脚任意位置都能进文章，
             不再要求点中加粗标题。卡片内不能再放第二个 <a>（嵌套链接非法）。 -->
        <component
          :is="linkTag(post)"
          v-bind="linkProps(post)"
          class="lk-about-articles__link"
        >
          <span class="lk-about-articles__media">
            <img class="lk-about-articles__cover" :src="coverFor(post)" alt="" loading="lazy" />
            <span class="lk-about-articles__tag" aria-hidden="true">
              <span class="lk-about-articles__tag-kind">ARTICLE</span>
              <span class="lk-about-articles__tag-sep" aria-hidden="true">·</span>
              <span class="lk-about-articles__tag-num">{{ indexLabel(i) }}</span>
            </span>
          </span>
          <span class="lk-about-articles__body">
            <span class="lk-about-articles__title">{{ post.title }}</span>
            <span class="lk-about-articles__excerpt">{{ post.excerpt }}</span>
            <span class="lk-about-articles__foot">
              <span class="lk-about-articles__foot-left">
                <span class="lk-about-articles__foot-item">{{ post.date }}</span>
                <span class="lk-about-articles__foot-dot" aria-hidden="true">·</span>
                <span class="lk-about-articles__foot-item">{{ primaryCategory(post) }}</span>
              </span>
              <span class="lk-about-articles__read">阅读全文 &gt;</span>
            </span>
          </span>
        </component>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lk-about-articles {
  min-width: 0;
  --lk-about-card-border: rgba(33, 37, 41, 0.10);
  --lk-about-card-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
  --lk-about-accent: var(--lk-accent, #343A40);
}

.lk-about-articles__heading {
  margin: 0 0 0.85rem;
  font-size: 1.28rem;
  font-weight: 760;
  color: #000;
}

.lk-about-articles__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  width: 100%;
}

.lk-about-articles__card {
  display: block;
  min-height: 0;
  width: 100%;
  max-width: none;
  margin-inline: auto;
  margin: 0;
  padding: 0;
  border-radius: 22px;
  overflow: hidden;
  background: rgba(253, 252, 250, 0.96);
  border: 1px solid var(--lk-about-card-border);
  box-shadow: var(--lk-about-card-shadow);
  backdrop-filter: blur(8px) saturate(1.05);
  -webkit-backdrop-filter: blur(8px) saturate(1.05);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.lk-about-articles__card:hover {
  transform: translateY(-3px);
  border-color: rgba(33, 37, 41, 0.20);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
}

.lk-about-articles__link {
  display: grid;
  grid-template-rows: minmax(130px, 180px) auto;
  height: 100%;
  min-height: 0;
  color: inherit;
}

.lk-about-articles .lk-about-articles__card a.lk-about-articles__link,
.lk-about-articles .lk-about-articles__card a.lk-about-articles__link:hover,
.lk-about-articles .lk-about-articles__card a.lk-about-articles__link:focus,
.lk-about-articles .lk-about-articles__card a.lk-about-articles__link:active {
  text-decoration: none;
  -webkit-text-decoration: none;
}

.lk-about-articles__media {
  position: relative;
  display: block;
  min-height: 130px;
  max-height: 180px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #e9ecef 100%);
}

/* 卡片左上角角标：PROJECT · 01 / ARTICLE · 01。
 * 等宽字体 + 大写 + 灰阶半透明深色，覆盖在封面图上，不抢视觉。 */
.lk-about-articles__tag {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: baseline;
  gap: 0.42rem;
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  color: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-family: var(--lk-font-mono, monospace);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  pointer-events: none;
  user-select: none;
}

.lk-about-articles__tag-kind {
  letter-spacing: 0.12em;
}

.lk-about-articles__tag-sep {
  opacity: 0.55;
  margin-inline: -0.05rem;
}

.lk-about-articles__tag-num {
  font-weight: 800;
  font-feature-settings: "tnum" 1;
}

.lk-about-articles__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 35%;
  display: block;
}

.lk-about-articles__body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.55rem;
  min-height: 118px;
  padding: 0.65rem 0.95rem 0.75rem;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.45) 0%, rgba(255, 255, 255, 0.96) 34%);
}

.lk-about-articles__title {
  display: block;
  font-size: 1rem;
  font-weight: 780;
  color: #000;
  text-decoration: none;
  line-height: 1.4;
  transition: color 0.18s ease-out;
}

.lk-about-articles__card:hover .lk-about-articles__title {
  color: #000;
}

.lk-about-articles__excerpt {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: #000;
}

.lk-about-articles__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 0.76rem;
  color: #000;
}

.lk-about-articles__foot-left {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.24rem;
}

.lk-about-articles__foot-dot {
  opacity: 0.55;
}

.lk-about-articles__read {
  font-size: 0.78rem;
  font-weight: 700;
  color: #000;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.18s ease-out, transform 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.lk-about-articles__card:hover .lk-about-articles__read {
  color: #000;
  transform: translateX(2px);
}

@media (max-width: 719px) {
  .lk-about-articles__link {
    grid-template-rows: minmax(130px, 170px) auto;
  }

  .lk-about-articles__body {
    gap: 0.5rem;
    min-height: 112px;
    padding-inline: 0.9rem;
  }

  .lk-about-articles__title {
    font-size: 0.98rem;
  }

  .lk-about-articles__excerpt {
    font-size: 0.84rem;
  }
}

[data-theme='dark'] .lk-about-articles__card {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(222, 226, 230, 0.12);
  --lk-about-card-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
  --lk-about-accent: var(--lk-accent, #DEE2E6);
}

[data-theme='dark'] .lk-about-articles__card:hover {
  border-color: rgba(222, 226, 230, 0.22);
}

[data-theme='dark'] .lk-about-articles__title,
[data-theme='dark'] .lk-about-articles__card:hover .lk-about-articles__title {
  color: #fff;
}

[data-theme='dark'] .lk-about-articles__body {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.92) 36%);
}

[data-theme='dark'] .lk-about-articles__heading {
  color: #fff;
}

[data-theme='dark'] .lk-about-articles__excerpt {
  color: #fff;
}

[data-theme='dark'] .lk-about-articles__foot {
  color: #fff;
  border-top-color: rgba(148, 163, 184, 0.2);
}

[data-theme='dark'] .lk-about-articles__read,
[data-theme='dark'] .lk-about-articles__card:hover .lk-about-articles__read {
  color: #fff;
}

[data-theme='dark'] .lk-about-articles__tag {
  background: rgba(0, 0, 0, 0.55);
  border-color: rgba(255, 255, 255, 0.14);
}
</style>
