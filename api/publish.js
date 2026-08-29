/**
 * Vercel Serverless Function: 发布 Markdown 文件到 GitHub
 * 同时更新文章列表页
 * 本地开发时：同时保存到本地文件
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
  // 支持：小写字母、数字、连字符、中文
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
  }
}

async function updateBinaryFile(token, repo, path, base64Content, message, branch, sha) {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}`
  const body = {
    message,
    content: base64Content,
    branch,
  }
  if (sha) body.sha = sha

  return fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function normalizeCoverUrl(token, repo, branch, coverUrl) {
  if (!coverUrl || typeof coverUrl !== 'string') return FALLBACK_COVER
  if (coverUrl.startsWith('data:image/')) return coverUrl
  if (/^https?:\/\//i.test(coverUrl)) return coverUrl

  if (coverUrl.startsWith('/gallery/')) {
    const repoPath = `docs/.vuepress/public${coverUrl}`
    const sha = await getFileSha(token, repo, repoPath, branch)
    if (sha) return coverUrl
    return readLocalCoverAsset(coverUrl) ? coverUrl : FALLBACK_COVER
  }

  return FALLBACK_COVER
}

async function updateFile(token, repo, path, content, message, branch, sha) {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}`
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res
}

function generateArticleListItem(slug, title, excerpt, date, itemIndex, coverUrl) {
  // 使用传入的封面图，如果没有则使用默认图
  const cover = coverUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80'

  // 交替布局：偶数索引文字在左图片在右，奇数索引图片在左文字在右
  const isEven = itemIndex % 2 === 0

  if (isEven) {
    // 文字在左，图片在右
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
    // 图片在左，文字在右
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

function updateArticleList(originalContent, newItem) {
  // 找到 <ol class="lk-blog__list"> 后面的第一个 <li>，在其前面插入新条目（添加到列表开头）
  const listStart = originalContent.indexOf('<ol class="lk-blog__list">')
  if (listStart === -1) return null

  const olEnd = originalContent.indexOf('>', listStart) + 1
  const before = originalContent.slice(0, olEnd)
  const after = originalContent.slice(olEnd)

  // 新条目插入到开头，紧贴 <ol> 标签
  return before + '\n' + newItem + after
}

function countExistingItems(content) {
  // 计算 <li class="lk-blog__item"> 的数量
  const matches = content.match(/<li class="lk-blog__item/g)
  return matches ? matches.length : 0
}

// 检测是否是本地开发环境
function isLocalDev() {
  return process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === 'development'
}

// 保存到本地文件
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

// 读取本地文件
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
    const { target, filename, title, excerpt, content, cover, commitMessage, authUser, authPass } = body

    // 用户鉴权
    if (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS) {
      return res.status(401).json({ ok: false, error: 'Authentication failed' })
    }

    // 校验
    if (!target || !ALLOWED_TARGETS[target]) {
      return res.status(400).json({ ok: false, error: 'Invalid target' })
    }
    if (!validateFilename(filename)) {
      return res.status(400).json({ ok: false, error: 'Invalid filename' })
    }
    if (!title || !excerpt || !content || !commitMessage) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' })
    }

    const dir = ALLOWED_TARGETS[target]
    const normalizedFilename = filename.toLowerCase().endsWith('.md')
      ? filename.toLowerCase()
      : `${filename.toLowerCase()}.md`
    const slug = normalizedFilename.replace(/\.md$/, '')
    const filePath = `${dir}/${normalizedFilename}`
    const safeCover = await normalizeCoverUrl(GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, cover)

    const localCoverAsset = readLocalCoverAsset(safeCover)
    if (localCoverAsset) {
      const coverSha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, localCoverAsset.path, GITHUB_BRANCH)
      if (!coverSha) {
        const coverRes = await updateBinaryFile(
          GITHUB_TOKEN,
          GITHUB_REPO,
          localCoverAsset.path,
          localCoverAsset.content,
          `${commitMessage} (上传封面: ${title})`,
          GITHUB_BRANCH,
          coverSha
        )
        if (!coverRes.ok) {
          const err = await coverRes.json().catch(() => ({}))
          console.error('[Publish] 封面上传失败:', JSON.stringify(err))
        }
      }
    }

    // 获取当前日期（标准 ISO 格式）
    const now = new Date()
    const dateStr = now.toISOString()

    // 1. 创建/更新文章文件
    let articleSha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, filePath, GITHUB_BRANCH)

    // 添加 frontmatter
    const articleContent = `---
title: ${title}
date: ${dateStr}
---

${content}`

    const articleRes = await updateFile(
      GITHUB_TOKEN, GITHUB_REPO, filePath, articleContent,
      `${commitMessage} (创建文章: ${title})`, GITHUB_BRANCH, articleSha
    )

    if (!articleRes.ok) {
      const err = await articleRes.json().catch(() => ({}))
      console.error('[Publish] 文章创建失败:', JSON.stringify(err))
      return res.status(502).json({ ok: false, error: err.message || 'Failed to create article' })
    }

    const articleData = await articleRes.json()
    console.log('[Publish] 文章创建成功:', articleData.content?.html_url)

    // 1.5 本地开发环境：同时保存到本地文件
    let localSaved = false
    if (isLocalDev()) {
      localSaved = saveToLocal(filePath, articleContent)
      console.log(`[本地保存] ${filePath}: ${localSaved ? '成功' : '失败'}`)
    }

    // 2. 如果是 article 分区，更新列表页
    let listUpdated = false
    if (target === 'article') {
      try {
        const listPath = 'docs/article/README.md'
        // 本地开发：优先读取本地文件
        let listContent = isLocalDev() ? readLocal(listPath) : null
        if (!listContent) {
          listContent = await getFileContent(GITHUB_TOKEN, GITHUB_REPO, listPath, GITHUB_BRANCH)
        }

        if (listContent) {
          const existingCount = countExistingItems(listContent)
          const newItem = generateArticleListItem(slug, title, excerpt, dateStr, existingCount, safeCover)
          const updatedList = updateArticleList(listContent, newItem)

          if (updatedList) {
            const listSha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, listPath, GITHUB_BRANCH)
            const listRes = await updateFile(
              GITHUB_TOKEN, GITHUB_REPO, listPath, updatedList,
              `更新文章列表: ${title}`, GITHUB_BRANCH, listSha
            )

            if (!listRes.ok) {
              const listErr = await listRes.json().catch(() => ({}))
              console.error('Failed to update README:', listErr)
              // 不阻止文章发布，但记录错误
            } else {
              listUpdated = true

              // 本地开发：同时保存到本地
              if (isLocalDev()) {
                const localListSaved = saveToLocal(listPath, updatedList)
                console.log(`[本地保存] ${listPath}: ${localListSaved ? '成功' : '失败'}`)
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to update list:', e)
      }
    }

    console.log('[Publish] 推送完成:', { filePath, listUpdated, localSaved })

    return res.status(200).json({
      ok: true,
      path: filePath,
      url: articleData.content?.html_url,
      listUpdated,
      localSaved,
      isLocalDev: isLocalDev(),
    })
  } catch (err) {
    console.error('Handler error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' })
  }
}
