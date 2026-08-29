/**
 * 删除功能诊断工具
 * 在浏览器控制台运行此脚本，或通过 import 导入
 */

export async function runDeleteDiagnostic() {
  const report = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    success: true,
  }

  console.log('='.repeat(60))
  console.log('🔍 删除功能诊断报告')
  console.log('='.repeat(60))

  // Step 1: 检查 localStorage 状态
  console.log('\n📋 Step 1: 检查 localStorage 状态')
  try {
    const pendingArticles = localStorage.getItem('lk_pending_articles')
    const pendingDeletes = localStorage.getItem('lk_pending_deletes')

    const articlesData = pendingArticles ? JSON.parse(pendingArticles) : []
    const deletesData = pendingDeletes ? JSON.parse(pendingDeletes) : []

    console.log('  - lk_pending_articles:', articlesData.length, '篇')
    console.log('  - lk_pending_deletes:', deletesData.length, '篇')
    if (deletesData.length > 0) {
      console.log('  - 待删除 slugs:', deletesData.map(d => d.slug))
    }

    report.steps.push({
      step: 'localStorage',
      pendingArticlesCount: articlesData.length,
      pendingDeletesCount: deletesData.length,
      pendingDeleteSlugs: deletesData.map(d => d.slug),
    })
  } catch (e) {
    console.error('  ❌ 读取 localStorage 失败:', e.message)
    report.errors.push({ step: 'localStorage', error: e.message })
    report.success = false
  }

  // Step 2: 检查 DOM 元素状态
  console.log('\n📋 Step 2: 检查 DOM 元素状态')
  try {
    const blogItems = document.querySelectorAll('.lk-blog__item[data-slug]')
    const pendingDeleteItems = document.querySelectorAll('.lk-blog__item--pending-delete')
    const previewItems = document.querySelectorAll('.lk-blog__item--preview')

    console.log('  - 文章卡片总数:', blogItems.length)
    console.log('  - 待删除标记卡片:', pendingDeleteItems.length)
    console.log('  - 预览卡片:', previewItems.length)

    const itemSlugs = []
    blogItems.forEach(item => {
      const slug = item.getAttribute('data-slug')
      const isPendingDelete = item.classList.contains('lk-blog__item--pending-delete')
      const isPreview = item.classList.contains('lk-blog__item--preview')
      itemSlugs.push({ slug, isPendingDelete, isPreview })
    })
    console.log('  - 文章 slugs:', itemSlugs.map(s => s.slug))

    report.steps.push({
      step: 'DOM',
      totalItems: blogItems.length,
      pendingDeleteItems: pendingDeleteItems.length,
      previewItems: previewItems.length,
      itemSlugs,
    })
  } catch (e) {
    console.error('  ❌ 检查 DOM 失败:', e.message)
    report.errors.push({ step: 'DOM', error: e.message })
    report.success = false
  }

  // Step 3: 检查全局事件监听
  console.log('\n📋 Step 3: 检查事件通信')
  try {
    // 测试事件是否可以被触发
    let eventReceived = false
    const testHandler = (e) => {
      eventReceived = true
      console.log('  ✅ 事件 add-pending-delete 可以被接收:', e.detail)
    }
    window.addEventListener('add-pending-delete', testHandler)
    window.dispatchEvent(new CustomEvent('add-pending-delete', {
      detail: { slug: '__test__', title: '__test__' }
    }))
    window.removeEventListener('add-pending-delete', testHandler)

    console.log('  - 事件通信测试:', eventReceived ? '✅ 正常' : '❌ 失败')

    report.steps.push({
      step: 'EventCommunication',
      eventTestPassed: eventReceived,
    })
  } catch (e) {
    console.error('  ❌ 事件测试失败:', e.message)
    report.errors.push({ step: 'EventCommunication', error: e.message })
    report.success = false
  }

  // Step 4: 检查认证状态
  console.log('\n📋 Step 4: 检查认证状态')
  try {
    const authUser = localStorage.getItem('lk_site_user')
    const authPass = localStorage.getItem('lk_site_pass')

    console.log('  - authUser:', authUser ? '已设置' : '❌ 未设置')
    console.log('  - authPass:', authPass ? '已设置' : '❌ 未设置')

    report.steps.push({
      step: 'Auth',
      hasAuthUser: !!authUser,
      hasAuthPass: !!authPass,
    })
  } catch (e) {
    console.error('  ❌ 检查认证失败:', e.message)
    report.errors.push({ step: 'Auth', error: e.message })
  }

  // Step 5: 测试删除 API（可选，需要用户确认）
  console.log('\n📋 Step 5: API 连接测试')
  console.log('  提示: 运行 testDeleteAPI() 来测试删除 API 连接')

  // Step 6: 检查 VuePress dev server 状态
  console.log('\n📋 Step 6: 环境信息')
  console.log('  - 当前 URL:', window.location.href)
  console.log('  - User Agent:', navigator.userAgent.slice(0, 100) + '...')
  console.log('  - VuePress dev 模式:', window.location.port === '8080' ? '是' : '否')

  console.log('\n' + '='.repeat(60))
  console.log('📊 诊断完成')
  console.log('='.repeat(60))

  return report
}

