#!/usr/bin/env node

/**
 * 测试 API 端点配置是否正确
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

const apiDir = path.join(projectRoot, 'api')
const docsApiDir = path.join(projectRoot, 'docs', 'api')

console.log('=== API 路由配置检查 ===\n')

// 1. 检查 API 文件是否存在
console.log('1. 检查 API 文件位置:')
console.log(`   - 根目录 api/ 文件夹: ${fs.existsSync(apiDir) ? '✅ 存在' : '❌ 不存在'}`)
console.log(`   - docs/api/ 文件夹: ${fs.existsSync(docsApiDir) ? '✅ 存在' : '❌ 不存在'}`)

// 2. 列出所有 API 文件
if (fs.existsSync(apiDir)) {
  const apiFiles = fs.readdirSync(apiDir).filter(file => file.endsWith('.js'))
  console.log(`\n2. 根目录 API 文件 (${apiFiles.length} 个):`)
  apiFiles.forEach(file => {
    const filePath = path.join(apiDir, file)
    const stats = fs.statSync(filePath)
    console.log(`   - ${file} (${stats.size} bytes)`)
  })
}

if (fs.existsSync(docsApiDir)) {
  const docsApiFiles = fs.readdirSync(docsApiDir).filter(file => file.endsWith('.js'))
  console.log(`\n3. docs/api/ 目录文件 (${docsApiFiles.length} 个):`)
  docsApiFiles.forEach(file => {
    console.log(`   - ${file}`)
  })
}

// 3. 检查 Vercel 配置
const vercelConfigPath = path.join(projectRoot, 'vercel.json')
if (fs.existsSync(vercelConfigPath)) {
  console.log('\n4. Vercel 配置检查:')
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'))

  if (vercelConfig.functions && vercelConfig.functions['api/**/*.{js,ts}']) {
    console.log('   - API 函数配置: ✅ 已配置')
    const funcConfig = vercelConfig.functions['api/**/*.{js,ts}']
    console.log(`     - 内存: ${funcConfig.memory}MB`)
    console.log(`     - 超时: ${funcConfig.maxDuration}s`)
  } else {
    console.log('   - API 函数配置: ⚠️ 未配置')
  }

  if (vercelConfig.rewrites) {
    console.log('   - 重写规则: ✅ 已配置')
    const apiRewrite = vercelConfig.rewrites.find(rule => rule.source === '/api/:path*')
    if (apiRewrite) {
      console.log(`     - API 路由: ${apiRewrite.source} → ${apiRewrite.destination}`)
    }
  }
}

// 4. 检查环境变量配置
const envExamplePath = path.join(projectRoot, '.env.example')
if (fs.existsSync(envExamplePath)) {
  console.log('\n5. 环境变量配置检查:')
  const envContent = fs.readFileSync(envExamplePath, 'utf-8')
  const requiredVars = ['GITHUB_TOKEN', 'GITHUB_REPO', 'LK_SITE_USER', 'LK_SITE_PASS']

  requiredVars.forEach(varName => {
    if (envContent.includes(varName)) {
      console.log(`   - ${varName}: ✅ 已定义`)
    } else {
      console.log(`   - ${varName}: ❌ 未定义`)
    }
  })
}

// 5. 检查 package.json 脚本
const packageJsonPath = path.join(projectRoot, 'package.json')
if (fs.existsSync(packageJsonPath)) {
  console.log('\n6. 构建脚本检查:')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

  if (packageJson.scripts.build && packageJson.scripts.build.includes('copy-api')) {
    console.log('   - build 脚本: ✅ 包含 API 复制')
  } else {
    console.log('   - build 脚本: ⚠️ 不包含 API 复制')
  }

  if (packageJson.scripts.dev && packageJson.scripts.dev.includes('copy-api')) {
    console.log('   - dev 脚本: ✅ 包含 API 复制')
  } else {
    console.log('   - dev 脚本: ⚠️ 不包含 API 复制')
  }
}

console.log('\n=== 检查完成 ===')
console.log('\nAPI 端点列表:')
const expectedApis = [
  'publish.js - 发布单篇文章',
  'publish-batch.js - 批量发布文章',
  'delete.js - 删除单篇文章',
  'delete-batch.js - 批量删除文章',
  'cover.js - 生成文章封面',
  'history.js - 查询文章历史',
  'sync.js - 同步本地文件'
]

expectedApis.forEach(api => {
  console.log(`   - /api/${api}`)
})