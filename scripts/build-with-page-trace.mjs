/**
 * Runs `vuepress build` with LK_BUILD_TRACE=1 so docs/.vuepress/config.js logs
 * each page in `extendsPage` (Markdown path + route) to stderr.
 *
 * Usage: npm run build:trace
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vuepressBin = join(root, 'node_modules', 'vuepress', 'bin', 'vuepress.js')

const env = { ...process.env, LK_BUILD_TRACE: '1' }

const child = spawn(
  process.execPath,
  ['--max-old-space-size=8192', vuepressBin, 'build', 'docs', '--clean-cache', '--clean-temp'],
  { cwd: root, env, stdio: 'inherit' },
)

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
