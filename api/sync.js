/**
 * Vercel Serverless Function: 同步本地文件 (git pull)
 * 仅在本地开发环境有效
 */

const { execSync } = require('child_process')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).send('')
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    // 执行 git pull
    const output = execSync('git pull origin main', {
      encoding: 'utf-8',
      timeout: 30000,
    })

    return res.status(200).json({
      ok: true,
      message: 'Synced successfully',
      output: output.trim(),
    })
  } catch (err) {
    // 如果不在 git 环境或 vercel 生产环境，静默失败
    return res.status(200).json({
      ok: true,
      message: 'Sync skipped (not in git environment)',
    })
  }
}
