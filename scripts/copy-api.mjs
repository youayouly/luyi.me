#!/usr/bin/env node

/**
 * 复制 API 文件到根目录，用于 Vercel 部署
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

const sourceDir = path.join(projectRoot, 'docs', 'api')
const targetDir = path.join(projectRoot, 'api')

function copyApiFiles() {
  try {
    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // 检查源目录是否存在
    if (!fs.existsSync(sourceDir)) {
      console.log('[API Copy] Source directory does not exist, skipping...')
      return
    }

    // 获取所有 API 文件
    const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.js'))

    if (files.length === 0) {
      console.log('[API Copy] No API files found, skipping...')
      return
    }

    // 复制每个文件
    let copiedCount = 0
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file)
      const targetPath = path.join(targetDir, file)

      const sourceContent = fs.readFileSync(sourcePath, 'utf-8')
      fs.writeFileSync(targetPath, sourceContent, 'utf-8')
      copiedCount++
    }

    console.log(`[API Copy] Successfully copied ${copiedCount} API file(s) to root api/ directory`)
  } catch (error) {
    console.error('[API Copy] Error:', error.message)
    // 不退出构建，只是警告
    console.log('[API Copy] Continuing with build...')
  }
}

copyApiFiles()