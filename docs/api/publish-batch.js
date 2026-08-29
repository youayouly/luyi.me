/**
 * Vercel Serverless Function: 批量发布 Markdown 文件到 GitHub
 * 一次性创建多篇文章，只创建一个 commit
 */

const fs = require('fs')
const path = require('path')

const ALLOWED_TARGETS = {
  article: 'docs/article',
  tech: 'docs/tech',
}

const GITHUB_API_BASE = 'https://api.github.com'
const FALLBACK_COVER = '/gallery/article-cover-1.png'

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') return false
  const base = filename.toLowerCase()
  if (!base.endsWith('.md') && !base.endsWith('.markdown')) return false
  const nameWithoutExt = base.replace(/\.(md|markdown)$/, '')
  return /^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5-]{0,100}$/.test(nameWithoutExt)
}

async function getFileSha(token, repo, path, branch) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'VuePress-Publish-API/1.0',
      },
    })
    if (res.ok) {
      const data = await res.json()
      return data.sha
    }
  } catch {}
  return null
}

async function getFileContent(token, repo, path, branch) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'VuePress-Publish-API/1.0',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8')
      }
    }
  } catch {}
  return null
}

function readLocalCoverAsset(coverUrl) {
  if (!coverUrl || typeof coverUrl !== 'string' || !coverUrl.startsWith('/gallery/')) return null
  const repoPath = `docs/.vuepress/public${coverUrl}`
  const fullPath = path.join(process.cwd(), repoPath)
  if (!fs.existsSync(fullPath)) return null

  return {
    path: repoPath,
    content: fs.readFileSync(fullPath).toString('base64'),
    encoding: 'base64',
  }
}

async function normalizeCoverUrl(token, repo, branch, coverUrl, files = []) {
  if (!coverUrl || typeof coverUrl !== 'string') return FALLBACK_COVER
  if (coverUrl.startsWith('data:image/')) return coverUrl
  if (/^https?:\/\//i.test(coverUrl)) return coverUrl

  if (coverUrl.startsWith('/gallery/')) {
    const repoPath = `docs/.vuepress/public${coverUrl}`
    const sha = await getFileSha(token, repo, repoPath, branch)
    if (sha) return coverUrl

    const localAsset = readLocalCoverAsset(coverUrl)
    if (localAsset) {
      if (!files.some(file => file.path === localAsset.path)) {
        files.push(localAsset)
      }
      return coverUrl
    }

    return FALLBACK_COVER
  }

  return FALLBACK_COVER
}

// 使用 GitHub Trees API 批量创建/更新文件
async function createBatchCommit(token, repo, branch, message, files) {
  // 1. 获取当前分支的最新 commit
  const refUrl = `${GITHUB_API_BASE}/repos/${repo}/git/refs/heads/${branch}`
  const refRes = await fetch(refUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
    },
  })
  if (!refRes.ok) {
    throw new Error('Failed to get branch ref')
  }
  const refData = await refRes.json()
  const latestCommitSha = refData.object.sha

  // 2. 获取最新 commit 的 tree
  const commitUrl = `${GITHUB_API_BASE}/repos/${repo}/git/commits/${latestCommitSha}`
  const commitRes = await fetch(commitUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
    },
  })
  if (!commitRes.ok) {
    throw new Error('Failed to get commit')
  }
  const commitData = await commitRes.json()
  const baseTreeSha = commitData.tree.sha

  // 3. 创建新的 tree，包含所有文件
  const treeItems = []
  for (const file of files) {
    if (file.encoding === 'base64') {
      const blobUrl = `${GITHUB_API_BASE}/repos/${repo}/git/blobs`
      const blobRes = await fetch(blobUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'VuePress-Publish-API/1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: file.content,
          encoding: 'base64',
        }),
      })
      if (!blobRes.ok) {
        const err = await blobRes.text()
        throw new Error(`Failed to create blob for ${file.path}: ${err}`)
      }
      const blobData = await blobRes.json()
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      })
      continue
    }

    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      content: file.content,
    })
  }

  const treeUrl = `${GITHUB_API_BASE}/repos/${repo}/git/trees`
  const treeRes = await fetch(treeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  })
  if (!treeRes.ok) {
    const err = await treeRes.text()
    throw new Error(`Failed to create tree: ${err}`)
  }
  const treeData = await treeRes.json()
  const newTreeSha = treeData.sha

  // 4. 创建新的 commit
  const newCommitUrl = `${GITHUB_API_BASE}/repos/${repo}/git/commits`
  const newCommitRes = await fetch(newCommitUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      tree: newTreeSha,
      parents: [latestCommitSha],
    }),
  })
  if (!newCommitRes.ok) {
    const err = await newCommitRes.text()
    throw new Error(`Failed to create commit: ${err}`)
  }
  const newCommitData = await newCommitRes.json()
  const newCommitSha = newCommitData.sha

  // 5. 更新分支引用
  const updateRefRes = await fetch(refUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sha: newCommitSha,
      force: false,
    }),
  })
  if (!updateRefRes.ok) {
    const err = await updateRefRes.text()
    throw new Error(`Failed to update ref: ${err}`)
  }

  return newCommitSha
}

