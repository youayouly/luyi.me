<template>
  <section class="lk-proj-side" aria-label="按职位筛选与站点概览">
    <div class="lk-proj-side__sticky">
      <div class="lk-proj-side__shell">
        <!-- 📂 分类筛选 -->
        <div class="lk-proj-side__section-label" aria-hidden="true">📂 分类</div>
        <div class="lk-proj-side__pills" role="tablist" aria-label="按职位筛选项目">
          <button
            v-for="opt in roleOptions"
            :key="opt.id"
            type="button"
            class="lk-proj-side__pill"
            :class="{ 'is-active': hub.currentRole === opt.id }"
            role="tab"
            :aria-selected="hub.currentRole === opt.id"
            @click="selectRole(opt.id)"
          >
            <span class="lk-proj-side__pill-text">{{ opt.label }}</span>
            <span class="lk-proj-side__count">{{ opt.count }}</span>
          </button>
        </div>

        <div class="lk-proj-side__divider" aria-hidden="true" />

        <!-- 📊 概览 / 🟢 活跃 -->
        <div class="lk-proj-side__section-label" aria-hidden="true">📊 概览</div>
        <div class="lk-proj-side__stats" aria-label="概览与活跃状态">
          <div class="lk-proj-side__stats-row">
            <span class="lk-proj-side__stats-label">项目</span>
            <span class="lk-proj-side__stats-value">{{ projectCount }} 个</span>
          </div>
          <div class="lk-proj-side__stats-row">
            <span class="lk-proj-side__stats-label">文章</span>
            <span class="lk-proj-side__stats-value">{{ articleCount }} 篇</span>
          </div>
          <div class="lk-proj-side__divider" style="margin: 0.3rem 0;" aria-hidden="true" />
          <div class="lk-proj-side__stats-row">
            <span style="font-size:0.7rem;opacity:0.7">🟢</span>
            <span class="lk-proj-side__stats-label">更新</span>
            <span
              class="lk-proj-side__stats-value lk-proj-side__stats-value--active"
              data-lk-no-translate
              >{{ lastUpdateRelative }}</span
            >
          </div>
        </div>
      </div>

      <AiAssistantWidget class="lk-proj-side__assistant" />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PROJECT_ROLES, projectItems, getProjectRoleId, roleToId } from '../data/projectsCatalog.js'
import { useProjectsHub, syncHubRoleFromRoute } from '../composables/useProjectsHub.js'
import { formatRelativeTime } from '../utils/relativeTimeZh.js'
import { pageLang } from '../utils/pageTranslate.js'
import { SOURCE_LANG } from '../utils/translatePref.js'
import AiAssistantWidget from './AiAssistantWidget.vue'

/** 职位 pill：仅英文（与 URL id 一致） */
const ROLE_PILL_LABELS = {
  all: 'All',
  pm: 'PM',
  'ai-product': 'AI Product',
  frontend: 'Frontend',
  backend: 'Backend',
  embedded: 'Embedded',
  'ai-engineering': 'AI Engineer',
  ml: 'ML',
}

const articleCount = __LK_ARTICLE_COUNT__
const buildTimeIso = __LK_BUILD_TIME_ISO__
const projectCount = projectItems.length

/* 每分钟都在变的字符串，走翻译 API 只会白烧配额，所以按语言直接拼，
 * 对应节点带 data-lk-no-translate。 */
const lastUpdateRelative = computed(() =>
  formatRelativeTime(buildTimeIso, pageLang.value !== SOURCE_LANG),
)

const hub = useProjectsHub()
const route = useRoute()
const router = useRouter()

const roleOptions = computed(() => [
  { id: 'all', label: ROLE_PILL_LABELS.all, count: projectItems.length },
  ...PROJECT_ROLES.map((role) => {
    const id = roleToId(role.label)
    return {
      id,
      label: ROLE_PILL_LABELS[id] || id,
      count: projectItems.filter((item) => getProjectRoleId(item.role) === id).length,
    }
  }),
])

function selectRole(id) {
  hub.currentRole = id
  const query = { ...route.query }
  query.role = id
  router.replace({ path: route.path, query })
}

onMounted(() => {
  syncHubRoleFromRoute(route)
})

watch(
  () => route.query.role,
  () => {
    syncHubRoleFromRoute(route)
  },
)
</script>

<style scoped>
/* ── Section wrapper ──
   跟 about/guestbook 同一套：这一节是 .lk-proj-hub-layout__portfolio（grid
   item，父级 .lk-proj-hub-layout 已是 align-items:stretch）唯一的子元素，
   flex:1 1 auto 让它顺着撑满那个 grid item 的整行高度——height 是「透传」
   下去的，不是自己算出来的，所以在任何缩放/任何一页项目数量下都跟 main 列
   （ProjectCardsGrid）严丝合缝对齐，不用猜一个像素数，也不需要内部滚动条。
   代价是放弃「侧栏跟随滚动吸顶」：跟 about 页同一个取舍（见 index.scss
   .lk-aboutme__side 的注释）——两栏一直对不齐、或吸顶后悬浮盖住下面内容，
   都比翻页时 AI 卡跟着长高一点更糟。 */
