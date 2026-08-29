<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useIsLoggedIn } from '../utils/authGate.js'
import { readSiteApiCreds } from '../utils/siteApiCreds.js'

const publishApiBase = String(
  typeof __LK_PUBLISH_API_URL__ !== 'undefined' ? __LK_PUBLISH_API_URL__ : '',
)

const isLoggedIn = useIsLoggedIn()
const open = ref(false) // 加号面板：添加文章
const pushSheetOpen = ref(false) // 箭头面板：推送管理

// 添加文章表单
const target = ref('article')
const slug = ref('')
const articleTitle = ref('')
const articleExcerpt = ref('')
const content = ref('')
const dragging = ref(false)
const message = ref('')
const messageKind = ref('info')

// 待推送队列
const pendingArticles = ref([])

// 待删除列表
const pendingDeletes = ref([])

// 推送面板
const commitMsg = ref('')
const busy = ref(false)
const pushMessage = ref('')
const pushMessageKind = ref('info')
const isClosing = ref(false) // 新增：跟踪面板是否正在关闭

// 历史记录
const historyRecords = ref([])
const historyExpanded = ref(false)
const historyBusy = ref(false)

// 展开编辑的文章ID
const expandedArticleId = ref(null)

// 【Bug 1 修复】防重入锁
const isUpdatingPendingArticles = ref(false)

// 批量处理标记
const isBatchProcessing = ref(false)

const apiUrl = computed(() => {
  const u = publishApiBase.trim()
  if (u) return u.replace(/\/+$/, '')
  return '/api/publish'
})

const historyUrl = computed(() => {
  const u = publishApiBase.trim()
  if (u) return u.replace(/\/?publish\/?$/i, '/history').replace(/\/+$/, '')
  return '/api/history'
})

function setMsg(text, kind = 'info') {
  message.value = text
  messageKind.value = kind
}

function setPushMsg(text, kind = 'info') {
  pushMessage.value = text
  pushMessageKind.value = kind
}

// 图片计数器，确保每次生成不同的图片
let imageCounter = 0

// 生成基于文章内容的唯一颜色
function generateUniqueColor(text) {
  // 使用字符串哈希生成唯一颜色
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
  }

  // 检测当前主题
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                 document.documentElement.classList.contains('dark')

  // 生成 HSL 颜色
  const hue = Math.abs(hash) % 360

  // 根据主题调整饱和度和亮度
  const saturation = isDark ? (55 + (Math.abs(hash >> 8) % 25)) : (50 + (Math.abs(hash >> 8) % 20))
  const lightness = isDark ? (25 + (Math.abs(hash >> 16) % 20)) : (35 + (Math.abs(hash >> 16) % 15))

  return { hue, saturation, lightness, isDark }
}

// 检测是否是本地开发环境
function isLocalDev() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

// 关键词图标模式（方案B：简洁文字+标签风格，参考图风格）
// 直接使用首字母大字 + 关键词标签，不使用复杂图标
const keywordColors = {
  // AI 相关 - 紫色系
  'AI': { hue: 260, label: 'AI · LLM' },
  'ML': { hue: 270, label: 'ML' },
  'Deep Learning': { hue: 280, label: 'Deep Learning' },
  'LLM': { hue: 265, label: 'LLM' },
  'GPT': { hue: 255, label: 'GPT' },
  'Agent': { hue: 275, label: 'AI · Agent' },
  'Neural Net': { hue: 285, label: 'Neural Net' },
  'Transformer': { hue: 260, label: 'Transformer' },

  // 编程语言 - 蓝色系
  'Python': { hue: 200, label: 'Python' },
  'JavaScript': { hue: 52, label: 'JavaScript' },
  'TypeScript': { hue: 210, label: 'TypeScript' },
  'Vue': { hue: 160, label: 'Vue' },
  'React': { hue: 190, label: 'React' },
  'Node.js': { hue: 120, label: 'Node.js' },
  'Rust': { hue: 25, label: 'Rust' },
  'Go': { hue: 180, label: 'Go' },
  'Java': { hue: 220, label: 'Java' },
  'C++': { hue: 230, label: 'C++' },

  // 技术领域 - 青色系
  'Frontend': { hue: 195, label: 'Frontend' },
  'Backend': { hue: 205, label: 'Backend' },
  'Full Stack': { hue: 200, label: 'Full Stack' },
  'Embedded': { hue: 175, label: 'Embedded' },
  'DevOps': { hue: 170, label: 'DevOps' },
  'Network': { hue: 185, label: 'Network' },
  'Security': { hue: 0, label: 'Security' },
  'Database': { hue: 35, label: 'Database' },
  'Cloud': { hue: 200, label: 'Cloud' },
  'Docker': { hue: 195, label: 'Docker' },
  'K8s': { hue: 215, label: 'K8s' },
  'Git': { hue: 15, label: 'Git' },

  // 硬件相关 - 橙色系
  'MCU': { hue: 30, label: 'MCU' },
  'IoT': { hue: 40, label: 'IoT' },
  'Edge': { hue: 35, label: 'Edge' },
  'GPU': { hue: 120, label: 'GPU' },

  // 其他 - 红色系
  'Algorithm': { hue: 330, label: 'Algorithm' },
  'Architecture': { hue: 340, label: 'Architecture' },
  'Testing': { hue: 145, label: 'Testing' },
  'Performance': { hue: 25, label: 'Performance' },
  'Linux': { hue: 20, label: 'Linux' },
  'Server': { hue: 210, label: 'Server' }
}

// 生成简洁风格的占位图（参考图风格：大字+关键词标签）
function generatePlaceholderImage(title, keywords, width = 1200, height = 800) {
  // 检测当前主题
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                 document.documentElement.classList.contains('dark')

  // 获取主关键词
  const primaryKeyword = keywords[0] || 'TECH'
  const keywordConfig = keywordColors[primaryKeyword]

  // 根据关键词确定颜色
  let hue
  if (keywordConfig) {
    hue = keywordConfig.hue
  } else {
    // 回退：基于标题哈希生成色相
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash)
    }
    hue = Math.abs(hash) % 360
  }

  // 根据主题调整饱和度和亮度
  const sat = isDark ? 72 : 58
  const light = isDark ? 48 : 46

  // 主色调和渐变色
  const mainColor = `hsl(${hue}, ${sat}%, ${light}%)`
  const secondColor = `hsl(${(hue + 30) % 360}, ${sat - 2}%, ${light - 10}%)`

  // 主题适配的颜色
  const textColor = 'rgba(255,255,255,0.9)'
  const watermarkColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.3)'
  const decorColor1 = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)'
  const decorColor2 = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'
  const tagBg = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)'

  // 标题首字母（取前2个字符）
  const titleInitial = title.trim().substring(0, 2).toUpperCase()

  // 关键词标签文字
  const keywordLabel = keywordConfig ? keywordConfig.label : keywords.slice(0, 2).join(' · ')

  // 创建 SVG（参考图风格）
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${mainColor}" />
          <stop offset="100%" style="stop-color:${secondColor}" />
        </linearGradient>
      </defs>

      <!-- 背景 -->
      <rect width="100%" height="100%" fill="url(#bg)"/>

      <!-- 装饰圆圈 -->
      <circle cx="150" cy="150" r="100" fill="${decorColor1}"/>
      <circle cx="${width - 100}" cy="${height - 100}" r="80" fill="${decorColor2}"/>
      <circle cx="${width - 200}" cy="100" r="50" fill="${decorColor2}"/>

      <!-- 标题首字母（大字水印） -->
      <text x="50%" y="40%"
            font-family="Arial, sans-serif"
            font-size="180"
            font-weight="bold"
            fill="${watermarkColor}"
            text-anchor="middle"
            dominant-baseline="middle">
        ${titleInitial}
      </text>

      <!-- 关键词标签（底部居中） -->
      <rect x="50%" y="65%" width="400" height="60" rx="30" fill="${tagBg}" transform="translate(-200, -30)"/>
      <text x="50%" y="65%"
            font-family="Arial, sans-serif"
            font-size="28"
            font-weight="600"
            fill="${textColor}"
            text-anchor="middle"
            dominant-baseline="middle">
        ${keywordLabel}
      </text>
    </svg>
  `

  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`
}

