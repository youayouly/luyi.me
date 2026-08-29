#!/usr/bin/env node
import { execSync } from 'child_process'
import { createInterface } from 'readline'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

const commitMsg = process.argv[2]

function run(cmd) {
  console.log(`> ${cmd}`)
  return execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' })
}

// 检查是否有更改
const status = execSync('git status --porcelain', { encoding: 'utf-8' })
if (!status.trim()) {
  console.log('\n没有需要提交的更改')
  process.exit(0)
}

console.log('\n当前更改：')
run('git status -s')
console.log('')

if (commitMsg) {
  run('git add .')
  run(`git commit -m "${commitMsg}"`)
  run('git push origin main')
  rl.close()
} else {
  rl.question('输入提交信息: ', (msg) => {
    if (!msg.trim()) {
      console.log('取消提交')
      rl.close()
      return
    }
    run('git add .')
    run(`git commit -m "${msg}"`)
    run('git push origin main')
    rl.close()
  })
}
