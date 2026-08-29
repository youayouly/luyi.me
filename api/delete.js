/**
 * Vercel Serverless Function: 批量删除 Markdown 文件
 * 本地开发时：同时删除本地文件
 */

const fs = require('fs')
const path = require('path')

function agentDebugLog(payload) {
  try {
    const line = JSON.stringify({ sessionId: '16cc0b', ...payload, timestamp: Date.now() }) + '\n'
    fs.appendFileSync(path.join(process.cwd(), 'debug-16cc0b.log'), line, 'utf-8')
  } catch (_) {}
}

const ALLOWED_TARGETS = {
  article: 'docs/article',
  tech: 'docs/tech',
}

const GITHUB_API_BASE = 'https://api.github.com'

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return false
  // 支持：小写字母、数字、连字符、中文
  return /^[a-z0-9\u4e00-\u9fa5][a-z0-9\u4e00-\u9fa5-]{0,100}$/.test(slug)
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

async function deleteFile(token, repo, path, message, branch, sha) {
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VuePress-Publish-API/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
  })
  return res
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

function removeItemFromList(content, slug) {
  const targetHref = `/article/${slug}.html`
  console.log(`\n🔍 [removeItemFromList] 开始处理`)
  console.log(`  - 目标 slug: ${slug}`)
  console.log(`  - 目标 href: ${targetHref}`)

  // 按行处理，更可靠的方式
  const lines = content.split('\n')
  const result = []
  let skipMode = false
  let foundTarget = false
  let removedLines = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // 检测 <li class="lk-blog__item"> 开始
    if (line.includes('<li') && line.includes('lk-blog__item') && !line.includes('</li>')) {
      // 检查接下来的几行是否包含目标 href
      let hasTarget = false
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        if (lines[j].includes(targetHref)) {
          hasTarget = true
          break
        }
        // 如果遇到另一个 <li> 或 </li>，停止搜索
        if ((lines[j].includes('<li') && j > i) || lines[j].includes('</li>')) {
          break
        }
      }

      if (hasTarget) {
        skipMode = true
        foundTarget = true
        console.log(`  - 找到目标 <li> 开始位置: 第 ${lineNum} 行`)
        removedLines++
        continue
      }
    }

    if (skipMode) {
      removedLines++
      // 检测 </li> 结束标签
      if (line.includes('</li>')) {
        skipMode = false
        console.log(`  - 找到目标 </li> 结束位置: 第 ${lineNum} 行`)
        continue
      }
      continue
    }

    result.push(line)
  }

  console.log(`  - 找到目标: ${foundTarget}`)
  console.log(`  - 移除行数: ${removedLines}`)
  console.log(`  - 原始行数: ${lines.length}, 结果行数: ${result.length}`)

  return result.join('\n')
}

// 检测是否是本地开发环境
function isLocalDev() {
  return process.env.VERCEL_ENV === undefined || process.env.VERCEL_ENV === 'development'
}

// 删除本地文件
function deleteLocal(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      return true
    }
  } catch (e) {
    console.error('删除本地文件失败:', e.message)
  }
  return false
}

