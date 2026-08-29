/**
 * Vercel Serverless Function: 查询文件提交历史
 */

const ALLOWED_TARGETS = {
  article: 'docs/article',
  tech: 'docs/tech',
}

const GITHUB_API_BASE = 'https://api.github.com'

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return false
  const base = filename.toLowerCase()
  if (!base.endsWith('.md') && !base.endsWith('.markdown')) return false
  const nameWithoutExt = base.replace(/\.(md|markdown)$/, '')
  return /^[a-z0-9][a-z0-9-]{0,100}$/.test(nameWithoutExt)
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).json({})
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const LK_SITE_USER = process.env.LK_SITE_USER
  const LK_SITE_PASS = process.env.LK_SITE_PASS
  const GITHUB_REPO = process.env.GITHUB_REPO

  if (!GITHUB_TOKEN || !LK_SITE_USER || !LK_SITE_PASS || !GITHUB_REPO) {
    return res.status(500).json({ ok: false, error: 'Server misconfiguration' })
  }

  const body = req.body
  const { target, filename, authUser, authPass } = body

  // 用户鉴权
  if (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS) {
    return res.status(401).json({ ok: false, error: 'Authentication failed' })
  }

  // target 校验
  if (!target || !ALLOWED_TARGETS[target]) {
    return res.status(400).json({ ok: false, error: 'Invalid target' })
  }

  // filename 校验
  if (!validateFilename(filename)) {
    return res.status(400).json({ ok: false, error: 'Invalid filename' })
  }

  const dir = ALLOWED_TARGETS[target]
  const normalizedFilename = filename.toLowerCase().endsWith('.md')
    ? filename.toLowerCase()
    : `${filename.toLowerCase()}.md`
  const filePath = `${dir}/${normalizedFilename}`

  // GitHub Commits API
  const commitsUrl = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/commits?path=${encodeURIComponent(filePath)}&per_page=20`

  try {
    const ghRes = await fetch(commitsUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'VuePress-Publish-API/1.0',
      },
    })

    if (!ghRes.ok) {
      const errData = await ghRes.json().catch(() => ({}))
      return res.status(502).json({
        ok: false,
        error: errData.message || `GitHub API error (${ghRes.status})`,
      })
    }

    const commits = await ghRes.json()

    const formatted = commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit?.message?.split('\n')[0] || '',
      date: c.commit?.author?.date?.slice(0, 10) || '',
      htmlUrl: c.html_url,
    }))

    return res.status(200).json({ ok: true, commits: formatted })
  } catch (err) {
    console.error('GitHub request failed:', err)
    return res.status(502).json({ ok: false, error: 'Failed to connect to GitHub' })
  }
}