// 测试删除 API
export async function testDeleteAPI(slugs = ['test-slug']) {
  console.log('\n🧪 测试删除 API...')

  const authUser = localStorage.getItem('lk_site_user')
  const authPass = localStorage.getItem('lk_site_pass')

  if (!authUser || !authPass) {
    console.error('❌ 未设置认证信息，请先登录')
    return { success: false, error: '未认证' }
  }

  try {
    const response = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authUser,
        authPass,
        target: 'article',
        slugs,
      }),
    })

    const data = await response.json()

    console.log('📡 API 响应状态:', response.status)
    console.log('📡 API 响应数据:', JSON.stringify(data, null, 2))

    return {
      success: response.ok && data.ok,
      status: response.status,
      data,
    }
  } catch (e) {
    console.error('❌ API 请求失败:', e.message)
    return { success: false, error: e.message }
  }
}

// 检查本地文件是否存在（通过 fetch）
export async function checkLocalFileExists(slug) {
  console.log(`\n🔍 检查文件是否存在: ${slug}.md`)

  try {
    const response = await fetch(`/article/${slug}.html`, { method: 'HEAD' })
    console.log(`  - 响应状态: ${response.status}`)
    console.log(`  - 文件存在: ${response.status === 200 ? '是' : '否'}`)

    return {
      exists: response.status === 200,
      status: response.status,
    }
  } catch (e) {
    console.error('❌ 检查失败:', e.message)
    return { exists: null, error: e.message }
  }
}

// 完整的删除流程测试
export async function fullDeleteTest(slug) {
  console.log('\n' + '='.repeat(60))
  console.log(`🧪 完整删除流程测试: ${slug}`)
  console.log('='.repeat(60))

  const results = {
    beforeFile: null,
    apiCall: null,
    afterFile: null,
    localStorage: null,
  }

  // 1. 检查文件删除前状态
  console.log('\n📋 Step 1: 检查删除前文件状态')
  results.beforeFile = await checkLocalFileExists(slug)

  // 2. 调用删除 API
  console.log('\n📋 Step 2: 调用删除 API')
  results.apiCall = await testDeleteAPI([slug])

  // 3. 检查文件删除后状态
  console.log('\n📋 Step 3: 检查删除后文件状态')
  await new Promise(r => setTimeout(r, 1000)) // 等待 1 秒
  results.afterFile = await checkLocalFileExists(slug)

  // 4. 检查 localStorage
  console.log('\n📋 Step 4: 检查 localStorage')
  const pendingDeletes = localStorage.getItem('lk_pending_deletes')
  const deletesData = pendingDeletes ? JSON.parse(pendingDeletes) : []
  console.log('  - 待删除列表:', deletesData.map(d => d.slug))
  results.localStorage = deletesData

  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试总结')
  console.log('='.repeat(60))
  console.log('  - 删除前文件存在:', results.beforeFile.exists)
  console.log('  - API 调用成功:', results.apiCall.success)
  console.log('  - 删除后文件存在:', results.afterFile.exists)
  console.log('  - localStorage 待删除:', results.localStorage.map(d => d.slug))

  const deleteSuccess = results.beforeFile.exists && results.apiCall.success && !results.afterFile.exists
  console.log('\n  ✅ 删除成功:', deleteSuccess)

  return results
}

// 暴露到全局以便控制台使用
if (typeof window !== 'undefined') {
  (window as any).__deleteDiagnostic = {
    run: runDeleteDiagnostic,
    testAPI: testDeleteAPI,
    checkFile: checkLocalFileExists,
    fullTest: fullDeleteTest,
  }
  console.log('💡 提示: 在控制台运行以下命令:')
  console.log('  - __deleteDiagnostic.run()      : 运行诊断')
  console.log('  - __deleteDiagnostic.testAPI()  : 测试 API')
  console.log('  - __deleteDiagnostic.checkFile("slug") : 检查文件')
  console.log('  - __deleteDiagnostic.fullTest("slug")  : 完整测试')
}

export default {
  runDeleteDiagnostic,
  testDeleteAPI,
  checkLocalFileExists,
  fullDeleteTest,
}
