/**
 * 本地封面生成脚本
 * 调用 Dify 工作流生成封面图片，下载到本地 gallery 目录
 *
 * 使用方法：
 *   DIFY_API_KEY=app-xxx node scripts/generate-cover.mjs "文章标题" --keywords "AI,LLM"
 *   DIFY_API_KEY=app-xxx node scripts/generate-cover.mjs "文章标题" --keywords "AI,LLM" --output
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const GALLERY_DIR = path.join(ROOT, 'docs/.vuepress/public/gallery')

const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1'
const DIFY_API_KEY = process.env.DIFY_API_KEY

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2)
  const params = {
    title: '',
    keywords: [],
    output: false, // 是否输出 JSON 格式（供其他脚本调用）
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--keywords' || arg === '-k') {
      params.keywords = args[++i]?.split(',').map(k => k.trim()).filter(Boolean) || []
    } else if (arg === '--output' || arg === '-o') {
      params.output = true
    } else if (!arg.startsWith('-') && !params.title) {
      params.title = arg
    }
  }

  return params
}

// 根据标题生成文件名 slug
function generateSlug(title) {
  const timestamp = Date.now()
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
  return `${slug}-${timestamp}`
}

// 检测图片格式
function detectImageFormat(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'gif'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'webp'
  return 'png'
}

// 调用 Dify 工作流生成封面
async function generateCoverFromDify(title, keywords) {
  console.log(`🎨 调用 Dify 工作流...`)
  console.log(`   标题: ${title}`)
  console.log(`   关键词: ${keywords.join(', ') || '(无)'}`)

  const res = await fetch(`${DIFY_API_URL}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        title,
        keywords: keywords.join(', '),
        summary: title, // 默认用标题作为摘要
      },
      response_mode: 'blocking',
      user: 'cover-generator',
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`Dify API 错误: ${data.message || JSON.stringify(data)}`)
  }

  // 从工作流输出中提取图片 URL
  // 返回格式: { result: [{ url: "..." }] }
  const outputs = data.data?.outputs || {}
  const imageUrl = outputs.result?.[0]?.url
    || outputs.image_url
    || outputs.cover_url
    || outputs.image
    || outputs.url

  if (!imageUrl) {
    console.log('⚠️ 工作流输出:', JSON.stringify(outputs, null, 2))
    throw new Error('工作流未返回图片 URL')
  }

  console.log(`✅ 获取图片 URL: ${imageUrl.substring(0, 80)}...`)
  return imageUrl
}

// 下载图片并保存到本地
async function downloadAndSave(imageUrl, slug) {
  console.log(`📥 下载图片...`)

  const res = await fetch(imageUrl)
  if (!res.ok) {
    throw new Error(`下载失败: ${res.status} ${res.statusText}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const format = detectImageFormat(buffer)
  const filename = `article-cover-${slug}.${format}`
  const filepath = path.join(GALLERY_DIR, filename)

  // 确保 gallery 目录存在
  if (!fs.existsSync(GALLERY_DIR)) {
    fs.mkdirSync(GALLERY_DIR, { recursive: true })
  }

  fs.writeFileSync(filepath, buffer)
  console.log(`💾 已保存: ${filepath}`)
  console.log(`   大小: ${(buffer.length / 1024).toFixed(1)} KB`)

  return {
    filename,
    filepath,
    url: `/gallery/${filename}`,  // 博客中引用的路径
    size: buffer.length,
    format,
  }
}

// 主函数
async function main() {
  const params = parseArgs()

  if (!params.title) {
    console.error('❌ 请提供文章标题')
    console.log('使用方法: node scripts/generate-cover.mjs "文章标题" --keywords "AI,LLM"')
    process.exit(1)
  }

  if (!DIFY_API_KEY) {
    console.error('❌ 请设置环境变量 DIFY_API_KEY')
    console.log('使用方法: DIFY_API_KEY=app-xxx node scripts/generate-cover.mjs "标题"')
    process.exit(1)
  }

  try {
    const slug = generateSlug(params.title)
    const imageUrl = await generateCoverFromDify(params.title, params.keywords)
    const result = await downloadAndSave(imageUrl, slug)

    console.log(`\n✨ 封面生成成功!`)
    console.log(`   引用路径: ${result.url}`)

    // 输出 JSON 格式（供其他脚本调用）
    if (params.output) {
      console.log('\n---OUTPUT---')
      console.log(JSON.stringify({
        ok: true,
        url: result.url,
        filename: result.filename,
        size: result.size,
      }))
    }

    return result
  } catch (e) {
    console.error('❌ 错误:', e.message)

    if (params.output) {
      console.log('\n---OUTPUT---')
      console.log(JSON.stringify({ ok: false, error: e.message }))
    }

    process.exit(1)
  }
}

main()
