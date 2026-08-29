import { reactive } from 'vue'

const ROLE_IDS = new Set(['all', 'pm', 'ai-product', 'frontend', 'backend', 'embedded', 'ai-engineering', 'ml'])

/**
 * Projects 页：左侧职位筛选与右侧卡片流共用（跨组件同步）。
 */
export const projectsHub = reactive({
  /** 'all' | 'pm' | 'ai-product' | ... */
  currentRole: 'all',
})

export function useProjectsHub() {
  return projectsHub
}

/** 从 URL ?role= 同步到 hub（与 ProjectCardsGrid / 侧栏共用） */
export function syncHubRoleFromRoute(route) {
  if (!route?.query) return
  const raw = route.query.role
  const q = Array.isArray(raw) ? raw[0] : raw
  if (typeof q === 'string' && ROLE_IDS.has(q)) {
    projectsHub.currentRole = q
  } else {
    projectsHub.currentRole = 'all'
  }
}

export { ROLE_IDS }
