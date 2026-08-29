const fs = require('fs')
const path = require('path')

const ALLOWED_TARGETS = {
  article: 'docs/article',
  tech: 'docs/tech',
}

const GITHUB_API_BASE = 'https://api.github.com'

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return false
  return /^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5-]{0,100}$/.test(slug)
}

function isLocalDev() {
  return process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === 'development'
}

function localPath(filePath) {
  return path.join(process.cwd(), filePath)
}

function readLocal(filePath) {
  try {
    const fullPath = localPath(filePath)
    if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath, 'utf-8')
  } catch (error) {
    console.error('[Delete-Batch] read local failed:', filePath, error.message)
  }
  return null
}

function saveLocal(filePath, content) {
  try {
    fs.writeFileSync(localPath(filePath), content, 'utf-8')
    return true
  } catch (error) {
    console.error('[Delete-Batch] save local failed:', filePath, error.message)
    return false
  }
}

function deleteLocal(filePath) {
  try {
    const fullPath = localPath(filePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      return true
    }
  } catch (error) {
    console.error('[Delete-Batch] delete local failed:', filePath, error.message)
  }
  return false
}

async function githubFetch(token, url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      ...(options.headers || {}),
    },
  })
}

async function getFileSha(token, repo, filePath, branch) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${filePath}?ref=${branch}`
    const res = await githubFetch(token, url)
    if (!res.ok) return null
    const data = await res.json()
    return data.sha || null
  } catch {
    return null
  }
}

async function getFileContent(token, repo, filePath, branch) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${filePath}?ref=${branch}`
    const res = await githubFetch(token, url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.content) return null
    return Buffer.from(data.content, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

async function createBatchDeleteCommit(token, repo, branch, message, filesToDelete, filesToUpdate) {
  const refUrl = `${GITHUB_API_BASE}/repos/${repo}/git/refs/heads/${branch}`
  const refRes = await githubFetch(token, refUrl)
  if (!refRes.ok) throw new Error('Failed to get branch ref')

  const latestCommitSha = (await refRes.json()).object.sha
  const commitUrl = `${GITHUB_API_BASE}/repos/${repo}/git/commits/${latestCommitSha}`
  const commitRes = await githubFetch(token, commitUrl)
  if (!commitRes.ok) throw new Error('Failed to get commit')

  const baseTreeSha = (await commitRes.json()).tree.sha
  const tree = [
    ...filesToDelete.map(file => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: null,
    })),
    ...filesToUpdate.map(file => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content,
    })),
  ]

  const treeRes = await githubFetch(token, `${GITHUB_API_BASE}/repos/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  })
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${await treeRes.text()}`)

  const newTreeSha = (await treeRes.json()).sha
  const newCommitRes = await githubFetch(token, `${GITHUB_API_BASE}/repos/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: newTreeSha,
      parents: [latestCommitSha],
    }),
  })
  if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${await newCommitRes.text()}`)

  const newCommitSha = (await newCommitRes.json()).sha
  const updateRefRes = await githubFetch(token, refUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommitSha, force: false }),
  })
  if (!updateRefRes.ok) throw new Error(`Failed to update ref: ${await updateRefRes.text()}`)

  return newCommitSha
}

function removeLegacyReadmeItem(content, slug) {
  const targetHref = `/article/${slug}.html`
  const lines = content.split('\n')
  const result = []
  let skipMode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.includes('<li') && line.includes('lk-blog__item') && !line.includes('</li>')) {
      let hasTarget = false
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        if (lines[j].includes(targetHref)) {
          hasTarget = true
          break
        }
        if ((lines[j].includes('<li') && j > i) || lines[j].includes('</li>')) break
      }

      if (hasTarget) {
        skipMode = true
        continue
      }
    }

    if (skipMode) {
      if (line.includes('</li>')) skipMode = false
      continue
    }

    result.push(line)
  }

  return result.join('\n')
}

function removeObjectByMarker(content, marker) {
  const markerIndex = content.indexOf(marker)
  if (markerIndex === -1) return content

  const start = content.lastIndexOf('\n  {', markerIndex)
  if (start === -1) return content

  let end = content.indexOf('\n  },', markerIndex)
  let trailingLength = 5
  if (end === -1) {
    end = content.indexOf('\n  }', markerIndex)
    trailingLength = 4
  }
  if (end === -1) return content

  return content.slice(0, start) + content.slice(end + trailingLength)
}

function removeArticleIndexItem(content, slug) {
  return removeObjectByMarker(content, `slug: '${slug}'`)
}