// 保存到本地文件
function saveToLocal(filePath, content) {
  try {
    const fullPath = path.join(process.cwd(), filePath)
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
    const { target, slugs, authUser, authPass } = body

    // 用户鉴权
    if (authUser !== LK_SITE_USER || authPass !== LK_SITE_PASS) {
      return res.status(401).json({ ok: false, error: 'Authentication failed' })
    }

    // 校验
    if (!target || !ALLOWED_TARGETS[target]) {
      return res.status(400).json({ ok: false, error: 'Invalid target' })
    }
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ ok: false, error: 'No slugs provided' })
    }

    // 验证每个 slug
    for (const slug of slugs) {
      if (!validateSlug(slug)) {
        return res.status(400).json({ ok: false, error: `Invalid slug: ${slug}` })
      }
    }

    const dir = ALLOWED_TARGETS[target]
    let deleted = 0
    const errors = []
    const succeededSlugs = []

    // #region agent log
    agentDebugLog({
      runId: 'pre-fix',
      hypothesisId: 'H_B',
      location: 'api/delete.js:entry',
      message: 'delete handler start',
      data: {
        target,
        slugs,
        vercelEnv: process.env.VERCEL_ENV,
        cwd: process.cwd(),
      },
    })
    // #endregion

    // 删除每个文件
    console.log(`\n🔍 [诊断] api/delete.js 开始处理`)
    console.log(`  - 请求删除 slugs:`, slugs)
    console.log(`  - 目标目录:`, dir)
    console.log(`  - 本地开发模式:`, isLocalDev())
    console.log(`  - 工作目录:`, process.cwd())

    for (const slug of slugs) {
      const filePath = `${dir}/${slug}.md`
      const fullPath = path.join(process.cwd(), filePath)

      console.log(`\n🔍 [诊断] 处理 slug: ${slug}`)
      console.log(`  - 相对路径: ${filePath}`)
      console.log(`  - 完整路径: ${fullPath}`)
      console.log(`  - 本地文件存在:`, fs.existsSync(fullPath))

      const sha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, filePath, GITHUB_BRANCH)
      console.log(`  - GitHub SHA:`, sha ? '找到' : '未找到')

      // #region agent log
      agentDebugLog({
        runId: 'pre-fix',
        hypothesisId: 'H_B',
        location: 'api/delete.js:perSlug',
        message: 'github file sha',
        data: { slug, filePath, hasSha: Boolean(sha) },
      })
      // #endregion

      if (sha) {
        console.log(`  - 正在调用 GitHub API 删除...`)
        const delRes = await deleteFile(
          GITHUB_TOKEN, GITHUB_REPO, filePath,
          `删除文章: ${slug}`, GITHUB_BRANCH, sha
        )
        console.log(`  - GitHub API 响应: ${delRes.status} ${delRes.statusText}`)

        if (delRes.ok) {
          deleted++
          succeededSlugs.push(slug)
          console.log(`  - ✅ GitHub 删除成功`)

          // 删除本地文件（在 GitHub 删除成功后）
          if (isLocalDev() && fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath)
              console.log(`  - ✅ 本地文件已删除: ${filePath}`)
            } catch (e) {
              console.log(`  - ⚠️ 本地文件删除失败: ${e.message}`)
            }
          }
        } else {
          errors.push(`${slug}: delete failed`)
          console.log(`  - ❌ GitHub 删除失败`)
        }
      } else {
        const existsLocal = fs.existsSync(fullPath)
        console.log(`  - GitHub 无此文件，本地存在: ${existsLocal}`)

        // #region agent log
        agentDebugLog({
          runId: 'pre-fix',
          hypothesisId: 'H_B',
          location: 'api/delete.js:noSha',
          message: 'github missing file branch',
          data: { slug, filePath, existsLocal, isLocalDev: isLocalDev() },
        })
        // #endregion

        if (!existsLocal) {
          // 远端与本地都没有该 .md：按幂等删除处理，仍可从 README 移除列表项
          deleted++
          succeededSlugs.push(slug)
          console.log(`  - ✅ 文件不存在，视为已删除`)
        } else {
          // GitHub 无此文件但本地有：删除本地文件
          if (isLocalDev()) {
            try {
              fs.unlinkSync(fullPath)
              deleted++
              succeededSlugs.push(slug)
              console.log(`  - ✅ 本地文件已删除（GitHub 无此文件）: ${filePath}`)
            } catch (e) {
              errors.push(`${slug}: local delete failed`)
              console.log(`  - ❌ 本地文件删除失败: ${e.message}`)
            }
          } else {
            errors.push(`${slug}: not found on GitHub`)
            console.log(`  - ❌ GitHub 上未找到文件`)
          }
        }
      }
    }

    console.log(`\n🔍 [诊断] 删除处理完成`)
    console.log(`  - 成功删除: ${deleted}`)
    console.log(`  - 成功的 slugs:`, succeededSlugs)
    console.log(`  - 错误:`, errors)

    // 如果是 article 分区，更新列表页
    if (target === 'article' && deleted > 0) {
      try {
        const listPath = 'docs/article/README.md'
        // 本地开发：优先读取本地文件
        let listContent = isLocalDev() ? readLocal(listPath) : null
        if (!listContent) {
          listContent = await getFileContent(GITHUB_TOKEN, GITHUB_REPO, listPath, GITHUB_BRANCH)
        }

        if (listContent) {
          console.log(`\n🔍 [README更新] 开始处理`)
          console.log(`  - 原始内容长度: ${listContent.length} 字符`)
          console.log(`  - 需要移除的 slugs:`, succeededSlugs)

          // 仅从 README 移除已成功删除的文章
          for (const slug of succeededSlugs) {
            console.log(`\n  处理 slug: ${slug}`)
            const beforeLength = listContent.length
            listContent = removeItemFromList(listContent, slug)
            const afterLength = listContent.length
            console.log(`  - 内容变化: ${beforeLength} -> ${afterLength} (减少 ${beforeLength - afterLength} 字符)`)
          }

          // 安全检查：确保内容仍然有效
          const hasValidStructure = listContent.includes('<ol class="lk-blog__list">') &&
                                    listContent.includes('</ol>') &&
                                    listContent.includes('---')
          console.log(`  - 内容有效性检查: ${hasValidStructure ? '通过' : '失败'}`)

          if (!hasValidStructure) {
            console.error(`  - ❌ README 内容无效，跳过更新`)
            console.log(`  - 内容预览 (前500字符):`, listContent.substring(0, 500))
          } else {
            const listSha = await getFileSha(GITHUB_TOKEN, GITHUB_REPO, listPath, GITHUB_BRANCH)
            if (listSha) {
              const readmeRes = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/contents/${listPath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${GITHUB_TOKEN}`,
                  Accept: 'application/vnd.github+json',
                  'User-Agent': 'VuePress-Publish-API/1.0',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: `更新文章列表：删除 ${deleted} 篇文章`,
                  content: Buffer.from(listContent).toString('base64'),
                  sha: listSha,
                  branch: GITHUB_BRANCH,
                }),
              })
              console.log(`  - README.md GitHub 更新: ${readmeRes.status} ${readmeRes.statusText}`)

              // 保存到本地文件（必须在 GitHub 更新成功后）
              if (readmeRes.ok && isLocalDev()) {
                const localSaved = saveToLocal(listPath, listContent)
                console.log(`  - 本地 README.md 保存: ${localSaved ? '成功' : '失败'}`)
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to update list:', e)
      }
    }

    // #region agent log
    agentDebugLog({
      runId: 'pre-fix',
      hypothesisId: 'H_B',
      location: 'api/delete.js:response',
      message: 'delete handler done',
      data: { deleted, errors, slugsRequested: slugs, succeededSlugs },
    })
    // #endregion

    return res.status(200).json({
      ok: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Handler error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' })
  }
}
