import dotenv from 'dotenv'
import { createRequire } from 'module'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })
process.env.COVER_SKIP_GIT_ADD = '1'

const require = createRequire(import.meta.url)
const coverHandler = require('../api/cover.js')

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {
    title: 'SiliconFlow cover integration test',
    keywords: ['AI', 'cover', 'technical blog'],
    summary: 'A focused test for SiliconFlow text-to-image cover generation.',
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--title' && args[i + 1]) params.title = args[++i]
    else if ((arg === '--keywords' || arg === '-k') && args[i + 1]) {
      params.keywords = args[++i].split(',').map(item => item.trim()).filter(Boolean)
    } else if (arg === '--summary' && args[i + 1]) params.summary = args[++i]
  }

  return params
}

function createMockResponse() {
  const headers = new Map()
  const response = {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers.set(name, value)
    },
    status(code) {
      response.statusCode = code
      return response
    },
    json(payload) {
      response.body = payload
      return response
    },
    send(payload) {
      response.body = payload
      return response
    },
  }
  return response
}

async function main() {
  if (!process.env.SILICONFLOW_API_KEY) {
    throw new Error('Missing SILICONFLOW_API_KEY. Set it in the environment or .env before running this test.')
  }

  const params = parseArgs()
  const req = {
    method: 'POST',
    body: {
      ...params,
      backend: 'siliconflow',
      strictBackend: true,
      authUser: process.env.LK_SITE_USER,
      authPass: process.env.LK_SITE_PASS,
    },
  }
  const res = createMockResponse()

  await coverHandler(req, res)
  const data = res.body

  if (res.statusCode !== 200 || !data?.ok) {
    throw new Error(`Cover API failed: ${res.statusCode} ${JSON.stringify(data)}`)
  }
  if (data.backend !== 'siliconflow' || data.fallbackUsed) {
    throw new Error(`SiliconFlow was not used: ${JSON.stringify({ backend: data.backend, fallbackUsed: data.fallbackUsed, errors: data.errors })}`)
  }
  if (!data.localSaved || !data.imageUrl) {
    throw new Error(`Generated image was not saved locally: ${JSON.stringify(data)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    backend: data.backend,
    imageUrl: data.imageUrl,
    localPath: data.localPath,
  }, null, 2))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