function generateArticleListItem(slug, title, excerpt, date, itemIndex, coverUrl) {
  const cover = coverUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80'
  const isEven = itemIndex % 2 === 0

  if (isEven) {
    return `    <li class="lk-blog__item">
      <a class="lk-blog__card" href="/article/${slug}.html">
        <div class="lk-blog__text">
          <time class="lk-blog__date" datetime="${date}">${date}</time>
          <h3 class="lk-blog__post-title">${title}</h3>
          <p class="lk-blog__excerpt">${excerpt}</p>
          <div class="lk-blog__meta">
            <span class="lk-blog__read" aria-hidden="true">Read →</span>
          </div>
        </div>
        <img class="lk-blog__cover" src="${cover}" alt="" />
      </a>
    </li>`
  } else {
    return `    <li class="lk-blog__item">
      <a class="lk-blog__card" href="/article/${slug}.html">
        <img class="lk-blog__cover" src="${cover}" alt="" />
        <div class="lk-blog__text">
          <time class="lk-blog__date" datetime="${date}">${date}</time>
          <h3 class="lk-blog__post-title">${title}</h3>
          <p class="lk-blog__excerpt">${excerpt}</p>
          <div class="lk-blog__meta">
            <span class="lk-blog__read" aria-hidden="true">Read →</span>
          </div>
        </div>
      </a>
    </li>`
  }
}

function updateArticleList(originalContent, newItems) {
  const listStart = originalContent.indexOf('<ol class="lk-blog__list">')
  if (listStart === -1) return null

  const olEnd = originalContent.indexOf('>', listStart) + 1
  const before = originalContent.slice(0, olEnd)
  const after = originalContent.slice(olEnd)

  // 按顺序插入所有新条目
  const newContent = newItems.join('\n')
  return before + '\n' + newContent + after
}

function countExistingItems(content) {
  const matches = content.match(/<li class="lk-blog__item/g)
  return matches ? matches.length : 0
}

function escapeJsString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
}

