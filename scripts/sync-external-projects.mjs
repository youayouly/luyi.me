#!/usr/bin/env node
/**
 * 从外部仓库 blog-project.json 同步项目卡片与详情页搭建标记区。
 * 注册表：docs/.vuepress/data/external-projects.registry.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.join(root, 'docs', '.vuepress', 'data')
const registryPath = path.join(dataDir, 'external-projects.registry.json')
const generatedPath = path.join(dataDir, 'externalProjectItems.generated.js')

const SETUP_START = '<!-- sync-setup-start -->'
const SETUP_END = '<!-- sync-setup-end -->'

const VALID_ROLES = new Set([
  '产品运营',
  '教育产品',
  '产品策略',
  '作品集信息架构',
  '内容产品',
  'AI 产品',
  'AI 效率工具',
  '前端开发',
  '作品集前端',
  '前端文档',
  '交互系统',
  '创作者工具',
  '嵌入式',
  '机器人',
  'AI 基础设施',
  'AI 应用',
  '边缘机器学习',
  '机器学习',
])

function loadDotEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const fp = path.join(root, name)
    if (!fs.existsSync(fp)) continue
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  }
}

function resolveLocalPath(rel) {
  return path.resolve(root, rel)
}

async function loadManifestForEntry(entry) {
  const manifestName = entry.manifestPath || 'blog-project.json'
  const localFull = entry.localPath ? resolveLocalPath(entry.localPath) : null
  const localFile = localFull ? path.join(localFull, manifestName) : null

  if (localFile && fs.existsSync(localFile)) {
    return JSON.parse(fs.readFileSync(localFile, 'utf8'))
  }

  if (!entry.repo) {
    throw new Error(`[${entry.id}] 缺少 localPath 且无 repo，无法读取 ${manifestName}`)
  }

  const branch = entry.branch || 'main'
  const url = `https://raw.githubusercontent.com/${entry.repo}/${branch}/${manifestName}`
  const headers = {}
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  } else {
    console.warn(`[${entry.id}] 无 GITHUB_TOKEN，尝试匿名拉取（私有库会失败）`)
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(
      `[${entry.id}] fetch ${url} → ${res.status}；请配置 localPath 或 GITHUB_TOKEN`,
    )
  }
  return res.json()
}

function validateManifest(m, registryId) {
  const required = ['id', 'title', 'role', 'tag', 'summary', 'sortDate', 'to']
  for (const k of required) {
    if (!m[k]) throw new Error(`[${m.id || registryId}] 缺少字段 ${k}`)
  }
  if (m.id !== registryId) {
    throw new Error(`[${registryId}] manifest id "${m.id}" 与 registry 不一致`)
  }
  if (!VALID_ROLES.has(m.role)) {
    throw new Error(`[${m.id}] 无效 role "${m.role}"，须为 projectsCatalog roleMapping 中的中文角色`)
  }
  if (!m.visibility) {
    m.visibility = { repo: 'public', demo: 'none', showSetup: true }
  }
  if (!m.setup) m.setup = {}
  if (!m.links) m.links = {}
}

function manifestToCardItem(m) {
  const item = {
    title: m.title,
    role: m.role,
    tag: m.tag,
    to: m.to,
    summary: m.summary,
    sortDate: m.sortDate,
    featuredRank: m.featuredRank ?? 50,
  }
  if (m.cover) item.cover = m.cover
  return item
}

function escapeCell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function isPublicHttpsDemo(demo) {
  if (!demo || typeof demo !== 'string') return false
  return /^https:\/\//i.test(demo)
}

function buildSetupMarkdown(m) {
  const vis = m.visibility || {}
  const links = m.links || {}
  const setup = m.setup || {}

  if (vis.showSetup === false) {
    return [
      '## 搭建速查',
      '',
      '_本项目为本地或内部工具，公网 Demo 暂无；搭建细节不对外展示。_',
      '',
    ].join('\n')
  }

  const lines = ['## 搭建速查', '']

  if (vis.repo === 'public' && links.github) {
    lines.push(`**源码**：[GitHub 仓库](${links.github})`)
    lines.push('')
  } else if (vis.repo === 'private' || vis.repo === 'hidden') {
    lines.push('**源码**：私有仓库，暂不对外开放。')
    lines.push('')
  }

  if (isPublicHttpsDemo(links.demo)) {
    lines.push(`**在线 Demo**：[打开](${links.demo})`)
    lines.push('')
  } else if (vis.demo === 'local-only' && setup.url) {
    lines.push(`**访问（作者本机）**：\`${setup.url}\`（访客无法直接打开）`)
    lines.push('')
  } else {
    lines.push('**在线 Demo**：暂无公网地址。')
    lines.push('')
  }

  lines.push('| 项 | 说明 |')
  lines.push('| --- | --- |')
  if (setup.start) lines.push(`| 启动 | \`${escapeCell(setup.start)}\` |`)
  if (setup.url && vis.demo !== 'none') {
    lines.push(`| 访问 | ${escapeCell(setup.url)} |`)
  }
  if (setup.ports?.length) {
    lines.push(`| 端口 | ${escapeCell(setup.ports.join('、'))} |`)
  }
  if (setup.env?.length) {
    lines.push(`| 环境变量 | ${escapeCell(setup.env.join('；'))} |`)
  }
  if (setup.notes) {
    lines.push(`| 备注 | ${escapeCell(setup.notes)} |`)
  }
  lines.push('')
  lines.push('_本节由 `npm run sync:projects` 根据外部仓库 `blog-project.json` 自动更新；仅登录后可见。_')
  lines.push('')
  const body = lines.join('\n')
  return `<div class="lk-project-setup-private" data-lk-auth-only>\n\n${body}\n</div>\n`
}

function buildDetailSkeleton(m, detailRel) {
  const title = m.title
  return `---
title: ${title}
pageClass: page-article-post
comment: false
toc: true
sidebar: true
---

# ${title}

<!-- 请在下方标记区之外撰写产品叙事、架构与截图 -->

## 1. 要解决什么问题

（待补充：用户场景、痛点）

## 2. 功能与体验

（待补充：对外可见的能力点，勿写本机端口与环境变量）

## 3. 架构与原理

（待补充：数据流、关键模块、技术选型原因）

## 4. 产品取舍

（待补充：为何这样设计、放弃了什么）

## 5. 截图

（待补充：界面截图路径，如 /gallery/...）

${SETUP_START}

${SETUP_END}
`
}

function replaceSetupRegion(content, setupBody) {
  const re = new RegExp(
    `${SETUP_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SETUP_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  )
  if (!re.test(content)) return null
  const block = `${SETUP_START}\n\n${setupBody}\n${SETUP_END}`
  return content.replace(re, block)
}

function writeGeneratedFile(items) {
  const lines = [
    '/** AUTO-GENERATED by scripts/sync-external-projects.mjs — do not edit */',
    'export const externalProjectItems = [',
  ]
  for (const item of items) {
    lines.push(`  ${JSON.stringify(item)},`)
  }
  lines.push(']', '')
  fs.writeFileSync(generatedPath, lines.join('\n'), 'utf8')
}

