#!/usr/bin/env node
/**
 * 外部 GitHub 项目接入 blog 项目板块：sync → 出封面（若无）→ 回写 cover → 再 sync。
 *
 * 用法：node scripts/onboard-external-project.mjs <registry-id>
 * 例：  npm run onboard:project -- multifeed-news
 *
 * registry 可选 localPath：自动更新外部仓库 blog-project.json 的 cover；
 * 否则在控制台打印需手动填入的 cover 路径。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const registryPath = path.join(root, 'docs', '.vuepress', 'data', 'external-projects.registry.json')
const galleryDir = path.join(root, 'docs', '.vuepress', 'public', 'gallery')

function runNode(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function loadRegistry() {
  const id = process.argv[2]
  if (!id) {
    console.error('用法: npm run onboard:project -- <registry-id>')
    console.error('例:   npm run onboard:project -- multifeed-news')
    process.exit(1)
  }
  const list = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  const entry = list.find((e) => e.id === id)
  if (!entry) {
    console.error(`注册表无 id: ${id}`)
    process.exit(1)
  }
  return entry
}

function loadManifest(entry) {
  const name = entry.manifestPath || 'blog-project.json'
  if (entry.localPath) {
    const fp = path.join(root, entry.localPath, name)
    if (fs.existsSync(fp)) return { fp, data: JSON.parse(fs.readFileSync(fp, 'utf8')) }
  }
  return { fp: null, data: null }
}

function findLatestCover(slug) {
  if (!fs.existsSync(galleryDir)) return null
  const prefix = `proj-card-${slug}-`
  const files = fs
    .readdirSync(galleryDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
    .map((f) => ({ f, t: fs.statSync(path.join(galleryDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!files.length) return null
  return `/gallery/${files[0].f}`
}

function saveManifest(fp, data) {
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function main() {
  const entry = loadRegistry()
  console.log(`\n▶ 接入外部项目: ${entry.id}\n`)

  console.log('—— 1/4 同步卡片与搭建标记区 ——')
  runNode('sync-external-projects.mjs')

  const { fp: manifestFp, data: manifest } = loadManifest(entry)
  const slug = entry.id
  let coverPath = manifest?.cover

  if (!coverPath) {
    console.log('\n—— 2/4 生成项目卡片封面（SiliconFlow）——')
    try {
      runNode('gen-proj-covers.mjs', [slug])
    } catch {
      process.exit(1)
    }
    coverPath = findLatestCover(slug)
    if (!coverPath) {
      console.error('未找到生成的封面文件，请检查 SILICONFLOW_API_KEY 与 gen-proj-covers 输出')
      process.exit(1)
    }
    console.log(`\n✓ 封面: ${coverPath}`)

    if (manifestFp && manifest) {
      console.log('—— 3/4 回写外部仓库 blog-project.json ——')
      manifest.cover = coverPath
      saveManifest(manifestFp, manifest)
      console.log(`  已更新: ${manifestFp}`)
    } else {
      console.log('—— 3/4 请手动写入外部仓库 blog-project.json ——')
      console.log(`  "cover": "${coverPath}"`)
      console.log('  然后 push 外部仓库，再回到 blog 执行 npm run sync:projects')
    }
  } else {
    console.log(`\n—— 2–3/4 已有 cover，跳过出图: ${coverPath} ——`)
  }

  console.log('\n—— 4/4 再次同步 ——')
  runNode('sync-external-projects.mjs')

  console.log('\n完成 checklist:')
  console.log('  [ ] 外部仓库 blog-project.json 已 push（含 cover）')
  console.log('  [ ] blog: docs/tech/*.md 标记区外长文 / 截图（手写）')
  console.log('  [ ] blog: git add gallery + generated + npm run build')
  console.log(`  [ ] 打开 /tech/ 与 ${manifest?.to || entry.detailFile} 目检\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
