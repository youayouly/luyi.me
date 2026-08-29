import { config } from 'dotenv'
import fs from 'fs'

config({ path: '.env.local' })
config()

const API_KEY = process.env.SILICONFLOW_API_KEY
const dir = 'docs/.vuepress/public/gallery'

if (!API_KEY) {
  throw new Error('Missing SILICONFLOW_API_KEY')
}

const items = [
  {
    title: 'Blog Publishing Workflow',
    slug: 'pm-blog-publishing-workflow',
    prompt:
      'Editorial product case cover for a content publishing workflow. Clean modern illustration with document cards, review queue, publish pipeline, teal and deep blue palette, polished SaaS visual language, no text, no letters, no watermark.',
  },
  {
    title: 'AI Cover Workflow',
    slug: 'pm-ai-cover-workflow',
    prompt:
      'Editorial illustration for AI image generation workflow. Neural image nodes, prompt-to-image pipeline, vibrant cyan and indigo lighting, modern product operations style, no text, no letters, no watermark.',
  },
  {
    title: 'Study Abroad Planner',
    slug: 'pm-study-abroad-planner',
    prompt:
      'Product cover illustration for a study abroad planning tool. World map, route lines, school pins, planner cards, warm gold and blue palette, polished product case style, no text, no letters, no watermark.',
  },
  {
    title: 'PM Portfolio PRD',
    slug: 'pm-portfolio-prd',
    prompt:
      'Elegant product management portfolio cover. Structured cards, roadmap, hiring narrative, clean premium white and blue interface illustration, no text, no letters, no watermark.',
  },
  {
    title: 'Projects Pagination',
    slug: 'pm-projects-pagination',
    prompt:
      'Modern interface illustration of project pagination and information architecture. Layered cards, pagination controls, structured browsing flow, calm blue-green palette, no text, no letters, no watermark.',
  },
  {
    title: 'Article Index Design',
    slug: 'pm-article-index-design',
    prompt:
      'Product design illustration for an article discovery index. Curated cards, tags, sorting and discovery elements, bright editorial palette, polished modern website look, no text, no letters, no watermark.',
  },
]

async function generate(item) {
  const res = await fetch('https://api.siliconflow.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt: item.prompt,
      image_size: '1024x768',
    }),
  })
  if (!res.ok) throw new Error(`API error: ${await res.text()}`)
  const data = await res.json()
  const url = data.images?.[0]?.url || data.data?.[0]?.url
  if (!url) throw new Error('No image URL')
  const imgRes = await fetch(url)
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const filename = `proj-card-${item.slug}-${Date.now()}.png`
  fs.writeFileSync(`${dir}/${filename}`, buf)
  return `/gallery/${filename}`
}

for (const item of items) {
  const url = await generate(item)
  console.log(JSON.stringify({ title: item.title, url }))
  await new Promise((resolve) => setTimeout(resolve, 2200))
}