// 提取文章关键词（中文友好）
function extractKeywords(text, maxKeywords = 3) {
  const keywords = []

  // 关键词映射表（原始词 -> 显示词）
  const keywordMap = {
    // AI 相关
    'ai': 'AI', '人工智能': 'AI', '机器学习': 'ML', '深度学习': 'Deep Learning',
    '大模型': 'LLM', 'llm': 'LLM', 'gpt': 'GPT', 'agent': 'Agent',
    '神经网络': 'Neural Net', 'transformer': 'Transformer',

    // 编程语言
    'python': 'Python', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'vue': 'Vue', 'react': 'React', 'node': 'Node.js', 'rust': 'Rust',
    'go': 'Go', 'java': 'Java', 'c++': 'C++',

    // 技术领域
    '前端': 'Frontend', '后端': 'Backend', '全栈': 'Full Stack',
    '嵌入式': 'Embedded', '部署': 'DevOps', '网络': 'Network',
    '安全': 'Security', '数据库': 'Database', '云': 'Cloud',
    'docker': 'Docker', 'kubernetes': 'K8s', 'git': 'Git',

    // 硬件相关
    '单片机': 'MCU', 'iot': 'IoT', '边缘计算': 'Edge', 'gpu': 'GPU',

    // 其他
    '算法': 'Algorithm', '架构': 'Architecture', '测试': 'Testing',
    '性能': 'Performance', 'linux': 'Linux', '服务器': 'Server',
  }

  const lowerText = text.toLowerCase()

  // 匹配关键词
  for (const [key, value] of Object.entries(keywordMap)) {
    if (lowerText.includes(key.toLowerCase()) && !keywords.includes(value)) {
      keywords.push(value)
      if (keywords.length >= maxKeywords) break
    }
  }

  return keywords
}

// 图片生成后端选项
const imageBackendOptions = [
  { value: 'siliconflow', label: '硅基流动（AI生图）', free: false },
  { value: 'dify', label: 'Dify 工作流', free: false },
  { value: 'svg', label: '本地 SVG（免费稳定）', free: true },
  { value: 'pollinations', label: 'Pollinations（免费额度/API Key）', free: true },
  { value: 'unsplash', label: 'Unsplash（照片）', free: true },
  { value: 'cloudflare', label: 'Cloudflare Workers AI', free: true },
  { value: 'huggingface', label: 'Hugging Face（免费）', free: true },
]
const imageBackend = ref('siliconflow')

function shouldAutoGenerateCovers() {
  return imageBackend.value !== 'unsplash'
}

function isPlaceholderCover(cover) {
  if (!cover) return true
  if (cover.startsWith('data:image/svg+xml')) return true
  if (imageBackend.value !== 'svg' && /^\/gallery\/article-cover-.*\.svg(?:$|\?)/i.test(cover)) return true
  return false
}

function formatCoverResultMessage(data, successText = '封面生成成功') {
  if (data.fallbackUsed && data.errors?.length) {
    return `${successText}，但 ${data.backend} 为回退结果：${data.errors.join('；')}`
  }
  return successText
}

// AI 封面生成状态
const generatingCover = ref(false)
const generatedCoverUrl = ref('')

// 立即生成 AI 封面
async function generateCoverNow() {
  const title = articleTitle.value.trim()
  if (!title) {
    setMsg('请先填写标题', 'err')
    return
  }

  generatingCover.value = true
  generatedCoverUrl.value = ''

  try {
    const keywords = extractKeywords(`${title} ${articleExcerpt.value}`)
    const { user, pass } = readSiteApiCreds()

    const res = await fetch('/api/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        keywords,
        summary: articleExcerpt.value.trim() || title,
        backend: imageBackend.value,
        authUser: user,
        authPass: pass,
      }),
    })

    const data = await res.json()

    if (res.ok && data.ok && data.imageUrl) {
      generatedCoverUrl.value = data.imageUrl
      setMsg(
        data.localSaved
          ? formatCoverResultMessage(data, `封面已保存到本地: ${data.localPath}`)
          : formatCoverResultMessage(data),
        data.fallbackUsed && data.errors?.length ? 'err' : 'ok',
      )
      console.log(`📷 [封面生成] 成功: ${data.imageUrl}`)
      if (data.fallbackUsed) {
        console.warn('📷 [封面生成] 使用回退后端:', data.backend, data.errors)
      }
      if (data.localSaved) {
        console.log(`  - 本地路径: ${data.localPath}`)
      }
    } else {
      setMsg(`生成失败: ${data.error || '未知错误'}`, 'err')
    }
  } catch (e) {
    setMsg(`请求失败: ${e.message}`, 'err')
  } finally {
    generatingCover.value = false
  }
}

// 使用生成的封面（应用到当前展开编辑的文章，如果没有则应用到第一篇）
function useGeneratedCover() {
  if (generatedCoverUrl.value) {
    // 优先应用到当前展开编辑的文章
    let targetArticle = null
    if (expandedArticleId.value) {
      targetArticle = pendingArticles.value.find(a => a.id === expandedArticleId.value)
    }
    // 如果没有展开的文章，应用到第一篇
    if (!targetArticle && pendingArticles.value.length > 0) {
      targetArticle = pendingArticles.value[0]
    }

    if (targetArticle) {
      targetArticle.cover = generatedCoverUrl.value
      setMsg(`已应用到「${targetArticle.title}」`, 'ok')
      console.log(`📷 [应用封面] 应用到: ${targetArticle.title}`)
    }
    generatedCoverUrl.value = ''
  }
}

// 生成封面URL
function generateCoverUrl(title, excerpt, content = '', forceUnique = false) {
  const fullText = `${title} ${excerpt} ${content || ''}`
  const keywords = extractKeywords(fullText)

  // 本地开发环境：使用带关键词的占位图
  if (isLocalDev()) {
    return generatePlaceholderImage(title, keywords)
  }

  // 生产环境：根据用户选择的后端生成图片
  imageCounter++

  // 基于标题生成唯一哈希
  let titleHash = 0
  for (let i = 0; i < title.length; i++) {
    titleHash = title.charCodeAt(i) + ((titleHash << 5) - titleHash)
  }
  const hashSeed = Math.abs(titleHash).toString(36)

  // 种子：标题哈希 + 计数器 + 随机后缀（强制唯一时增加更多随机性）
  const randomSuffix = forceUnique
    ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    : Math.random().toString(36).slice(2, 6)
  const seed = `${hashSeed}-${imageCounter}-${randomSuffix}`

  console.log(`📷 [图片生成] 标题: ${title}`)
  console.log(`  - 后端: ${imageBackend.value}`)
  console.log(`  - 关键词: ${keywords.join(', ')}`)

  // Unsplash（默认）
  if (imageBackend.value === 'unsplash') {
    const unsplashKeywords = keywords.length > 0
      ? keywords.map(k => k.toLowerCase().replace(' ', '-')).join(',')
      : 'technology'
    return `https://source.unsplash.com/1200x800/?${unsplashKeywords}&sig=${encodeURIComponent(seed)}`
  }

  // AI 生图后端：返回占位图，实际生成在推送时异步调用 API
  // 因为图片生成需要时间，这里先返回占位图，API 调用在 doPush 中处理
  return generatePlaceholderImage(title, keywords)
}

// 异步生成 AI 封面图
async function generateAICover(title, keywords, summary) {
  try {
    const { user, pass } = readSiteApiCreds()
    const res = await fetch('/api/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        keywords,
        summary: summary || title,
        backend: imageBackend.value,
        authUser: user,
        authPass: pass,
      }),
    })
    const data = await res.json()
    if (res.ok && data.ok && data.imageUrl) {
      console.log(`📷 [AI生图] 成功: ${data.imageUrl.substring(0, 60)}...`)
      return data.imageUrl
    } else {
      console.error(`📷 [AI生图] 失败:`, data.error)
      return null
    }
  } catch (e) {
    console.error(`📷 [AI生图] 异常:`, e)
    return null
  }
}

// 检查待推送队列中是否有重复封面
function checkPendingCovers() {
  const coverMap = new Map()
  const duplicates = []

  pendingArticles.value.forEach(article => {
    if (coverMap.has(article.cover)) {
      duplicates.push({
        cover: article.cover,
        articles: [coverMap.get(article.cover), article.title]
      })
    } else {
      coverMap.set(article.cover, article.title)
    }
  })

  return duplicates
}

// 为重复封面的文章重新生成封面
function regenerateDuplicateCovers() {
  const coverMap = new Map()
  let regenerated = 0

  pendingArticles.value.forEach(article => {
    if (coverMap.has(article.cover)) {
      // 发现重复，重新生成封面
      const newCover = generateCoverUrl(article.title, article.excerpt, article.content, true)
      article.cover = newCover
      regenerated++
      console.log(`📷 [重新生成] "${article.title}" 的封面已更新`)
    } else {
      coverMap.set(article.cover, article.title)
    }
  })

  if (regenerated > 0) {
    setMsg(`已为 ${regenerated} 篇文章重新生成唯一封面`, 'ok')
  }

  return regenerated
}