async function main() {
  loadDotEnvFiles()

  if (!fs.existsSync(registryPath)) {
    console.error('找不到注册表:', registryPath)
    process.exit(1)
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  const cardItems = []
  const updatedIds = []
  const skippedMd = []
  const warnings = []

  for (const entry of registry) {
    let manifest
    try {
      manifest = await loadManifestForEntry(entry)
    } catch (e) {
      console.error(e.message || e)
      process.exit(1)
    }

    try {
      validateManifest(manifest, entry.id)
    } catch (e) {
      console.error(e.message || e)
      process.exit(1)
    }

    cardItems.push(manifestToCardItem(manifest))
    updatedIds.push(manifest.id)

    const detailPath = path.join(root, entry.detailFile)
    const setupMd = buildSetupMarkdown(manifest)

    if (!fs.existsSync(detailPath)) {
      fs.mkdirSync(path.dirname(detailPath), { recursive: true })
      fs.writeFileSync(detailPath, buildDetailSkeleton(manifest, entry.detailFile), 'utf8')
      console.log(`[${entry.id}] 已创建详情骨架: ${entry.detailFile}`)
    }

    let content = fs.readFileSync(detailPath, 'utf8')
    const next = replaceSetupRegion(content, setupMd)
    if (next === null) {
      warnings.push(`${entry.id}: ${entry.detailFile} 缺少 ${SETUP_START}/${SETUP_END}，跳过标记区更新`)
      skippedMd.push(entry.id)
    } else if (next !== content) {
      fs.writeFileSync(detailPath, next, 'utf8')
      console.log(`[${entry.id}] 已更新搭建标记区: ${entry.detailFile}`)
    } else {
      console.log(`[${entry.id}] 搭建标记区无变化: ${entry.detailFile}`)
    }
  }

  writeGeneratedFile(cardItems)

  console.log('')
  console.log('同步完成')
  console.log('  卡片条目:', updatedIds.join(', ') || '(无)')
  console.log('  写入:', path.relative(root, generatedPath))
  if (skippedMd.length) {
    console.log('  跳过标记区:', skippedMd.join(', '))
  }
  for (const w of warnings) console.warn('  warning:', w)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
