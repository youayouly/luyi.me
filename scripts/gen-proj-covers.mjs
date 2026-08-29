import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
config({ path: path.join(root, '.env.local') })
config({ path: path.join(root, '.env') })

const API_KEY = process.env.SILICONFLOW_API_KEY
if (!API_KEY) {
  console.error('Missing SILICONFLOW_API_KEY — add to blog 根目录 .env.local（勿提交 Git）')
  process.exit(1)
}
const dir = 'docs/.vuepress/public/gallery'

const items = [
  {
    title: 'Blog Publishing Workflow',
    slug: 'blog-publishing-workflow',
    prompt: 'Minimalist flat design illustration of a content publishing pipeline. Clean geometric shapes representing documents flowing through stages, soft teal and slate blue gradient background, subtle paper fold icons, modern UI card elements, no text, no letters, professional product design style, high quality vector art feel'
  },
  {
    title: 'AI Cover Workflow',
    slug: 'ai-cover-workflow',
    prompt: 'Modern flat design illustration of an AI image generation workflow. Abstract neural network nodes connected by flowing lines, soft purple and cyan gradient background, clean geometric camera and image frame icons, minimal UI dashboard elements, no text, no letters, professional tech illustration style'
  },
  {
    title: 'Study Abroad Planner',
    slug: 'study-abroad-planner',
    prompt: 'Clean flat design illustration of education planning and global study. Minimalist world map with soft pin markers, warm amber and cream color palette, geometric graduation cap and compass icons, clean grid layout elements, no text, no letters, modern editorial illustration style'
  },
  {
    title: 'PM Portfolio PRD',
    slug: 'pm-portfolio-prd',
    prompt: 'Professional flat design illustration of product management portfolio. Clean Kanban board with colorful cards, soft indigo and white gradient, geometric pie charts and user story icons, minimal wireframe elements, no text, no letters, modern corporate design style'
  },
  {
    title: 'Projects Pagination',
    slug: 'projects-pagination',
    prompt: 'Minimalist flat design of a paginated grid interface. Clean card grid layout with soft shadows, muted blue-grey tones, geometric page navigation elements, subtle hover state indicators, no text, no letters, modern UI component illustration, high quality design'
  },
  {
    title: 'AI Key Router',
    slug: 'ai-key-router',
    prompt: 'Modern flat design illustration of API routing and key management. Abstract network nodes with directional arrows, dark navy background with bright cyan accent lines, geometric key and lock icons, clean flowchart elements, no text, no letters, technical infrastructure illustration style'
  },
  {
    title: 'Personal Blog System',
    slug: 'personal-blog-system',
    prompt: 'Clean flat design illustration of a modern blog website. Minimalist browser window with elegant layout, soft green and white color palette, geometric content blocks and navigation elements, subtle plant decoration, no text, no letters, Scandinavian design style, high quality'
  },
  {
    title: 'Article Batch Ops',
    slug: 'article-batch-ops',
    prompt: 'Professional flat design of batch document operations. Stack of document cards with checkmark overlays, soft orange and grey gradient background, geometric progress indicators, clean queue visualization, no text, no letters, modern SaaS illustration style'
  },
  {
    title: 'Projects Entry Grid',
    slug: 'projects-entry-grid',
    prompt: 'Minimalist flat design of a project card grid interface. Clean masonry layout with rounded cards, soft gradient backgrounds in muted pastels, geometric filter tags at top, clean spacing and alignment, no text, no letters, modern portfolio website design, high quality'
  },
  {
    title: 'VuePress Stack Notes',
    slug: 'vuepress-stack-notes',
    prompt: 'Clean flat design illustration of Vue.js and documentation system. Minimalist Vue logo-inspired geometric shapes, soft emerald green and charcoal palette, clean code editor elements, organized folder structure icons, no text, no letters, modern developer tools illustration'
  },
  {
    title: 'Navigation Controls',
    slug: 'navigation-controls',
    prompt: 'Minimalist flat design of navigation and UX controls. Clean toggle switches, dropdown menus, and filter components, soft slate blue background, geometric interaction elements, subtle hover state indicators, no text, no letters, modern UI kit illustration style'
  },
  {
    title: 'Article Index',
    slug: 'article-index',
    prompt: 'Professional flat design of a content index and discovery page. Clean tag cloud with soft pill shapes, organized article list layout, warm coral and cream color palette, minimal search and filter elements, no text, no letters, modern content platform illustration'
  },
  {
    title: 'Xinke ICT Competition',
    slug: 'xinke-ict-competition',
    prompt: 'Clean flat design illustration of an embedded systems competition. Circuit board traces with geometric sensor icons, dark green and gold color palette, minimal hardware component illustrations, clean schematic elements, no text, no letters, technical engineering illustration style'
  },
  {
    title: 'National Intelligent Car',
    slug: 'national-intelligent-car',
    prompt: 'Modern flat design of an autonomous robot car competition. Minimalist top-down view of a smart car on a track, soft blue and orange color palette, geometric path planning lines, clean sensor visualization elements, no text, no letters, robotics illustration style'
  },
  {
    title: 'Edge AI Inference',
    slug: 'edge-ai-inference',
    prompt: 'Clean flat design illustration of edge AI deployment. Abstract chip with neural network nodes, dark teal background with bright green accents, geometric device and cloud icons, minimal data flow arrows, no text, no letters, modern IoT illustration style'
  },
  {
    title: 'Vision ML Pipeline',
    slug: 'vision-ml-pipeline',
    prompt: 'Professional flat design of a computer vision ML pipeline. Clean flowchart from camera to model to output, soft purple and blue gradient, geometric convolution filter icons, minimal training progress elements, no text, no letters, modern ML illustration style'
  },
  {
    title: 'LLM RAG Assistant',
    slug: 'llm-rag-assistant',
    prompt: 'Modern flat design illustration of RAG retrieval augmented generation. Abstract document chunks flowing into a brain-like structure, soft indigo and amber gradient, geometric search and retrieval icons, minimal chat interface elements, no text, no letters, AI product illustration style'
  },
  {
    title: 'Prompt Template Library',
    slug: 'prompt-template-library',
    prompt: 'Clean flat design of a prompt template library interface. Organized card grid with colorful template previews, soft pink and violet gradient background, geometric template and code bracket icons, minimal bookmark elements, no text, no letters, modern design tool illustration style'
  },
  {
    title: 'MultiFeed',
    slug: 'multifeed-news',
    prompt: 'Modern flat design illustration of multi-source media aggregation dashboard. Split layout suggesting video cards and news RSS feed tiles, flowing arrows from external platform icons into a unified reader UI, soft teal coral and amber gradient, geometric play button and article list elements, no text, no letters, professional product illustration style'
  },
  {
    title: 'GitHub Console',
    slug: 'github-console',
    prompt: 'Modern flat design illustration of a local developer control console. Clean dashboard layout with project cards, status indicators, preview panels and command workflow blocks, deep navy and electric blue gradient, subtle terminal and browser window motifs, geometric system orchestration lines, no text, no letters, professional AI product illustration style'
  },
]

const slugFilter = process.argv[2]
const runList = slugFilter ? items.filter((i) => i.slug === slugFilter) : items
if (slugFilter && runList.length === 0) {
  console.error(`Unknown slug: ${slugFilter}`)
  process.exit(1)
}

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
      image_size: '1024x576',
    }),
  })
  if (!res.ok) throw new Error(`API error: ${await res.text()}`)
  const data = await res.json()
  const url = data.images?.[0]?.url || data.data?.[0]?.url
  if (!url) throw new Error('No image URL')
  const imgRes = await fetch(url)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const filename = `proj-card-${item.slug}-${Date.now()}.png`
  fs.writeFileSync(`${dir}/${filename}`, buf)
  return `/gallery/${filename}`
}

const results = []
for (const item of runList) {
  try {
    const url = await generate(item)
    console.log(JSON.stringify({ title: item.title, url }))
    results.push({ title: item.title, url })
  } catch (e) {
    console.error('FAIL:', item.title, e.message)
  }
  await new Promise(r => setTimeout(r, 2500))
}
