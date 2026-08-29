---
title: PM Portfolio PRD
comment: false
toc: true
sidebar: false
---

# PM Portfolio PRD

## 1. Background

The current site is a personal technical blog with About, Articles, Projects, Study Abroad, and Album sections. It shows personality and technical learning, but it does not yet answer the most important recruiter question for a Product Manager role:

> Can this person identify user problems, make product decisions, communicate clearly, and drive measurable outcomes?

This PRD defines a recruiter-facing Product Manager portfolio layer while preserving the existing blog as supporting evidence.

## 2. Goal

Create a PM-focused entry experience that helps recruiters understand Luke as a Product Manager candidate within 90 seconds.

Primary goals:

- Present a clear PM positioning and target role.
- Highlight 2-3 product case studies with problem, role, process, decision, and outcome.
- Keep technical blog/articles as credibility support, not the first impression.
- Allow site owner to adjust recruiter-facing content from a simple local data/config layer.
- Avoid deleting the existing personal site.

Non-goals:

- Do not rebuild the full site from scratch in phase 1.
- Do not create a heavy CMS or database-backed admin system yet.
- Do not hide all personality/life content permanently.
- Do not invent fake metrics.

## 3. Target Users

### Recruiter / Hiring Manager

Needs:

- Quickly understand target role and fit.
- See relevant product thinking.
- Find resume/contact links.
- Skim projects without reading long blog posts.

Success behavior:

- Opens PM page.
- Scans hero, skills, and cases.
- Clicks one case study.
- Downloads resume or contacts candidate.

### Luke / Site Owner

Needs:

- Maintain portfolio content without editing many components.
- Choose which projects/articles appear for recruiting.
- Toggle recruiter mode without losing normal blog site.

Success behavior:

- Updates data file.
- Rebuilds/deploys.
- Sends recruiter-facing URL.

## 4. Recommended Information Architecture

### Keep Existing Site

Existing sections remain available:

- `/about`
- `/article/`
- `/tech/`
- `/study/`
- `/travel/`

### Add PM Recruiter Entry

Recommended new route:

- `/pm/`

Optional later:

- Make `/about` show PM-first layout when `recruiterMode` is enabled.
- Add `/resume/` for downloadable/resume-style page.

## 5. Navigation Requirements

When recruiter mode is enabled:

- Primary nav should emphasize:
  - PM Portfolio
  - Projects
  - Articles
  - About
  - Contact
- Study Abroad and Album should remain accessible but de-emphasized.

When recruiter mode is disabled:

- Keep current personal blog navigation.

Recommended first implementation:

- Add `PM Portfolio` link to navbar.
- Do not remove existing links yet.
- Later add config-driven nav visibility.

## 6. PM Landing Page Structure

Route: `/pm/`

### 6.1 Hero

Purpose: answer "who are you and what role are you targeting?"

Required content:

- Name: Lu Yi / Luke
- Target role: Product Manager Intern / APM / AI Product Manager
- Positioning statement:
  - Example: "Product-minded builder focused on AI tools, developer workflows, and education technology."
- Short proof line:
  - Example: "I combine hands-on engineering, structured writing, and user-centered product thinking."
- Primary actions:
  - Download Resume
  - Contact
  - View Case Studies

### 6.2 Product Skill Snapshot

Purpose: show PM-relevant capability, not just technical skills.

Suggested skill groups:

- Product Discovery
  - user interviews
  - problem framing
  - competitor research
- Product Design
  - PRD
  - information architecture
  - workflow design
  - prototype thinking
- Product Delivery
  - prioritization
  - cross-functional communication
  - launch planning
- Technical Fluency
  - AI tools
  - API integration
  - frontend understanding
  - data/automation awareness

### 6.3 Featured Case Studies

Show 2-3 cases, each card should include:

- Title
- Product area
- One-line problem
- Role
- Key output
- Result or validation metric
- Link to detail page

Recommended case candidates from current site/context:

1. Blog publishing and article management system
   - Product angle: creator workflow, batch publishing, delete/restore, cover generation.