.lk-proj-side {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  margin-top: 0.35rem;
  width: 100%;
  min-height: 0;
}

.lk-proj-side__sticky {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  min-height: 0;
}

/* 最后一张卡（AI 问答）吃掉分类卡之外的剩余高度：三个 class 叠起来是为了
   压过 AiAssistantWidget 自己 <style scoped> 里 .lk-ai-asst 规则编译后的
   .lk-ai-asst[data-v-xxxx]——属性选择器和 class 同权重，只用一两个 class
   覆盖不稳（见 ArticleIndexList.vue 同一处注释）。 */
.lk-proj-side__sticky .lk-ai-asst.lk-proj-side__assistant {
  flex: 1 1 auto;
}

/* ── 卡片壳：Notion/GitHub 左侧控制区风格 ── */
.lk-proj-side__shell {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  padding: 0.75rem 0.7rem 0.8rem;
  box-sizing: border-box;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.48);
  box-shadow: 0 4px 24px rgba(2, 6, 23, 0.24);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
}

[data-theme='light'] .lk-proj-side__shell {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(15, 23, 42, 0.07);
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.06);
}

/* ── 分区标签：小型 uppercase kicker ── */
.lk-proj-side__section-label {
  padding: 0.6rem 0.3rem 0.25rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.78);
}

[data-theme='light'] .lk-proj-side__section-label {
  color: rgba(100, 116, 139, 0.7);
}

/* ── 分类 pills 列表 ── */
.lk-proj-side__pills {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.18rem;
}

/* ── 分隔线 ── */
.lk-proj-side__divider {
  height: 1px;
  margin: 0.5rem 0;
  border: 0;
  background: rgba(148, 163, 184, 0.18);
}

[data-theme='light'] .lk-proj-side__divider {
  background: rgba(15, 23, 42, 0.08);
}

/* ── 概览 / 活跃状态 ── */
.lk-proj-side__stats {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  padding: 0 0.15rem;
}

.lk-proj-side__stats-row {
  display: flex;
  align-items: center;
  gap: 0.48rem;
  padding: 0.32rem 0.32rem;
  border-radius: 7px;
  font-size: 0.86rem;
  line-height: 1.4;
  color: rgba(203, 213, 225, 0.9);
}

[data-theme='light'] .lk-proj-side__stats-row {
  color: #475569;
}

.lk-proj-side__stats-emoji {
  flex-shrink: 0;
  font-size: 0.9rem;
  line-height: 1;
}

.lk-proj-side__stats-label {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.86rem;
  color: rgba(226, 232, 240, 0.92);
  min-width: 2.1rem;
}

[data-theme='light'] .lk-proj-side__stats-label {
  color: #334155;
}

.lk-proj-side__stats-value {
  flex: 1;
  min-width: 0;
  font-weight: 500;
  font-size: 0.84rem;
  font-family: var(--lk-font-mono, ui-monospace, monospace);
  color: rgba(148, 163, 184, 0.92);
}

.lk-proj-side__stats-value--active {
  color: rgba(134, 239, 172, 0.92);
}

[data-theme='light'] .lk-proj-side__stats-value {
  color: #64748b;
}

[data-theme='light'] .lk-proj-side__stats-value--active {
  color: #059669;
}

/* ── 筛选 pill 按钮：极简左对齐行 ── */
.lk-proj-side__pill {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  width: 100%;
  padding: 0.46rem 0.68rem;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(203, 213, 225, 0.86);
  font-size: 0.92rem;
  font-weight: 500;
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.lk-proj-side__pill-text {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
  font-size: 0.92rem;
  letter-spacing: 0.005em;
}

[data-theme='light'] .lk-proj-side__pill {
  color: #475569;
}

.lk-proj-side__pill:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(248, 250, 252, 0.95);
}

[data-theme='light'] .lk-proj-side__pill:hover {
  background: rgba(15, 23, 42, 0.05);
  color: #1e293b;
}

/* active：微弱底色 + 深色文字，类似 Notion 侧栏选中态 */
.lk-proj-side__pill.is-active {
  background: rgba(243, 176, 62, 0.15);
  border-color: rgba(243, 176, 62, 0.3);
  color: #fbbf24;
  font-weight: 700;
}

.lk-proj-side__pill.is-active:hover {
  background: rgba(243, 176, 62, 0.22);
}

[data-theme='light'] .lk-proj-side__pill.is-active {
  background: rgba(243, 176, 62, 0.12);
  border-color: rgba(215, 140, 20, 0.28);
  color: #92400e;
}

/* 数量 badge */
.lk-proj-side__count {
  flex-shrink: 0;
  min-width: 1.6rem;
  text-align: right;
  font-family: var(--lk-font-mono, ui-monospace, monospace);
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.7;
  line-height: 1.3;
}

.lk-proj-side__pill.is-active .lk-proj-side__count {
  opacity: 0.85;
}
</style>
