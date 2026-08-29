import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pageRoot = path.resolve(__dirname, '..')
const consoleRoot = path.resolve(pageRoot, '..', 'github-console')

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function main() {
  const manifestPath = path.join(consoleRoot, 'blog-project.json')
  assert.ok(fs.existsSync(manifestPath), 'github-console/blog-project.json should exist')

  const manifest = readJson(manifestPath)
  assert.equal(manifest.id, 'github-console')
  assert.equal(manifest.to, '/tech/github-console.html')
  assert.equal(manifest.links?.github, 'https://github.com/youayouly/github-console')

  const registryPath = path.join(
    pageRoot,
    'docs',
    '.vuepress',
    'data',
    'external-projects.registry.json',
  )
  const registry = readJson(registryPath)
  const entry = registry.find((item) => item.id === 'github-console')
  assert.ok(entry, 'external-projects registry should include github-console')
  assert.equal(entry.repo, 'youayouly/github-console')
  assert.equal(entry.detailFile, 'docs/tech/github-console.md')
  assert.equal(entry.localPath, '../github-console')

  const detailPath = path.join(pageRoot, 'docs', 'tech', 'github-console.md')
  assert.ok(fs.existsSync(detailPath), 'github-console detail page should exist')
  const detail = fs.readFileSync(detailPath, 'utf8')
  assert.match(detail, /<!-- sync-setup-start -->/)
  assert.match(detail, /<!-- sync-setup-end -->/)
  assert.match(detail, /GitHub Console 本地项目控制台/)

  const coverScriptPath = path.join(pageRoot, 'scripts', 'gen-proj-covers.mjs')
  const coverScript = fs.readFileSync(coverScriptPath, 'utf8')
  assert.match(coverScript, /slug:\s*'github-console'/)
}

main()
