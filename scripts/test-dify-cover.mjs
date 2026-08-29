/**
 * 测试 Dify 图片生成 API
 * 使用方法：node scripts/test-dify-cover.mjs
 */

const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'
const DIFY_API_KEY = process.env.DIFY_API_KEY

if (!DIFY_API_KEY) {
  console.error('❌ 请设置环境变量 DIFY_API_KEY')
  console.log('使用方法：DIFY_API_KEY=app-xxx node scripts/test-dify-cover.mjs')
  process.exit(1)
}

// 测试文章数据（从你的博客随机选取）
const testArticles = [
  {
    title: 'Edge AI 部署流水线的几笔记录',
    keywords: 'Embedded, ML, Edge AI',
  },
  {
    title: 'ai infra',
    keywords: 'AI, LLM, Agent',
  },
  {
    title: '用 VuePress 2 搭静态个人站',
    keywords: 'Vue, Frontend, JavaScript',
  },
  {
    title: 'openclaw',
    keywords: 'AI, LLM',
  },
]

async function testDifyWorkflow(article) {
  console.log(`\n🧪 测试文章: ${article.title}`)
  console.log(`   关键词: ${article.keywords}`)

  try {
    const res = await fetch(`${DIFY_API_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          title: article.title,
          keywords: article.keywords,
          summary: article.title,
        },
        response_mode: 'blocking',
        user: 'test-user',
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('❌ API 错误:', data)
      return null
    }

    console.log('✅ 成功!')
    console.log('   工作流状态:', data.workflow_run?.status)
    console.log('   输出:', JSON.stringify(data.data?.outputs, null, 2))

    // 检查是否有图片 URL
    const imageUrl = data.data?.outputs?.image_url
      || data.data?.outputs?.cover_url
      || data.data?.outputs?.image

    if (imageUrl) {
      console.log('   📷 图片URL:', imageUrl)
    }

    return data
  } catch (e) {
    console.error('❌ 请求失败:', e.message)
    return null
  }
}

async function main() {
  console.log('====================================')
  console.log('  Dify 图片生成测试')
  console.log('====================================')
  console.log('API URL:', DIFY_API_URL)
  console.log('API Key:', DIFY_API_KEY?.substring(0, 10) + '...')

  // 随机选一篇文章测试
  const article = testArticles[Math.floor(Math.random() * testArticles.length)]
  await testDifyWorkflow(article)
}

main()
