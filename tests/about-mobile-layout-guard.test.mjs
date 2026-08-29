import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pageRoot = path.resolve(__dirname, '..')
const stylesPath = path.join(pageRoot, 'docs', '.vuepress', 'styles', 'index.scss')

function main() {
  const styles = fs.readFileSync(stylesPath, 'utf8')

  assert.match(
    styles,
    /-webkit-text-size-adjust:\s*100%/i,
    'about/mobile styles should normalize Android text autosizing',
  )

  assert.match(
    styles,
    /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*and\s*\(max-width:\s*959px\)/i,
    'about/mobile styles should include a coarse-pointer single-column safeguard',
  )

  assert.match(
    styles,
    /\.lk-about-v2-main__grid--triple\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/i,
    'touch mobile safeguard should force the about grid into a single column',
  )
}

main()
