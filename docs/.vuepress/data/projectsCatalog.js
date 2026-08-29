import { PROJECT_ROLES } from './projectRoles.js'

export { PROJECT_ROLES }

export const roleMapping = {
  产品运营: 'pm',
  教育产品: 'pm',
  产品策略: 'pm',
  作品集信息架构: 'pm',
  内容产品: 'pm',
  'AI 产品': 'ai-product',
  'AI 效率工具': 'ai-product',
  前端开发: 'frontend',
  作品集前端: 'frontend',
  前端文档: 'frontend',
  交互系统: 'frontend',
  创作者工具: 'backend',
  嵌入式: 'embedded',
  机器人: 'embedded',
  'AI 基础设施': 'ai-engineering',
  'AI 应用': 'ai-engineering',
  边缘机器学习: 'ml',
  机器学习: 'ml',
}

export function roleToId(label) {
  const map = {
    'PM / Product Manager': 'pm',
    'AI Product / AI Product': 'ai-product',
    'Frontend / Frontend': 'frontend',
    'Backend / Backend': 'backend',
    'Embedded / Embedded': 'embedded',
    'AI Engineer / AI Engineering': 'ai-engineering',
    'ML Engineer / ML': 'ml',
  }
  return map[label] || 'pm'
}

export function getProjectRoleId(role) {
  return roleMapping[role] || 'pm'
}

/** 故事视角标签：与职位正交，用于「你想强调的能力叙事」 */
export const PROJECT_FACETS = [
  {
    id: 'ai',
    label: 'AI',
    test(item) {
      const hay = `${item.title}${item.summary}${item.tag}${item.role}`
      return /AI|Agent|LLM|Prompt|生图|模型|RAG|路由|OpenClaw|Infra|机器学习|ML|推理|流水线/i.test(hay)
    },
  },
  {
    id: 'system',
    label: '系统',
    test(item) {
      const hay = `${item.title}${item.summary}${item.tag}${item.role}`
      return /系统|发布|工作流|Infra|Workflow|静态|VuePress|导航|索引|批量|Key|One API/i.test(hay)
    },
  },
  {
    id: 'data',
    label: '数据',
    test(item) {
      const hay = `${item.title}${item.summary}${item.tag}${item.role}`
      return /数据|检索|决策|学校|申请|留学|索引|内容发现/i.test(hay)
    },
  },
  {
    id: 'vision',
    label: '视觉',
    test(item) {
      const hay = `${item.title}${item.summary}${item.tag}${item.role}`
      return /视觉|封面|生图|竞赛|智能车|ICT|边缘|推理|流水线|图像/i.test(hay)
    },
  },
]

import { manualProjectItems } from './projectItems.manual.js'
import { externalProjectItems } from './externalProjectItems.generated.js'

export function applySort(items, sortMode) {
  const arr = [...items]
  if (sortMode === 'featured') {
    arr.sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999))
    return arr
  }
  arr.sort((a, b) => {
    const ta = new Date(a.sortDate || 0).getTime()
    const tb = new Date(b.sortDate || 0).getTime()
    return tb - ta
  })
  return arr
}

/** 全站项目列表：按 sortDate 新→旧（外部仓库新接入的条目会自然排到最前） */
export const projectItems = applySort(
  [...manualProjectItems, ...externalProjectItems],
  'recent',
)

/** /tech/ 详情侧栏与左栏编号：仅含 tech 子路径，顺序与 projectItems 一致 */
export function techDetailProjectItems() {
  return projectItems.filter((item) => {
    const link = item.to.replace(/\.html$/, '')
    return link.startsWith('/tech/') && link !== '/tech'
  })
}

export function itemsAfterRole(items, roleId) {
  if (roleId === 'all') return items
  return items.filter((item) => getProjectRoleId(item.role) === roleId)
}

export function itemsAfterFacet(items, facetId) {
  if (facetId == null) return items
  const facet = PROJECT_FACETS.find((f) => f.id === facetId)
  if (!facet) return items
  return items.filter((item) => facet.test(item))
}