function removeAboutFeedItems(content, slug) {
  let next = content
  let prev
  const hrefMarker = `href: '/article/${slug}.html'`
  do {
    prev = next
    next = removeObjectByMarker(next, hrefMarker)
  } while (next !== prev)
  return next
}

function upsertUpdate(filesToUpdate, filePath, content) {
  const existing = filesToUpdate.find(file => file.path === filePath)
  if (existing) existing.content = content
  else filesToUpdate.push({ path: filePath, content })
}

async function readSourceFile(token, repo, branch, filePath) {
  if (isLocalDev()) {
    const local = readLocal(filePath)
    if (local !== null) return local
  }
  return getFileContent(token, repo, filePath, branch)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).send('')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const LK_SITE_USER = process.env.LK_SITE_USER
    const LK_SITE_PASS = process.env.LK_SITE_PASS
    const GITHUB_REPO = process.env.GITHUB_REPO
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

    if (!GITHUB_TOKEN || !LK_SITE_USER || !LK_SITE_PASS || !GITHUB_REPO) {
      return res.status(500).json({ ok: false, error: 'Server misconfiguration' })
    }

    const { target, slugs, authUser, authPass } = req.body || {}
    if (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS) {
      return res.status(401).json({ ok: false, error: 'Authentication failed' })
    }
    if (!target || !ALLOWED_TARGETS[target]) {
      return res.status(400).json({ ok: false, error: 'Invalid target' })
    }
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ ok: false, error: 'No slugs provided' })
    }
    for (const slug of slugs) {
      if (!validateSlug(slug)) return res.status(400).json({ ok: false, error: `Invalid slug: ${slug}` })
    }

    const dir = ALLOWED_TARGETS[target]
    const filesToDelete = []
    const filesToUpdate = []
    const succeededSlugs = []

    for (const slug of slugs) {
      const filePath = `${dir}/${slug}.md`
      const sha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, filePath, GITHUB_BRANCH)

      if (sha) {
        filesToDelete.push({ path: filePath, sha })
        succeededSlugs.push(slug)
      }
    }

    if (succeededSlugs.length === 0) {
      return res.status(200).json({ ok: true, deleted: 0, message: 'No files to delete' })
    }

    if (target === 'article') {
      const listPath = 'docs/article/README.md'
      const listContent = await readSourceFile(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, listPath)
      if (listContent) {
        let next = listContent
        for (const slug of succeededSlugs) next = removeLegacyReadmeItem(next, slug)
        if (next !== listContent) {
          upsertUpdate(filesToUpdate, listPath, next)
          if (isLocalDev()) saveLocal(listPath, next)
        }
      }

      const articleIndexPath = 'docs/.vuepress/components/ArticleIndexList.vue'
      const articleIndexContent = await readSourceFile(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, articleIndexPath)
      if (articleIndexContent) {
        let next = articleIndexContent
        for (const slug of succeededSlugs) next = removeArticleIndexItem(next, slug)
        if (next !== articleIndexContent) {
          upsertUpdate(filesToUpdate, articleIndexPath, next)
          if (isLocalDev()) saveLocal(articleIndexPath, next)
        }
      }

      const aboutFeedPath = 'docs/.vuepress/data/aboutArticleFeed.js'
      const aboutFeedContent = await readSourceFile(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, aboutFeedPath)
      if (aboutFeedContent) {
        let next = aboutFeedContent
        for (const slug of succeededSlugs) next = removeAboutFeedItems(next, slug)
        if (next !== aboutFeedContent) {
          upsertUpdate(filesToUpdate, aboutFeedPath, next)
          if (isLocalDev()) saveLocal(aboutFeedPath, next)
        }
      }
    }

    let commitSha = null
    if (filesToDelete.length > 0 || filesToUpdate.length > 0) {
      commitSha = await createBatchDeleteCommit(
        GITHUB_TOKEN,
        GITHUB_REPO,
        GITHUB_BRANCH,
        `批量删除 ${succeededSlugs.length} 篇文章: ${succeededSlugs.join(', ')}`,
        filesToDelete,
        filesToUpdate,
      )
    }

    if (isLocalDev() && commitSha) {
      for (const slug of succeededSlugs) deleteLocal(`${dir}/${slug}.md`)
    }

    return res.status(200).json({
      ok: true,
      deleted: succeededSlugs.length,
      commitSha,
      slugs: succeededSlugs,
      updated: filesToUpdate.map(file => file.path),
    })
  } catch (error) {
    console.error('[Delete-Batch] Error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Internal server error' })
  }
}
