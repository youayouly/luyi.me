<script setup>
/** 原首页 Hero 下四个入口卡片，迁至「统计」页 */
const items = [
  {
    title: '项目',
    tag: '精选项目',
    details: '以产品、前端和工程实践为主的项目整理与展示。',
    href: '/tech/',
  },
  {
    title: '留学',
    tag: '海外申请',
    details: '记录香港、英国和新加坡申请过程中的信息整理与判断。',
    href: '/study/',
  },
  {
    title: '相册',
    tag: '旅行记录',
    details: '按地点整理的旅行照片与现场观察。',
    href: '/travel/',
  },
  {
    title: '文章',
    tag: '最新随笔',
    details: '围绕产品、工程和 AI 工具的短文与笔记。',
    href: '/article/',
  },
]
</script>

<template>
  <!-- 原入口卡片已隐藏：统计页专注于数据，导航由顶部 navbar 承担 -->
  <div />
</template>

<style scoped>
.lk-stats-hub-inner {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 0.25rem 0.5rem;
  box-sizing: border-box;
}

.lk-stats-hub__lead {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--vp-c-text-2, #64748b);
}

.lk-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 0.25rem 2rem;
  box-sizing: border-box;
}

@media (max-width: 719px) {
  .lk-stats-grid {
    grid-template-columns: 1fr;
  }
}

.lk-stats-card {
  position: relative;
  display: block;
  padding: 1.15rem 1.2rem 1.25rem;
  border-radius: 18px;
  text-decoration: none !important;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.92), rgba(241, 245, 249, 0.86));
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  color: inherit;
  overflow: hidden;
}

.lk-stats-card:hover {
  transform: translateY(-3px);
  border-color: rgba(59, 130, 246, 0.35);
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12);
}

[data-theme='dark'] .lk-stats-card {
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.94));
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
}

.lk-stats-card__tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #0369a1;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.22);
}

[data-theme='dark'] .lk-stats-card__tag {
  color: #7dd3fc;
  background: rgba(14, 165, 233, 0.14);
  border-color: rgba(125, 211, 252, 0.28);
}

.lk-stats-card__title {
  margin: 0.65rem 0 0.45rem;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1, #0f172a);
}

[data-theme='dark'] .lk-stats-card__title {
  color: #f8fafc;
}

.lk-stats-card__details {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--vp-c-text-2, #475569);
}

[data-theme='dark'] .lk-stats-card__details {
  color: #cbd5e1;
}

.lk-stats-card__go {
  position: absolute;
  right: 1rem;
  bottom: 0.85rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #0ea5e9;
  opacity: 0.85;
}

[data-theme='dark'] .lk-stats-card__go {
  color: #38bdf8;
}
</style>