// 重新生成单篇文章的封面（异步调用 Dify）
async function regenerateArticleCover(articleId) {
  console.log(`📷 [重新生成] 收到 articleId: ${articleId}`)
  console.log(`📷 [重新生成] 当前队列:`, pendingArticles.value.map(a => ({ id: a.id, title: a.title, slug: a.slug })))

  const article = pendingArticles.value.find(a => a.id === articleId)
  if (!article) {
    console.error(`📷 [重新生成] 未找到文章: ${articleId}`)
    return
  }

  const keywords = extractKeywords(`${article.title} ${article.excerpt}`)
  const summary = article.excerpt || article.title

  console.log(`📷 [重新生成] 找到文章:`, { id: article.id, title: article.title, slug: article.slug })
  console.log(`📷 [重新生成] "${article.title}" 调用 Dify...`)
  console.log(`📷 [重新生成] 发送数据:`, { title: article.title, keywords, summary })

  try {
    const { user, pass } = readSiteApiCreds()
    const requestBody = {
      title: article.title,
      keywords,
      summary,
      backend: imageBackend.value,
      authUser: user,
      authPass: pass,
    }
    console.log(`📷 [重新生成] 请求体:`, { title: requestBody.title, keywords: requestBody.keywords, summary: requestBody.summary, backend: requestBody.backend })

    const res = await fetch('/api/cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = await res.json()
    if (res.ok && data.ok && data.imageUrl) {
      if (data.fallbackUsed) {
        console.warn(`📷 [重新生成] "${article.title}" 使用回退后端:`, data.backend, data.errors)
        setMsg(`封面回退生成：${data.errors?.join('；') || data.backend}`, 'err')
        return
      }
      article.cover = data.imageUrl
      console.log(`📷 [重新生成] "${article.title}" 成功: ${data.imageUrl}`)
    } else {
      console.error(`📷 [重新生成] "${article.title}" 失败:`, data.error)
    }
  } catch (e) {
    console.error(`📷 [重新生成] "${article.title}" 异常:`, e)
  }
}

// 检测重复图片（供用户调用）
function checkDuplicateImages() {
  const items = document.querySelectorAll('.lk-blog__item:not(.lk-blog__item--preview)')
  const imageMap = new Map()
  const duplicates = []

  items.forEach(item => {
    const img = item.querySelector('.lk-blog__cover')
    const title = item.querySelector('.lk-blog__post-title')?.textContent || '未知'
    if (img && img.src) {
      if (imageMap.has(img.src)) {
        duplicates.push({
          image: img.src,
          articles: [imageMap.get(img.src), title]
        })
      } else {
        imageMap.set(img.src, title)
      }
    }
  })

  console.log('\n📷 [图片重复检测]')
  console.log(`  - 文章总数: ${items.length}`)
  console.log(`  - 唯一图片: ${imageMap.size}`)

  if (duplicates.length > 0) {
    console.log(`  - ⚠️ 发现重复图片: ${duplicates.length} 组`)
    duplicates.forEach((d, i) => {
      console.log(`\n  重复组 ${i + 1}:`)
      console.log(`    图片: ${d.image}`)
      console.log(`    文章: ${d.articles.join(', ')}`)
    })
  } else {
    console.log(`  - ✅ 没有发现重复图片`)
  }

  return { total: items.length, unique: imageMap.size, duplicates }
}

// 暴露到全局供控制台调用
if (typeof window !== 'undefined') {
  window.checkDuplicateImages = checkDuplicateImages
  window.regenerateDuplicateCovers = regenerateDuplicateCovers
  console.log('💡 提示: 运行 checkDuplicateImages() 检测重复，regenerateDuplicateCovers() 重新生成')
}

// 从markdown提取标题
function extractTitle(text) {
  const fmMatch = text.match(/^---\n[\s\S]*?\ntitle:\s*["']?(.+?)["']?\n[\s\S]*?\n---/)
  if (fmMatch) return fmMatch[1].trim()
  const h1Match = text.match(/^#\s+(.+)$/m)
  if (h1Match) return h1Match[1].trim()
  return ''
}

// 从markdown提取摘要
function extractExcerpt(text) {
  let body = text.replace(/^---\n[\s\S]*?\n---\n*/, '')
  body = body.replace(/^#+\s+.*$/gm, '')
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('<!--') && !trimmed.startsWith('![') && trimmed.length > 10) {
      return trimmed.slice(0, 80) + (trimmed.length > 80 ? '...' : '')
    }
  }
  return ''
}

// 拖入文件处理
function onDrop(e) {
  e.preventDefault()
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length === 0) return

  const mdFiles = files.filter(f => /\.md$/i.test(f.name))
  if (mdFiles.length === 0) {
    setMsg('请拖入 .md 文件', 'err')
    return
  }

  void readFiles(mdFiles)
}

function onDragOver(e) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onFileInput(e) {
  const file = e.target?.files?.[0]
  if (file) void readFile(file)
  e.target.value = ''
}

async function readFile(file) {
  try {
    const text = await file.text()
    const extractedTitle = extractTitle(text)
    const extractedExcerpt = extractExcerpt(text)
    const fileSlug = file.name.replace(/\.md$/i, '').toLowerCase()

    const now = new Date()
    const dateStr = now.toISOString()

    // 使用更唯一的 ID：时间戳 + 随机数
    const articleId = `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Dify 后端：使用占位图，稍后自动生成真实封面
    // 其他后端：直接生成封面 URL
    const shouldAutoGenerate = shouldAutoGenerateCovers()
    const cover = shouldAutoGenerate
      ? generatePlaceholderImage(extractedTitle || fileSlug, [])
      : generateCoverUrl(extractedTitle || fileSlug, extractedExcerpt || '', text)

    const article = {
      id: articleId,
      slug: fileSlug,
      title: extractedTitle || fileSlug,
      excerpt: extractedExcerpt || '暂无摘要',
      content: text,
      date: dateStr,
      cover,
      target: target.value,
    }

    // 【Bug 1 修复】入队前去重
    if (pendingArticles.value.some(item => item.slug === article.slug)) {
      setMsg(`「${article.slug}」已在待推送队列中`, 'err')
      return
    }

    pendingArticles.value.unshift(article)

    // 更新表单显示最新文章的信息（不关闭面板）
    slug.value = article.slug
    articleTitle.value = article.title
    articleExcerpt.value = article.excerpt
    content.value = article.content

    setMsg(`已添加「${article.title}」（共${pendingArticles.value.length}篇待推送）`, 'ok')

    // Dify 后端：自动生成真实封面（不等待，后台执行）
    if (shouldAutoGenerate) {
      autoGenerateCover(articleId)
    }
  } catch {
    setMsg('读取文件失败', 'err')
  }
}

// 读取多个文件（快速添加所有文件，然后后台生成封面）
async function readFiles(files) {
  const articleIds = []

  // 快速读取所有文件并添加到列表
  for (const file of files) {
    if (/\.md$/i.test(file.name)) {
      const articleId = await readFileQuick(file)
      if (articleId) {
        articleIds.push(articleId)
      }
    }
  }

  // 所有文件添加完后，按顺序生成封面（从下到上，即先拖入的文件先处理）
  if (articleIds.length > 0 && shouldAutoGenerateCovers()) {
    console.log(`📷 [批量处理] 开始按顺序生成 ${articleIds.length} 篇文章的封面`)
    console.log(`📷 [批量处理] 处理顺序:`, articleIds)
    // 标记正在批量处理
    isBatchProcessing.value = true
    // 直接使用原数组，因为最后一个拖入的文件会排在数组前面
    // 不使用await，让它们自然加入队列
    for (const articleId of articleIds) {
      autoGenerateCover(articleId)
    }
  }
}

// 快速读取文件（不等待封面生成）
async function readFileQuick(file) {
  try {
    const text = await file.text()
    const extractedTitle = extractTitle(text)
    const extractedExcerpt = extractExcerpt(text)
    const fileSlug = file.name.replace(/\.md$/i, '').toLowerCase()

    const now = new Date()
    const dateStr = now.toISOString()

    // 使用更唯一的 ID：时间戳 + 随机数
    const articleId = `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Dify 后端：使用占位图，稍后自动生成真实封面
    const shouldAutoGenerate = shouldAutoGenerateCovers()
    const cover = shouldAutoGenerate
      ? generatePlaceholderImage(extractedTitle || fileSlug, [])
      : generateCoverUrl(extractedTitle || fileSlug, extractedExcerpt || '', text)

    const article = {
      id: articleId,
      slug: fileSlug,
      title: extractedTitle || fileSlug,
      excerpt: extractedExcerpt || '暂无摘要',
      content: text,
      date: dateStr,
      cover,
      target: target.value,
    }

    // 入队前去重
    if (pendingArticles.value.some(item => item.slug === article.slug)) {
      setMsg(`「${article.slug}」已在待推送队列中`, 'err')
      return null
    }

    pendingArticles.value.unshift(article)
    setMsg(`已添加「${article.title}」（共${pendingArticles.value.length}篇待推送）`, 'ok')

    return articleId
  } catch {
    setMsg('读取文件失败', 'err')
    return null
  }
}

// 手动添加文章
function addManualArticle() {
  const s = slug.value.trim().toLowerCase()
  // 支持：小写字母、数字、连字符、中文
  if (!/^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5-]{0,100}$/.test(s)) {
    setMsg('请填写有效的文件名（支持中文、字母、数字、连字符）', 'err')
    return
  }
  if (!articleTitle.value.trim()) {
    setMsg('请填写标题', 'err')
    return
  }
  if (!articleExcerpt.value.trim()) {
    setMsg('请填写摘要', 'err')
    return
  }

  // 【Bug 1 修复】入队前去重
  if (pendingArticles.value.some(item => item.slug === s)) {
    setMsg(`「${s}」已在待推送队列中`, 'err')
    return
  }

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 16).replace('T', ' ')
  // 使用更唯一的 ID：时间戳 + 随机数
  const articleId = `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 优先使用已生成的封面
  let cover = generatedCoverUrl.value
  generatedCoverUrl.value = ''

  // 先添加到队列（用占位图或已生成的封面）
  pendingArticles.value.unshift({
    id: articleId,
    slug: s,
    title: articleTitle.value.trim(),
    excerpt: articleExcerpt.value.trim(),
    content: content.value,
    date: dateStr,
    cover: cover || generatePlaceholderImage(articleTitle.value, extractKeywords(`${articleTitle.value} ${articleExcerpt.value}`)),
    target: target.value,
  })

  // 清空表单（不关闭面板）
  slug.value = ''
  articleTitle.value = ''
  articleExcerpt.value = ''
  content.value = ''

  setMsg(`已添加（共${pendingArticles.value.length}篇待推送）`, 'ok')

  // Dify 后端：自动生成真实封面（如果没有手动生成的封面）
  if (!cover && shouldAutoGenerateCovers()) {
    console.log(`📷 [手动添加] 触发自动生成封面, articleId: ${articleId}`)
    autoGenerateCover(articleId)
  }
}

// 封面生成队列（串行执行）
let coverQueue = []
let isGeneratingCover = false

// 处理封面生成队列（串行执行，按FIFO顺序）
async function processCoverQueue() {
  if (isGeneratingCover || coverQueue.length === 0) {
    return
  }

  isGeneratingCover = true

  // 记录队列初始状态
  console.log(`📷 [队列处理] 开始处理队列，长度: ${coverQueue.length}`)
  coverQueue.forEach((item, i) => {
    console.log(`  [${i}] articleId: ${item.articleId}`)
  })

  while (coverQueue.length > 0) {
    // 使用 shift() 确保FIFO顺序（先进先出）
    const { articleId, resolve } = coverQueue.shift()

    console.log(`📷 [自动生成] 处理 articleId: ${articleId}, 队列剩余: ${coverQueue.length}`)

    const article = pendingArticles.value.find(a => a.id === articleId)
    if (!article) {
      console.log(`📷 [自动生成] 文章已移除: ${articleId}`)
      resolve(null)
      continue
    }

    // 检查是否已有真实封面（非占位图）
    if (!isPlaceholderCover(article.cover)) {
      console.log(`📷 [自动生成] 文章已有封面，跳过: ${article.title}`)
      resolve(article.cover)
      continue
    }

    const articleTitle_text = article.title
    const keywords = extractKeywords(`${article.title} ${article.excerpt}`)
    const summary = article.excerpt || article.title

    console.log(`📷 [自动生成] 生成中: "${articleTitle_text}"`)

    try {
      const { user, pass } = readSiteApiCreds()
      const requestBody = {
        title: articleTitle_text,
        keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        summary,
        backend: imageBackend.value,
        authUser: user,
        authPass: pass,
      }

      // 添加超时控制（60秒超时）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const res = await fetch('/api/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await res.json()
      if (res.ok && data.ok && data.imageUrl) {
        if (data.fallbackUsed) {
          console.warn(`📷 [自动生成] "${articleTitle_text}" 使用回退后端:`, data.backend, data.errors)
          setMsg(`封面生成失败，已阻止回退封面发布：${data.errors?.join('；') || data.backend}`, 'err')
          resolve(null)
          continue
        }
        // 重新查找文章（可能在等待期间被移除）
        const currentArticle = pendingArticles.value.find(a => a.id === articleId)
        if (currentArticle) {
          currentArticle.cover = data.imageUrl
          console.log(`📷 [自动生成] "${articleTitle_text}" 成功: ${data.imageUrl}`)
          console.log('📷 [自动生成] 当前所有文章封面:')
          pendingArticles.value.forEach((a, i) => {
            console.log(`  [${i}] slug: ${a.slug}, cover: ${a.cover?.substring(0, 50)}...`)
          })
        }
        resolve(data.imageUrl)
      } else {
        console.error(`📷 [自动生成] "${articleTitle_text}" 失败:`, data.error)
        resolve(null)
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error(`📷 [自动生成] "${articleTitle_text}" 超时: 请求超过60秒`)
      } else {
        console.error(`📷 [自动生成] "${articleTitle_text}" 异常:`, e)
      }
      resolve(null)
    }

    // 短暂延迟，避免请求过快
    if (coverQueue.length > 0) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  isGeneratingCover = false
  console.log(`📷 [自动生成] 队列处理完成`)

  // 检查批量处理是否完成
  checkBatchCompletion()
}

// 检查批量处理是否完成
function checkBatchCompletion() {
  if (!isBatchProcessing.value) return

  // 检查是否所有文章都已有真实封面
  const allHaveCovers = pendingArticles.value.every(article => {
    return !isPlaceholderCover(article.cover)
  })

  console.log(`📷 [批量完成检查] pendingArticles: ${pendingArticles.value.length}, allHaveCovers: ${allHaveCovers}`)

  if (allHaveCovers && pendingArticles.value.length > 0) {
    console.log('📷 [批量完成] 所有封面已生成，准备自动关闭面板')
    isBatchProcessing.value = false

    if (!commitMsg.value.trim()) {
      commitMsg.value = buildDefaultCommitMessage()
    }

    // 延迟切换到推送面板，确保所有封面都显示出来
    setTimeout(() => {
      open.value = false
      pushSheetOpen.value = true
      loadHistory()
      console.log('📷 [自动收尾] 已切换到推送面板，准备提交本次改动')
    }, 2000)
  }
}


// 自动生成封面（加入队列，串行执行，FIFO顺序）
function autoGenerateCover(articleId) {
  console.log(`📷 [自动生成] 加入队列: ${articleId}, 当前队列长度: ${coverQueue.length}`)

  return new Promise((resolve) => {
    // push() 确保新加入的项目在队列末尾（先进先出）
    coverQueue.push({ articleId, resolve })
    console.log(`📷 [自动生成] 入队完成，队列:`, coverQueue.map(q => q.articleId))
    // 触发队列处理
    processCoverQueue()
  })
}

function removePendingArticle(id) {
  pendingArticles.value = pendingArticles.value.filter(a => a.id !== id)
}

// 展开/收起文章编辑
function toggleExpandArticle(id) {
  expandedArticleId.value = expandedArticleId.value === id ? null : id
}

// 更新待推送文章
function updatePendingArticle(id, field, value) {
  const article = pendingArticles.value.find(a => a.id === id)
  if (article) {
    article[field] = value
  }
}

// 添加待删除文章（供外部调用）
function addPendingDelete(slug, title) {
  if (!pendingDeletes.value.find(d => d.slug === slug)) {
    pendingDeletes.value.push({ id: `del-${Date.now()}`, slug, title })
  }
}

// 移除待删除文章
function removePendingDelete(id) {
  pendingDeletes.value = pendingDeletes.value.filter(d => d.id !== id)
}

// 暴露给其他组件
defineExpose({
  addPendingDelete,
  pendingArticles,
  pendingDeletes
})

// 插入预览卡片到列表开头
function insertPreviewCards() {
  if (typeof document === 'undefined') return

  const list = document.querySelector('.lk-blog__list')
  if (!list) return

  // 移除旧的预览卡片
  list.querySelectorAll('.lk-blog__item--preview').forEach(el => el.remove())

  // 如果没有待推送文章，直接返回
  if (pendingArticles.value.length === 0) return

  // 获取已存在的文章slug和对应的DOM元素
  const existingItems = new Map()
  list.querySelectorAll('.lk-blog__item:not(.lk-blog__item--preview)').forEach(item => {
    const link = item.querySelector('a.lk-blog__card')
    if (link) {
      const href = link.getAttribute('href') || ''
      const match = href.match(/\/(article|tech)\/(.+)\.html/)
      if (match) {
        existingItems.set(match[2], item)
      }
    }
  })
  const existingCount = existingItems.size

  // 【诊断日志】打印当前文章数据
  console.log('📷 [预览卡片] 准备渲染文章:')
  pendingArticles.value.forEach((article, i) => {
    console.log(`  [${i}] slug: ${article.slug}, title: ${article.title}, cover: ${article.cover?.substring(0, 50)}...`)
  })

  // 反转顺序插入，这样最新的在最前面
  const reversedArticles = [...pendingArticles.value].reverse()

  // 首先移除已存在文章的旧卡片（将被预览卡片替换）
  pendingArticles.value.forEach(article => {
    const existingItem = existingItems.get(article.slug)
    if (existingItem) {
      existingItem.remove()
      console.log(`📷 [预览卡片] 移除旧卡片: ${article.slug}`)
    }
  })

  // 计算当前列表中的文章数量（移除旧卡片后）
  const currentItems = list.querySelectorAll('.lk-blog__item:not(.lk-blog__item--preview)')

  reversedArticles.forEach((article, revIndex) => {
    // 计算实际显示位置
    const displayIndex = currentItems.length + (reversedArticles.length - 1 - revIndex)
    const isReverse = displayIndex % 2 === 1

    // 转义HTML特殊字符防止XSS
    const escapeHtml = (str) => {
      const div = document.createElement('div')
      div.textContent = str
      return div.innerHTML
    }

    // 判断是更新还是新增
    const isUpdate = existingItems.has(article.slug)

    // 【诊断日志】打印每个卡片创建时的数据
    console.log(`📷 [预览卡片] 创建卡片: slug=${article.slug}, cover=${article.cover?.substring(0, 50)}..., isUpdate=${isUpdate}`)

    const li = document.createElement('li')
    li.className = `lk-blog__item lk-blog__item--preview${isReverse ? ' lk-blog__item--reverse' : ''}${isUpdate ? ' lk-blog__item--update' : ''}`
    li.setAttribute('data-slug', article.slug)
    li.setAttribute('data-preview', 'true')
    li.innerHTML = `
      <button type="button" class="lk-preview-delete" title="移除">×</button>
      <a class="lk-blog__card" href="/${article.target}/${article.slug}.html">
        ${!isReverse ? `
          <div class="lk-blog__text">
            <time class="lk-blog__date">${escapeHtml(article.date)}</time>
            <h3 class="lk-blog__post-title">${escapeHtml(article.title)}</h3>
            <p class="lk-blog__excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="lk-blog__meta">
              <span class="lk-blog__tag">${isUpdate ? '待更新' : '待推送'}</span>
            </div>
          </div>
          <img class="lk-blog__cover" src="${article.cover}" alt="" onerror="this.style.display='none'" />
        ` : `
          <img class="lk-blog__cover" src="${article.cover}" alt="" onerror="this.style.display='none'" />
          <div class="lk-blog__text">
            <time class="lk-blog__date">${escapeHtml(article.date)}</time>
            <h3 class="lk-blog__post-title">${escapeHtml(article.title)}</h3>
            <p class="lk-blog__excerpt">${escapeHtml(article.excerpt)}</p>
            <div class="lk-blog__meta">
              <span class="lk-blog__tag">${isUpdate ? '待更新' : '待推送'}</span>
            </div>
          </div>
        `}
      </a>
    `
    li.querySelector('.lk-preview-delete').addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      removePendingArticle(article.id)
    })
    list.insertBefore(li, list.firstChild)
  })
}

// 移除预览卡片
function removePreviewCards() {
  if (typeof document === 'undefined') return
  const list = document.querySelector('.lk-blog__list')
  if (list) {
    list.querySelectorAll('.lk-blog__item--preview').forEach(el => el.remove())
  }
}

// 【Bug 1 修复】监听pendingArticles变化，更新预览卡片
// 使用防抖避免快速更新时的重复渲染
let previewUpdateTimer = null
watch(pendingArticles, (val) => {
  // 清除之前的定时器
  if (previewUpdateTimer) {
    clearTimeout(previewUpdateTimer)
  }

  // 防抖：100ms 后更新预览卡片
  previewUpdateTimer = setTimeout(() => {
    if (val.length === 0) {
      removePreviewCards()
    } else {
      // 重建所有预览卡片（会移除旧的并插入新的）
      insertPreviewCards()
      console.log('📷 [预览卡片] 已更新，文章数:', val.length)
    }
    previewUpdateTimer = null
  }, 100)
}, { deep: true })

function buildDefaultCommitMessage() {
  const parts = []

  if (pendingArticles.value.length > 0) {
    const articleTitles = pendingArticles.value
      .slice(0, 3)
      .map(article => article.title || article.slug)
      .filter(Boolean)
    const articlePart = articleTitles.length > 0
      ? `新增 ${articleTitles.join('、')}${pendingArticles.value.length > 3 ? ' 等文章' : ''}`
      : `新增 ${pendingArticles.value.length} 篇文章`
    parts.push(articlePart)
  }

  if (pendingDeletes.value.length > 0) {
    const deleteTitles = pendingDeletes.value
      .slice(0, 3)
      .map(article => article.title || article.slug)
      .filter(Boolean)
    const deletePart = deleteTitles.length > 0
      ? `删除 ${deleteTitles.join('、')}${pendingDeletes.value.length > 3 ? ' 等文章' : ''}`
      : `删除 ${pendingDeletes.value.length} 篇文章`
    parts.push(deletePart)
  }

  if (parts.length === 0) return '更新站点内容'
  return parts.join('；')
}

// 打开推送面板
function openPushSheet() {
  if (!isLoggedIn.value) return
  if (!commitMsg.value.trim() && (pendingArticles.value.length > 0 || pendingDeletes.value.length > 0)) {
    commitMsg.value = buildDefaultCommitMessage()
  }
  pushSheetOpen.value = true
  open.value = false
  loadHistory()
}

// 加载历史记录
async function loadHistory() {
  const { user, pass } = readSiteApiCreds()
  if (!user || !pass) {
    setPushMsg('请先登录', 'err')
    return
  }

  historyBusy.value = true
  try {
    // 获取最近的提交历史
    const res = await fetch('/api/git-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUser: user, authPass: pass, count: 10 }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      historyRecords.value = data.commits || []
    }
  } catch {
    // 忽略错误
  } finally {
    historyBusy.value = false
  }
}

// 【Bug 3 修复】事件处理函数（用于移除监听）
function handleAddPendingDelete(e) {
  console.log('🔍 [PublishFab] handleAddPendingDelete 被调用')
  console.log('  - e.detail:', e.detail)
  const { slug, title } = e.detail
  if (!pendingDeletes.value.find(d => d.slug === slug)) {
    pendingDeletes.value.push({ id: `del-${Date.now()}`, slug, title })
    console.log('  - 已添加到 pendingDeletes:', pendingDeletes.value.length)
    console.log('  - 当前 pendingDeletes:', JSON.stringify(pendingDeletes.value))
  } else {
    console.log('  - 已存在，跳过')
  }
}

function handleClearPendingDeletes() {
  console.log('🔍 [PublishFab] handleClearPendingDeletes 被调用')
  pendingDeletes.value = []
}

function handleOpenPushSheet() {
  console.log('🔍 [PublishFab] handleOpenPushSheet 被调用')
  openPushSheet()
}

function handleOpenPublishPanel() {
  open.value = true
}

// 推送到Vercel
async function doPush() {
  console.log('🔍 [PublishFab] doPush 开始执行')
  console.log('  - commitMsg:', commitMsg.value.trim())
  console.log('  - pendingArticles.length:', pendingArticles.value.length)
  console.log('  - pendingDeletes.length:', pendingDeletes.value.length)

  const cm = commitMsg.value.trim() || buildDefaultCommitMessage()
  if (!commitMsg.value.trim()) {
    commitMsg.value = cm
  }
  const { user, pass } = readSiteApiCreds()
  console.log('  - 认证状态:', !!(user && pass))
  if (!user || !pass) {
    setPushMsg('请先登录', 'err')
    return
  }

  const totalPending = pendingArticles.value.length
  const totalDeletes = pendingDeletes.value.length
  console.log('  - totalPending:', totalPending, 'totalDeletes:', totalDeletes)

  if (totalPending === 0 && totalDeletes === 0) {
    // 没有待处理项，执行普通推送
    busy.value = true
    setPushMsg('推送中...', 'info')
    try {
      const res = await fetch('/api/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authUser: user, authPass: pass, message: cm }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        if (data.noChanges) {
          setPushMsg('没有改动需要推送', 'info')
        } else {
          setPushMsg(data.commitSha ? `推送成功：${data.commitSha}，Vercel正在部署...` : '推送成功！Vercel正在部署...', 'ok')
          loadHistory()
        }
      } else {
        setPushMsg(data.error || '推送失败', 'err')
      }
    } catch (e) {
      setPushMsg(e?.message || '网络错误', 'err')
    } finally {
      busy.value = false
    }
    return
  }

  busy.value = true
  setPushMsg('推送中...', 'info')

  let addCount = 0
  let delCount = 0
  let failCount = 0
  const errors = []
  const successIds = [] // 成功推送的文章ID
  const successDeleteIds = [] // 成功删除的ID

  // 处理冲突：如果文章同时在待推送和待删除列表，从两边都移除
  const pendingSlugs = new Set(pendingArticles.value.map(a => a.slug))
  const deleteSlugs = new Set(pendingDeletes.value.map(d => d.slug))
  const conflictSlugs = [...pendingSlugs].filter(s => deleteSlugs.has(s))

  if (conflictSlugs.length > 0) {
    // 移除冲突项
    pendingArticles.value = pendingArticles.value.filter(a => !conflictSlugs.includes(a.slug))
    pendingDeletes.value = pendingDeletes.value.filter(d => !conflictSlugs.includes(d.slug))
    console.log('[Publish] 检测到冲突，已移除:', conflictSlugs)
  }

  try {
    // 批量推送待推送文章（一次性提交）
    if (pendingArticles.value.length > 0) {
      console.log(`📤 [批量推送] 正在推送 ${pendingArticles.value.length} 篇文章...`)

      try {
        const res = await fetch('/api/publish-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authUser: user,
            authPass: pass,
            commitMessage: cm,
            articles: pendingArticles.value.map(article => ({
              target: article.target,
              filename: `${article.slug}.md`,
              title: article.title,
              excerpt: article.excerpt,
              content: article.content,
              cover: article.cover,
            })),
          }),
        })
        const data = await res.json().catch(() => ({}))

        if (res.ok && data.ok) {
          addCount = data.count || pendingArticles.value.length
          pendingArticles.value.forEach(a => successIds.push(a.id))
          console.log(`✅ [批量推送] 成功: ${addCount} 篇文章, commit: ${data.commitSha}`)
        } else {
          failCount = pendingArticles.value.length
          errors.push(`批量发布失败: ${data.error || '未知错误'}`)
          console.error(`❌ [批量推送] 失败:`, data.error)
        }
      } catch (e) {
        failCount = pendingArticles.value.length
        errors.push('批量发布网络错误')
        console.error(`❌ [批量推送] 网络错误:`, e)
      }
    }

    // 删除待删除文章（一次性批量删除）
    if (pendingDeletes.value.length > 0) {
      const slugs = pendingDeletes.value.map(d => d.slug)

      console.log(`🗑️ [批量删除] 正在删除 ${slugs.length} 篇文章...`)

      try {
        const res = await fetch('/api/delete-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authUser: user,
            authPass: pass,
            target: 'article',
            slugs,
          }),
        })
        const data = await res.json().catch(() => ({}))

        console.log('🗑️ [批量删除] 响应:', { status: res.status, ok: data.ok, deleted: data.deleted, commitSha: data.commitSha })

        if (res.ok && data.ok) {
          delCount = data.deleted || 0
          pendingDeletes.value.forEach(d => successDeleteIds.push(d.id))
          console.log(`✅ [批量删除] 成功: ${delCount} 篇文章, commit: ${data.commitSha}`)
        } else {
          delCount = data.deleted || 0
          failCount += Math.max(0, slugs.length - delCount)
          const detail = data.error || '未知错误'
          errors.push(`删除失败: ${detail}`)
          console.log(`❌ [批量删除] 失败:`, detail)
        }
      } catch (e) {
        failCount += slugs.length
        errors.push('删除请求失败')
        console.log(`❌ [批量删除] 请求异常:`, e.message)
      }
    }
  } catch (e) {
    console.error('[Publish] doPush error:', e)
    setPushMsg(e?.message || '网络错误', 'err')
  } finally {
    // 【修复】只移除成功推送的文章，失败的保留让用户重试
    if (successIds.length > 0) {
      pendingArticles.value = pendingArticles.value.filter(a => !successIds.includes(a.id))
      console.log(`📤 [推送] 已移除 ${successIds.length} 篇成功文章，剩余 ${pendingArticles.value.length} 篇`)
    }
    if (successDeleteIds.length > 0) {
      pendingDeletes.value = pendingDeletes.value.filter(d => !successDeleteIds.includes(d.id))
    }

    // 如果全部成功，清空提交信息
    if (pendingArticles.value.length === 0 && pendingDeletes.value.length === 0) {
      commitMsg.value = ''
      removePreviewCards()
      try {
        localStorage.removeItem('lk_pending_articles')
        localStorage.removeItem('lk_pending_deletes')
      } catch {}
    } else {
      // 还有失败的文章，更新 localStorage
      try {
        localStorage.setItem('lk_pending_articles', JSON.stringify(pendingArticles.value))
        localStorage.setItem('lk_pending_deletes', JSON.stringify(pendingDeletes.value))
      } catch {}
      console.log(`⚠️ [推送] 有 ${pendingArticles.value.length} 篇文章未成功推送，已保留`)
    }

    // 构建结果消息
    const parts = []
    if (addCount > 0) parts.push(`新增${addCount}篇`)
    if (delCount > 0) parts.push(`删除${delCount}篇`)
    if (failCount > 0) parts.push(`失败${failCount}项`)

    if (parts.length > 0) {
      setPushMsg(`推送完成：${parts.join('，')}`, failCount > 0 ? 'info' : 'ok')
    } else {
      setPushMsg('没有需要推送的内容', 'info')
    }

    if (errors.length > 0) {
      console.error('[Publish] 推送错误:', errors)
    }

    busy.value = false
    loadHistory()

    // 只有全部成功时才关闭面板并刷新页面
    if (failCount === 0 && (addCount > 0 || delCount > 0)) {
      setPushMsg(`操作完成，正在关闭面板并刷新页面...`, 'ok')
      isClosing.value = true // 设置正在关闭状态

      // 触发推送完成事件（用于其他组件）
      window.dispatchEvent(new CustomEvent('publish-push-finished'))

      // 1.5秒后关闭面板并刷新页面
      setTimeout(() => {
        // 先关闭推送面板
        pushSheetOpen.value = false
        // 2秒后刷新页面（给关闭动画留出时间）
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }, 1500)
    }
  }
}

onMounted(() => {
  console.log('🔍 [PublishFab] onMounted 执行')

  // 从localStorage恢复待推送队列
  try {
    const saved = localStorage.getItem('lk_pending_articles')
    if (saved) {
      const parsed = JSON.parse(saved)
      pendingArticles.value = parsed
      console.log('📥 [恢复] 从 localStorage 恢复文章:', parsed.map(a => a.slug))
    }
    const savedDeletes = localStorage.getItem('lk_pending_deletes')
    if (savedDeletes) {
      const parsedDeletes = JSON.parse(savedDeletes)
      pendingDeletes.value = parsedDeletes
      console.log('📥 [恢复] 从 localStorage 恢复删除:', parsedDeletes.map(d => d.slug))
    }

    // 清理冲突数据：文章不能同时在待推送和待删除中
    const pendingSlugs = new Set(pendingArticles.value.map(a => a.slug))
    const deleteSlugs = new Set(pendingDeletes.value.map(d => d.slug))
    const conflictSlugs = [...pendingSlugs].filter(s => deleteSlugs.has(s))

    if (conflictSlugs.length > 0) {
      console.log('[Publish] 检测到冲突数据，自动清理:', conflictSlugs)
      pendingArticles.value = pendingArticles.value.filter(a => !conflictSlugs.includes(a.slug))
      pendingDeletes.value = pendingDeletes.value.filter(d => !conflictSlugs.includes(d.slug))
      // 更新localStorage
      localStorage.setItem('lk_pending_articles', JSON.stringify(pendingArticles.value))
      localStorage.setItem('lk_pending_deletes', JSON.stringify(pendingDeletes.value))
    }
  } catch (e) {
    console.error('📥 [恢复] 恢复数据失败:', e)
  }

  // 【Bug 3 修复】监听删除事件
  console.log('🔍 [PublishFab] 注册事件监听: add-pending-delete, clear-pending-deletes')
  window.addEventListener('add-pending-delete', handleAddPendingDelete)
  window.addEventListener('clear-pending-deletes', handleClearPendingDeletes)
  window.addEventListener('open-push-sheet', handleOpenPushSheet)
  window.addEventListener('open-publish-panel', handleOpenPublishPanel)

  // 监听主题切换事件
  document.addEventListener('themechange', handleThemeChange)
  // 也监听 html 元素的 data-theme 属性变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        handleThemeChange()
      }
    })
  })
  observer.observe(document.documentElement, { attributes: true })
})

// 主题切换时重新生成预览卡片封面
function handleThemeChange() {
  // 重新生成所有待推送文章的封面（仅本地开发模式）
  if (isLocalDev() && pendingArticles.value.length > 0) {
    pendingArticles.value.forEach(article => {
      article.cover = generatePlaceholderImage(article.title, extractKeywords(`${article.title} ${article.excerpt} ${article.content || ''}`))
    })
    console.log('🎨 [主题切换] 已重新生成所有封面')
    insertPreviewCards()
  }
}

// 【Bug 3 修复】组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('add-pending-delete', handleAddPendingDelete)
  window.removeEventListener('clear-pending-deletes', handleClearPendingDeletes)
  window.removeEventListener('open-push-sheet', handleOpenPushSheet)
  window.removeEventListener('open-publish-panel', handleOpenPublishPanel)
  document.removeEventListener('themechange', handleThemeChange)
})

watch(pendingArticles, (val) => {
  // 保存到localStorage（空数组时移除）
  console.log('🔍 [PublishFab] watch(pendingArticles) 触发, 长度:', val.length)
  try {
    if (val.length === 0) {
      localStorage.removeItem('lk_pending_articles')
      console.log('  - 已移除 lk_pending_articles')
    } else {
      localStorage.setItem('lk_pending_articles', JSON.stringify(val))
      console.log('  - 已保存 lk_pending_articles')
    }
  } catch (e) {
    console.error('  - 保存失败:', e)
  }
}, { deep: true })

watch(pendingDeletes, (val) => {
  console.log('🔍 [PublishFab] watch(pendingDeletes) 触发, 长度:', val.length)
  try {
    if (val.length === 0) {
      localStorage.removeItem('lk_pending_deletes')
      console.log('  - 已移除 lk_pending_deletes')
    } else {
      localStorage.setItem('lk_pending_deletes', JSON.stringify(val))
      console.log('  - 已保存 lk_pending_deletes:', localStorage.getItem('lk_pending_deletes'))
    }
  } catch (e) {
    console.error('  - 保存失败:', e)
  }
}, { deep: true })
</script>

<template>
  <Teleport to="body">
    <div v-if="isLoggedIn" class="lk-publish-root">
      <!--
        右下角那两个悬浮按钮（+ 添加文章 / ⇪ 推送到 Vercel）已经收进导航栏「设置 → 文章」。
        面板本身照旧，由 LoginGate 发的 open-publish-panel / open-push-sheet 事件唤起。
      -->

      <!-- 添加文章面板 -->
      <Transition name="lk-publish-panel">
        <div v-if="open" class="lk-publish-backdrop" @click.self="open = false">
          <div class="lk-publish-panel" @click.stop>
            <div class="lk-publish-panel__head">
              <h2 class="lk-publish-panel__title">添加文章</h2>
              <button type="button" class="lk-publish-panel__close" @click="open = false">×</button>
            </div>

            <div class="lk-publish-panel__body">
              <p class="lk-publish-hint">拖入md文件自动提取信息，或手动填写后添加到本地预览</p>

              <div class="lk-publish-field">
                <label class="lk-publish-label">分区</label>
                <label class="lk-publish-radio">
                  <input v-model="target" type="radio" value="article" />
                  Article
                </label>
                <label class="lk-publish-radio">
                  <input v-model="target" type="radio" value="tech" />
                  Projects
                </label>
              </div>

              <div class="lk-publish-field">
                <label class="lk-publish-label">封面图片来源</label>
                <select v-model="imageBackend" class="lk-publish-select">
                  <option v-for="opt in imageBackendOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}{{ opt.free ? ' (免费)' : '' }}
                  </option>
                </select>
                <!-- 本地开发模式下显示 AI 生成按钮 -->
                <button
                  v-if="isLocalDev() && imageBackend !== 'unsplash'"
                  type="button"
                  class="lk-publish-ai-cover-btn"
                  :disabled="!articleTitle.trim() || generatingCover"
                  @click="generateCoverNow"
                >
                  {{ generatingCover ? '生成中...' : '🎨 生成封面' }}
                </button>
              </div>

              <!-- 生成的封面预览 -->
              <div v-if="generatedCoverUrl && isLocalDev()" class="lk-publish-field">
                <label class="lk-publish-label">生成的封面</label>
                <div class="lk-publish-cover-preview">
                  <img :src="generatedCoverUrl" alt="封面预览" />
                  <button type="button" class="lk-publish-cover-use" @click="useGeneratedCover">
                    使用此封面
                  </button>
                </div>
              </div>

              <div class="lk-publish-field">
                <label class="lk-publish-label">文件名</label>
                <input v-model="slug" class="lk-publish-input" type="text" placeholder="例如 my-article" />
              </div>

              <div class="lk-publish-field">
                <label class="lk-publish-label">标题</label>
                <input v-model="articleTitle" class="lk-publish-input" type="text" placeholder="文章标题" />
              </div>

              <div class="lk-publish-field">
                <label class="lk-publish-label">摘要</label>
                <textarea v-model="articleExcerpt" class="lk-publish-input" rows="2" placeholder="简短描述" />
              </div>

              <div
                class="lk-publish-drop"
                :class="{ 'lk-publish-drop--active': dragging }"
                @drop="onDrop"
                @dragover="onDragOver"
                @dragleave="onDragLeave"
              >
                <p>拖入 .md 文件</p>
                <label class="lk-publish-file">
                  <input type="file" accept=".md" @change="onFileInput" />
                  或选择文件
                </label>
              </div>

              <div class="lk-publish-field">
                <label class="lk-publish-label">正文（可选）</label>
                <textarea v-model="content" class="lk-publish-textarea" rows="6" />
              </div>

              <p v-if="message" class="lk-publish-msg" :class="`lk-publish-msg--${messageKind}`">{{ message }}</p>
            </div>

            <div class="lk-publish-actions">
              <button type="button" class="lk-publish-secondary" @click="open = false">取消</button>
              <button type="button" class="lk-publish-primary" @click="addManualArticle">添加到本地</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 推送管理面板 -->
      <Transition name="lk-publish-sheet">
        <div
          v-if="pushSheetOpen"
          class="lk-publish-backdrop lk-publish-backdrop--sheet"
          :class="{ 'lk-publish-backdrop--closing': isClosing }"
          @click.self="pushSheetOpen = false"
        >
          <div class="lk-publish-push-sheet" @click.stop>
            <div class="lk-publish-panel__head">
              <h2 class="lk-publish-panel__title">推送管理</h2>
              <button type="button" class="lk-publish-panel__close" @click="pushSheetOpen = false">×</button>
            </div>

            <!-- 待推送队列 -->
            <div v-if="pendingArticles.length > 0" class="lk-publish-queue">
              <div class="lk-publish-queue__head">
                <span>待推送 ({{ pendingArticles.length }})</span>
                <button type="button" class="lk-publish-queue__clear" @click="pendingArticles = []">清空</button>
              </div>
              <ul class="lk-publish-queue__list">
                <li v-for="article in pendingArticles" :key="article.id" class="lk-publish-queue__item">
                  <div class="lk-publish-queue__header" @click="toggleExpandArticle(article.id)">
                    <div class="lk-publish-queue__info">
                      <strong>{{ article.title }}</strong>
                      <span>{{ article.slug }}.md</span>
                    </div>
                    <div class="lk-publish-queue__actions">
                      <span class="lk-publish-queue__expand" :class="{ 'lk-publish-queue__expand--open': expandedArticleId === article.id }">▼</span>
                      <button type="button" class="lk-publish-queue__remove" @click.stop="removePendingArticle(article.id)">×</button>
                    </div>
                  </div>
                  <!-- 展开编辑 -->
                  <div v-if="expandedArticleId === article.id" class="lk-publish-queue__edit">
                    <input
                      v-model="article.title"
                      class="lk-publish-input lk-publish-input--sm"
                      placeholder="标题"
                    />
                    <input
                      v-model="article.excerpt"
                      class="lk-publish-input lk-publish-input--sm"
                      placeholder="摘要"
                    />
                    <input
                      v-model="article.slug"
                      class="lk-publish-input lk-publish-input--sm"
                      placeholder="文件名"
                    />
                    <button
                      type="button"
                      class="lk-publish-regen-btn"
                      @click.stop="regenerateArticleCover(article.id)"
                    >
                      🔄 重新生成封面
                    </button>
                  </div>
                </li>
              </ul>
            </div>

            <!-- 待删除列表 -->
            <div v-if="pendingDeletes.length > 0" class="lk-publish-queue lk-publish-queue--delete">
              <div class="lk-publish-queue__head">
                <span class="lk-publish-queue__delete-title">待删除 ({{ pendingDeletes.length }})</span>
                <button type="button" class="lk-publish-queue__clear" @click="pendingDeletes = []">清空</button>
              </div>
              <ul class="lk-publish-queue__list">
                <li v-for="item in pendingDeletes" :key="item.id" class="lk-publish-queue__item">
                  <div class="lk-publish-queue__header">
                    <div class="lk-publish-queue__info">
                      <strong>{{ item.title }}</strong>
                      <span>{{ item.slug }}.md</span>
                    </div>
                    <button type="button" class="lk-publish-queue__remove" @click="removePendingDelete(item.id)">×</button>
                  </div>
                </li>
              </ul>
            </div>

            <!-- 提交信息 -->
            <div class="lk-publish-field">
              <label class="lk-publish-label">提交说明</label>
              <textarea
                v-model="commitMsg"
                class="lk-publish-input"
                rows="2"
                placeholder="例如：添加新文章 / 更新配置"
              />
            </div>

            <!-- 封面检查按钮 -->
            <button
              v-if="pendingArticles.length > 1"
              type="button"
              class="lk-publish-check-btn"
              @click="regenerateDuplicateCovers"
            >
              🔍 检查封面唯一性
            </button>

            <button
              type="button"
              class="lk-publish-push-btn"
              :disabled="busy || isClosing"
              @click="doPush"
            >
              {{ isClosing ? '操作完成，正在关闭...' : (busy ? '推送中...' : (pendingArticles.length + pendingDeletes.length) > 0 ? `推送 ${pendingArticles.length > 0 ? `${pendingArticles.length}篇新增` : ''}${pendingArticles.length > 0 && pendingDeletes.length > 0 ? ' / ' : ''}${pendingDeletes.length > 0 ? `${pendingDeletes.length}篇删除` : ''}` : '推送所有改动') }}
            </button>

            <p v-if="pushMessage" class="lk-publish-msg" :class="`lk-publish-msg--${pushMessageKind}`">{{ pushMessage }}</p>

            <!-- 历史记录 -->
            <div v-if="historyRecords.length > 0" class="lk-publish-history">
              <button
                type="button"
                class="lk-publish-history__toggle"
                @click="historyExpanded = !historyExpanded"
              >
                <span>历史记录 ({{ historyRecords.length }})</span>
                <span class="lk-publish-history__arrow" :class="{ 'lk-publish-history__arrow--up': historyExpanded }">▼</span>
              </button>
              <ul v-if="historyExpanded" class="lk-publish-history__list">
                <li v-for="(c, i) in historyRecords" :key="i" class="lk-publish-history__item">
                  <div class="lk-publish-history__row">
                    <time>{{ c.date }}</time>
                    <code>{{ c.sha?.slice(0, 7) }}</code>
                  </div>
                  <div class="lk-publish-history__msg">{{ c.message }}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.lk-publish-root {
  position: relative;
}

.lk-publish-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10060;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.lk-publish-backdrop--sheet {
  align-items: flex-end;
  justify-content: flex-end;
}

.lk-publish-panel {
  width: min(32rem, 100%);
  max-height: 85vh;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lk-publish-push-sheet {
  width: min(24rem, 100vw - 4rem);
  max-height: 80vh;
  margin: 0.5rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  overflow-y: auto;
}

.lk-publish-panel__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lk-publish-panel__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.lk-publish-panel__close {
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.lk-publish-panel__close:hover {
  background: var(--vp-c-default-soft);
}

.lk-publish-panel__body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.lk-publish-hint {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.lk-publish-field {
  margin-bottom: 0.75rem;
}

.lk-publish-label {
  display: block;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.25rem;
}

.lk-publish-radio {
  margin-right: 1rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.lk-publish-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-size: 0.85rem;
}

.lk-publish-select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-size: 0.85rem;
  cursor: pointer;
}

.lk-publish-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-size: 0.8rem;
  font-family: var(--vp-font-family-mono);
  resize: vertical;
  min-height: 5rem;
}

.lk-publish-drop {
  padding: 1rem;
  border: 2px dashed var(--vp-c-divider);
  border-radius: 8px;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  transition: all 0.15s;
}

.lk-publish-drop--active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-default-soft);
}

.lk-publish-file {
  color: var(--vp-c-brand-1);
  cursor: pointer;
  font-weight: 500;
}

.lk-publish-file input {
  display: none;
}

.lk-publish-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.lk-publish-secondary {
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  cursor: pointer;
}

.lk-publish-primary {
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.lk-publish-msg {
  margin: 0.5rem 0;
  font-size: 0.8rem;
}

.lk-publish-msg--err { color: #ef4444; }
.lk-publish-msg--ok { color: #22c55e; }
.lk-publish-msg--info { color: var(--vp-c-text-2); }

/* 待推送队列 */
.lk-publish-queue {
  margin-bottom: 0.75rem;
  padding: 0.6rem;
  background: var(--vp-c-default-soft);
  border-radius: 6px;
}

.lk-publish-queue__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.lk-publish-queue__clear {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.lk-publish-queue__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 6rem;
  overflow-y: auto;
}

.lk-publish-queue__item {
  font-size: 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lk-publish-queue__item:last-child {
  border-bottom: none;
}

.lk-publish-queue__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  cursor: pointer;
}

.lk-publish-queue__info {
  display: flex;
  flex-direction: column;
}

.lk-publish-queue__info span {
  color: var(--vp-c-text-3);
  font-size: 0.65rem;
}

.lk-publish-queue__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.lk-publish-queue__expand {
  font-size: 0.6rem;
  color: var(--vp-c-text-3);
  transition: transform 0.2s;
}

.lk-publish-queue__expand--open {
  transform: rotate(180deg);
}

.lk-publish-queue__remove {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: none;
  background: rgba(239, 68, 68, 0.8);
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
}

.lk-publish-queue__edit {
  padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.lk-publish-input--sm {
  padding: 0.35rem 0.5rem;
  font-size: 0.75rem;
}

/* 重新生成封面按钮 */
.lk-publish-regen-btn {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  border: 1px dashed var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.7rem;
  cursor: pointer;
  margin-top: 0.25rem;
  transition: all 0.15s;
}

.lk-publish-regen-btn:hover {
  border-style: solid;
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

/* 待删除队列 */
.lk-publish-queue--delete {
  border-left: 3px solid #ef4444;
}

.lk-publish-queue__delete-title {
  color: #ef4444;
}

/* 待删除文章卡片样式 */
:deep(.lk-blog__item--pending-delete) {
  opacity: 0.5;
  position: relative;
}

:deep(.lk-blog__item--pending-delete::after) {
  content: '待删除';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #ef4444;
  color: #fff;
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

/* 封面检查按钮 */
.lk-publish-check-btn {
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
  font-size: 0.8rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
  transition: all 0.15s;
}

.lk-publish-check-btn:hover {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}

/* 推送按钮 */
.lk-publish-push-btn {
  width: 100%;
  padding: 0.6rem;
  border-radius: 6px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.lk-publish-push-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 历史记录 */
.lk-publish-history {
  margin-top: 0.75rem;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 0.5rem;
}

.lk-publish-history__toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  cursor: pointer;
}

.lk-publish-history__arrow {
  font-size: 0.65rem;
  transition: transform 0.2s;
}

.lk-publish-history__arrow--up {
  transform: rotate(180deg);
}

.lk-publish-history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 10rem;
  overflow-y: auto;
}

.lk-publish-history__item {
  padding: 0.4rem 0;
  font-size: 0.7rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.lk-publish-history__row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.15rem;
}

.lk-publish-history__row time {
  color: var(--vp-c-text-3);
}

.lk-publish-history__row code {
  font-size: 0.65rem;
  color: var(--vp-c-brand-1);
}

.lk-publish-history__msg {
  color: var(--vp-c-text-1);
}

/* 预览卡片 */
.lk-blog__item--preview {
  position: relative;
  list-style: none;
}

.lk-blog__item--preview::before {
  content: '待推送';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #f59e0b;
  color: #fff;
  font-size: 0.6rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  z-index: 10;
}

/* 待更新状态（已有文章的更新） */
.lk-blog__item--update::before {
  content: '待更新';
  background: #3b82f6;
}

.lk-preview-delete {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  border: none;
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  z-index: 10;
}

/* 动画 */
.lk-publish-panel-enter-active,
.lk-publish-panel-leave-active {
  transition: opacity 0.15s;
}

.lk-publish-panel-enter-from,
.lk-publish-panel-leave-to {
  opacity: 0;
}

/* 推送面板关闭动画 */
.lk-publish-sheet-enter-active {
  transition: all 0.3s ease-out;
}

.lk-publish-sheet-leave-active {
  transition: all 0.5s ease-in;
}

.lk-publish-sheet-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.lk-publish-sheet-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* 关闭中的面板样式 */
.lk-publish-push-sheet.lk-publish-push-sheet--closing {
  opacity: 0.7;
  pointer-events: none;
  transition: opacity 0.5s ease-in;
}

/* AI 封面生成按钮 */
.lk-publish-ai-cover-btn {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 15%, transparent);
  color: var(--vp-c-brand-1);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1.4;
}

.lk-publish-ai-cover-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.lk-publish-ai-cover-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 封面预览 */
.lk-publish-cover-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-default-soft);
  max-width: 100%;
  overflow: hidden;
}

.lk-publish-cover-preview img {
  width: 100%;
  max-height: 200px;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}

.lk-publish-cover-use {
  padding: 0.5rem;
  border-radius: 4px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.4;
}
</style>