function guessTags(title, excerpt) {
  const text = `${title} ${excerpt}`.toLowerCase()
  if (text.includes('agent') || text.includes('mcp') || text.includes('infra')) return ['Agent', 'Infra']
  if (text.includes('prompt') || text.includes('模板')) return ['Prompt', 'Workflow']
  if (text.includes('openclaw') || text.includes('langchain') || text.includes('大模型')) return ['AI', 'Local']
  return ['Article']
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

function generateArticleIndexObject(item) {
  const tags = guessTags(item.title, item.excerpt).map(tag => `'${escapeJsString(tag)}'`).join(', ')
  return `  {
    slug: '${escapeJsString(item.slug)}',
    href: '/article/${escapeJsString(item.slug)}.html',
    cover: '${escapeJsString(item.cover)}',
    date: '${escapeJsString(item.date)}',
    title: '${escapeJsString(item.title)}',
    excerpt: '${escapeJsString(item.excerpt)}',
    tags: [${tags}],
  },`
}

function updateArticleIndexList(content, items) {
  const marker = 'const articles = [\n'
  if (!content.includes(marker)) return null

  let next = content
  for (const item of items) {
    next = removeObjectByMarker(next, `slug: '${item.slug}'`)
  }

  const insertion = items.map(generateArticleIndexObject).join('\n')
  return next.replace(marker, `${marker}${insertion}\n`)
}

function readSourceFile(token, repo, branch, filePath) {
  if (isLocalDev()) {
    const local = readLocal(filePath)
    if (local !== null) return Promise.resolve(local)
  }
  return getFileContent(token, repo, filePath, branch)
}

function isLocalDev() {
  return process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === 'development'
}

function saveToLocal(filePath, content) {
  try {
    const fullPath = path.join(process.cwd(), filePath)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(fullPath, content, 'utf-8')
    return true
  } catch (e) {
    console.error('保存本地文件失败:', e.message)
    return false
  }
}

function readLocal(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath)
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8')
    }
  } catch (e) {
    console.error('读取本地文件失败:', e.message)
  }
  return null
}

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
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN
    const LK_SITE_USER = process.env.LK_SITE_USER
    const LK_SITE_PASS = process.env.LK_SITE_PASS
    const GITHUB_REPO = process.env.GITHUB_REPO
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

    if (!GITHUB_TOKEN || !LK_SITE_USER || !LK_SITE_PASS || !GITHUB_REPO) {
      return res.status(500).json({ ok: false, error: 'Server misconfiguration' })
    }

    const body = req.body || {}
    const { articles, commitMessage, authUser, authPass } = body

    // 用户鉴权
    if (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS) {
      return res.status(401).json({ ok: false, error: 'Authentication failed' })
    }

    // 校验
    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ ok: false, error: 'No articles provided' })
    }
    if (!commitMessage) {
      return res.status(400).json({ ok: false, error: 'Missing commitMessage' })
    }

    console.log(`[Publish-Batch] 开始批量发布 ${articles.length} 篇文章`)

    const files = []
    const articleItems = []
    let successCount = 0

    // 准备所有文章文件
    for (const article of articles) {
      const { target, filename, title, excerpt, content, cover } = article

      if (!target || !ALLOWED_TARGETS[target]) {
        console.error(`[Publish-Batch] Invalid target: ${target}`)
        continue
      }
      if (!validateFilename(filename)) {
        console.error(`[Publish-Batch] Invalid filename: ${filename}`)
        continue
      }
      if (!title || !content) {
        console.error(`[Publish-Batch] Missing title or content: ${filename}`)
        continue
      }

      const dir = ALLOWED_TARGETS[target]
      const normalizedFilename = filename.toLowerCase().endsWith('.md')
        ? filename.toLowerCase()
        : `${filename.toLowerCase()}.md`
      const slug = normalizedFilename.replace(/\.md$/, '')
      const filePath = `${dir}/${normalizedFilename}`
      const safeCover = await normalizeCoverUrl(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, cover, files)

      const now = new Date()
      // 使用标准 ISO 格式：YYYY-MM-DDTHH:mm:ss+08:00
      const dateStr = now.toISOString()

      const articleContent = `---
title: ${title}
date: ${dateStr}
---

${content}`

      files.push({
        path: filePath,
        content: articleContent,
      })

      // 保存到本地
      if (isLocalDev()) {
        saveToLocal(filePath, articleContent)
      }

      // 准备 README 列表项
      if (target === 'article') {
        articleItems.push({
          slug,
          title,
          excerpt: excerpt || '暂无摘要',
          date: dateStr,
          cover: safeCover,
        })
      }

      successCount++
      console.log(`[Publish-Batch] 准备文章: ${slug}`)
    }

    if (files.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid articles' })
    }

    // 如果有 article 分区的文章，更新 README
    if (articleItems.length > 0) {
      const listPath = 'docs/article/README.md'
      let listContent = isLocalDev() ? readLocal(listPath) : null
      if (!listContent) {
        listContent = await getFileContent(GITHUB_TOKEN, GITHUB_REPO, listPath, GITHUB_BRANCH)
      }

      if (listContent) {
        const existingCount = countExistingItems(listContent)
        const newItems = articleItems.map((item, index) =>
          generateArticleListItem(item.slug, item.title, item.excerpt, item.date, existingCount + index, item.cover)
        )

        const updatedList = updateArticleList(listContent, newItems)
        if (updatedList) {
          files.push({
            path: listPath,
            content: updatedList,
          })

          // 保存到本地
          if (isLocalDev()) {
            saveToLocal(listPath, updatedList)
          }

          console.log(`[Publish-Batch] 准备更新 README，新增 ${articleItems.length} 篇文章`)
        }
      }
    }

    if (articleItems.length > 0) {
      const articleIndexPath = 'docs/.vuepress/components/ArticleIndexList.vue'
      const articleIndexContent = await readSourceFile(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, articleIndexPath)
      if (articleIndexContent) {
        const updatedIndex = updateArticleIndexList(articleIndexContent, articleItems)
        if (updatedIndex && updatedIndex !== articleIndexContent) {
          files.push({
            path: articleIndexPath,
            content: updatedIndex,
          })
          if (isLocalDev()) {
            saveToLocal(articleIndexPath, updatedIndex)
          }
          console.log(`[Publish-Batch] 准备更新 ArticleIndexList，新增 ${articleItems.length} 篇文章`)
        }
      }
    }

    // 一次性提交所有文件
    console.log(`[Publish-Batch] 开始提交 ${files.length} 个文件...`)
    const commitSha = await createBatchCommit(
      GITHUB_TOKEN,
      GITHUB_REPO,
      GITHUB_BRANCH,
      `${commitMessage} (批量发布 ${successCount} 篇文章)`,
      files
    )

    console.log(`[Publish-Batch] 提交成功: ${commitSha}`)

    return res.status(200).json({
      ok: true,
      count: successCount,
      commitSha,
      filesCount: files.length,
    })
  } catch (err) {
    console.error('[Publish-Batch] Error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' })
  }
}
