<template>
  <div class="lk-home-side-panel">
    <div class="lk-home-side-panel__shell">
      <VisitorWelcomeCard
        class="lk-home-side-panel__block lk-home-side-panel__block--welcome"
      />
      <ProfileCard
        embedded
        class="lk-home-side-panel__block lk-home-side-panel__block--profile"
      />
      <NoticeCard
        embedded
        class="lk-home-side-panel__block lk-home-side-panel__block--notice"
      />
      <SiteStatsCard
        v-if="!hideSiteStats"
        variant="sidebar"
        embedded
        class="lk-home-side-panel__block lk-home-side-panel__block--stats"
      />
    </div>
  </div>
</template>

<script setup>
import VisitorWelcomeCard from './VisitorWelcomeCard.vue'
import ProfileCard from './ProfileCard.vue'
import NoticeCard from './NoticeCard.vue'
import SiteStatsCard from './SiteStatsCard.vue'

defineProps({
  /** 统计页等场景：由右侧「统计」大卡承接网站数据，隐藏侧栏内小块 */
  hideSiteStats: { type: Boolean, default: false },
})
</script>

<style scoped>
.lk-home-side-panel {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin-inline: auto;
  box-sizing: border-box;
  overflow: hidden;
}

/* 明亮毛玻璃控制面板（与右侧内容区顶对齐） */
.lk-home-side-panel__shell {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 12px 14px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(28px) saturate(1.8);
  -webkit-backdrop-filter: blur(28px) saturate(1.8);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  box-sizing: border-box;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  transform: translateZ(0);
  will-change: transform;
  isolation: isolate;
}

.lk-home-side-panel__block {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* 四块柔和区分：顶边色 + 极淡背景渐变（不抢背景人物） */
:deep(.lk-home-side-panel__block--welcome) {
  border-top: 3px solid rgba(125, 211, 252, 0.85) !important;
  background-image: linear-gradient(
    180deg,
    rgba(186, 230, 253, 0.35) 0%,
    rgba(255, 255, 255, 0.72) 45%
  ) !important;
}

:deep(.lk-home-side-panel__block--profile) {
  border-top: 3px solid rgba(167, 139, 250, 0.8) !important;
  background-image: linear-gradient(
    180deg,
    rgba(221, 214, 254, 0.32) 0%,
    rgba(255, 255, 255, 0.72) 48%
  ) !important;
}

:deep(.lk-home-side-panel__block--notice) {
  border-top: 3px solid rgba(244, 114, 182, 0.75) !important;
  background-image: linear-gradient(
    180deg,
    rgba(252, 231, 243, 0.38) 0%,
    rgba(255, 255, 255, 0.72) 48%
  ) !important;
}

:deep(.lk-home-side-panel__block--stats) {
  border-top: 3px solid rgba(251, 191, 36, 0.82) !important;
  background-image: linear-gradient(
    180deg,
    rgba(254, 243, 199, 0.4) 0%,
    rgba(255, 255, 255, 0.72) 48%
  ) !important;
}

/* Dark mode: align outer shell + welcome/notice blocks with ProfileCard embedded */
[data-theme='dark'] .lk-home-side-panel__shell {
  background: rgba(15, 23, 42, 0.38) !important;
  border: 1px solid rgba(148, 163, 184, 0.22) !important;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

[data-theme='dark'] :deep(.lk-home-side-panel__block--welcome) {
  border-top: 3px solid rgba(167, 139, 250, 0.8) !important;
  background-image: linear-gradient(
    180deg,
    rgba(221, 214, 254, 0.26) 0%,
    rgba(15, 23, 42, 0.34) 48%
  ) !important;
}

[data-theme='dark'] :deep(.lk-home-side-panel__block--notice) {
  border-top: 3px solid rgba(167, 139, 250, 0.8) !important;
  background-image: linear-gradient(
    180deg,
    rgba(221, 214, 254, 0.22) 0%,
    rgba(15, 23, 42, 0.34) 48%
  ) !important;
}
</style>