2. AI cover generation workflow
   - Product angle: AI-assisted content operations, fallback design, error handling.
3. Study abroad information planner
   - Product angle: information architecture for decision support.

### 6.4 Case Study Detail Template

Each detail page should use the same structure:

1. Context
2. User/problem
3. My role
4. Goal and constraints
5. Research/insights
6. Solution
7. Prioritization decisions
8. Result/validation
9. Reflection

Important:

- If no real metric exists, use honest proxy metrics:
  - reduced manual steps
  - fewer repeated operations
  - successful build/deploy
  - clearer workflow
  - planned validation metric

### 6.5 Selected Writing

Show only PM-relevant articles, not the full blog list.

Recommended article categories:

- Product thinking
- AI workflow
- Technical product notes
- System design notes

Each card should explain why it matters for PM hiring:

- "Shows structured thinking"
- "Shows technical fluency"
- "Shows workflow and launch awareness"

### 6.6 Contact / Resume

Required:

- Email
- GitHub or portfolio links
- Resume download
- WeChat QR optional

Avoid making contact hidden behind decorative UI.

## 7. Data / Admin Configuration

Phase 1 should use a local data file, not a full backend.

Recommended file:

`docs/.vuepress/data/pmPortfolio.js`

Suggested shape:

```js
export const pmPortfolio = {
  recruiterMode: true,
  hero: {
    name: 'Lu Yi / Luke',
    targetRole: 'Product Manager Intern / APM',
    positioning: 'Product-minded builder focused on AI tools, developer workflows, and education technology.',
    proof: 'I combine hands-on engineering, structured writing, and user-centered product thinking.',
    resumeUrl: '/resume-luke.pdf',
    contactEmail: 'youayouly@gmail.com',
  },
  skills: [
    {
      group: 'Product Discovery',
      items: ['Problem framing', 'User interviews', 'Competitor research'],
    },
  ],
  cases: [
    {
      slug: 'blog-publishing-workflow',
      title: 'Blog Publishing Workflow',
      area: 'Creator Tools',
      problem: 'Publishing and maintaining articles required repeated manual steps.',
      role: 'Product owner and builder',
      output: 'Batch publish, delete, history, and AI cover generation workflow.',
      result: 'Reduced repeated publishing operations and improved content workflow reliability.',
      href: '/pm/blog-publishing-workflow.html',
      featured: true,
    },
  ],
  selectedArticles: [
    {
      title: 'Git Release Map',
      href: '/article/git-release-map.html',
      reason: 'Shows launch and workflow thinking.',
    },
  ],
}
```

Future admin options:

- Toggle `recruiterMode`.
- Edit hero copy.
- Sort case studies.
- Hide/show case studies.
- Select recommended articles.
- Update resume link.
- Toggle nav visibility.

## 8. Visual / UX Requirements

Design principles:

- More portfolio than blog.
- Dense but readable.
- Recruiter-friendly scanning.
- Avoid overly decorative hero.
- Avoid hiding key information behind interactions.

Desktop layout:

- Left or top hero summary.
- Case studies visible above the fold or immediately after hero.
- Resume/contact actions always easy to find.

Mobile layout:

- Hero first.
- CTA buttons stacked.
- Case cards full width.
- Contact section near top and bottom.

Content tone:

- Confident but specific.
- Avoid vague claims like "passionate about product".
- Prefer concrete outcomes and constraints.

## 9. Measurement

Possible success metrics:

- Recruiter can identify target role within 10 seconds.
- Recruiter can find resume/contact within 10 seconds.
- At least 2 case studies are readable without entering blog archive.
- No broken image/resource paths in build/deploy.
- Page builds successfully with current VuePress setup.

Future analytics:

- PM page visits.
- Resume downloads.
- Case study clicks.
- Contact link clicks.

## 10. Implementation Plan

### Phase 1: PM Portfolio MVP

Deliverables:

- Add `/pm/` route.
- Add `pmPortfolio.js` data file.
- Add `PMPortfolioLanding.vue`.
- Add 2-3 case cards.
- Add selected writing section.
- Add contact/resume section.
- Add navbar link.

Acceptance criteria:

- `npm.cmd run build` passes.
- `/pm/` loads on desktop and mobile.
- No secret values exposed.
- PM page does not depend on dev-only localStorage.
- Existing blog routes still work.

### Phase 2: Case Study Detail Pages

Deliverables:

- Add 2-3 case detail pages.
- Use shared case study template.
- Add images/screenshots where useful.

Acceptance criteria:

- Each case explains problem, role, decision, and result.
- No fake metrics.
- Each page links back to PM portfolio.

### Phase 3: Recruiter Mode Configuration

Deliverables:

- Add config flag for recruiter mode.
- Optionally adjust navbar when enabled.
- Optionally make `/about` PM-first.

Acceptance criteria:

- Can switch recruiter mode by editing one config value.
- Personal blog content remains accessible.

## 11. Open Questions

1. Target role:
   - PM Intern, APM, AI Product Manager, Growth PM, or Technical PM?
2. Resume:
   - Is there a final PDF resume file to place under `docs/.vuepress/public/`?
3. Case studies:
   - Which 2-3 projects best represent product thinking?
4. Language:
   - Should PM page be English, Chinese, or bilingual?
5. Visibility:
   - Should `/` redirect to `/pm/` during recruiting season, or should `/pm/` be a separate link?
6. Metrics:
   - Are there real usage numbers, time saved, deployment counts, or feedback quotes available?

## 12. Recommended Next Decision

Recommended first build:

- Create `/pm/` as a separate recruiter-facing page.
- Keep current site intact.
- Make the page English-first with concise Chinese support only if needed.
- Use three cases:
  - Blog publishing workflow
  - AI cover generation workflow
  - Study abroad information planner
- Add one resume PDF link later when the resume is ready.

## 13. Phase 1 Detailed Design

### 13.1 Information Architecture

The PM Portfolio should evolve from a single page into a small recruiter-facing product surface:

```text
/pm/
  PM recruiter landing page

/pm/cases/
  Optional case list page. Phase 1 can skip this and show featured cases on /pm/.

/pm/cases/:slug.html
  Case detail pages

/resume/
  Optional resume page or PDF holder. Phase 1 can use resumeUrl only.

/about/
  Keep the current personal About page. Consider PM-first About only in Phase 3.
```

Recruiter mode navigation:

```text
PM Portfolio / Case Studies / Writing / About / Contact
```

Normal mode navigation:

```text
Keep the current personal blog navigation and add PM Portfolio as one extra entry.
```

### 13.2 PM Landing Modules

#### Hero / Positioning

Purpose: explain who Luke is, what role he is targeting, and why the recruiter should continue reading.

Fields:

```ts
hero: {
  name: string
  displayName: string
  targetRoles: string[]
  headline: string
  subline: string
  proofPoints: string[]
  resumeUrl: string
  contactEmail: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
}
```

Acceptance criteria:

- Name, target role, positioning, Resume, and Contact are visible above the fold.
- The target PM direction is understandable without scrolling.
- CTAs do not depend on hover, animation, or hidden interactions.
- Mobile CTAs are tappable and do not overflow.

#### Fit Snapshot

Purpose: translate "I can code and write" into product-manager evidence.

Fields:

```ts
fitSnapshot: {
  summary: string
  groups: Array<{
    title: string
    evidence: string
    skills: string[]
  }>
}
```

Recommended groups:

- Product Discovery
- Product Design
- Product Delivery
- Technical Fluency

Rules:

- Every skill group must include evidence.
- Keep at most 4 groups.
- Keep each group under 5 skills.
- Avoid vague claims such as "passionate", "hard-working", or "fast learner".

#### Featured Case Studies

Purpose: show product judgment, not a generic project gallery.

Fields:

```ts
cases: Array<{
  slug: string
  title: string
  subtitle: string
  productArea: string
  problem: string
  targetUser: string
  myRole: string
  scope: string
  keyDecisions: string[]
  outputs: string[]
  result: string
  metricType: 'real' | 'proxy' | 'planned'
  metricNote: string
  tags: string[]
  coverImage?: string
  href: string
  featured: boolean
  sortOrder: number
}>
```

Recommended case studies:

1. Blog Publishing Workflow
   - Product area: creator tools
   - Proves: workflow decomposition, MVP scope, content management reliability

2. AI Cover Generation Workflow
   - Product area: AI-assisted content operations
   - Proves: AI product boundaries, failure-state design, manual control

3. Study Abroad Information Planner
   - Product area: decision-support information product
   - Proves: information architecture, comparison dimensions, trust and clarity

Acceptance criteria:

- Show at least 2 featured cases on the homepage.
- Every case card includes problem, role, output/result.
- If no real metric exists, metric type must be `proxy` or `planned`.
- No empty case links.

### 13.3 Case Detail Template

Fields:

```ts
caseDetail: {
  slug: string
  title: string
  oneLine: string
  context: string
  targetUsers: string[]
  problemStatement: string
  myRole: string
  constraints: string[]
  goals: Array<{
    goal: string
    successSignal: string
  }>
  process: Array<{
    step: string
    whatIDid: string
    output: string
  }>
  keyDecisions: Array<{
    decision: string
    alternatives: string[]
    rationale: string
    tradeoff: string
  }>
  solution: Array<{
    module: string
    description: string
  }>
  result: {
    type: 'real' | 'proxy' | 'planned'
    summary: string
    evidence: string[]
  }
  reflection: {
    learned: string
    nextIteration: string[]
  }
}
```

Detail page structure:

1. Case Header
2. Problem
3. Goal and Constraints
4. Process
5. Key Decisions
6. Solution
7. Result / Validation
8. Reflection

Acceptance criteria:

- Every case states target user and problem statement.
- Every case includes at least 2 key decisions.
- Every decision includes rationale and tradeoff.
- Result cannot be only "improved user experience".
- Every case has Back to PM Portfolio and Contact CTA.

### 13.4 Selected Writing

Purpose: make articles function as PM evidence.

Fields:

```ts
selectedWriting: Array<{
  title: string
  href: string
  category: 'Product Thinking' | 'AI Workflow' | 'Technical Product' | 'System Notes'
  reasonForRecruiter: string
  relatedSkill: string
  featured: boolean
}>
```

Rules:

- Show 3-5 selected articles.
- Every selected article needs a "why it matters for PM" note.
- Do not reuse the complete article list.

### 13.5 Contact / Resume

Fields:

```ts
contact: {
  email: string
  resumeUrl: string
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
  wechatQr?: string
  availability?: string
  locationPreference?: string
}
```

Acceptance criteria:

- Contact and resume are available near the top and bottom of `/pm/`.
- Email uses a `mailto:` link.
- Missing resume URL hides the download button instead of producing a 404.
- Contact is not hidden behind hover or a complex modal.

## 14. Phase Acceptance Criteria

### Phase 1 MVP

- Add `/pm/`.
- Keep current pages working.
- Include Hero, Fit Snapshot, Featured Cases, Selected Writing, and Contact.
- At least 2 case cards have complete problem/role/output/result.
- Resume and Contact are findable within 10 seconds.
- Mobile width 375px has no text overflow, button compression, or module overlap.
- `npm.cmd run build` passes.

### Phase 2 Case Detail

- Complete at least 2 case detail pages.
- Use one shared case template.
- Each case includes problem, user, role, goal, constraints, decision, result, and reflection.
- No fake metrics; use real/proxy/planned labeling.
- Each case page has PM Portfolio and Contact CTAs.

### Phase 3 Recruiter Mode

- `recruiterMode` can be switched by one config value.
- When enabled, nav prioritizes PM Portfolio, Case Studies, Writing, About, and Contact.
- When disabled, the current personal blog navigation remains.
- Study, Travel, and Album are not deleted; they are only lowered in priority.
