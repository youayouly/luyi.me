# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev         # Start dev server (localhost:8080)
npm run build       # Production build with cache cleanup
npm run build:trace # Build with page-by-page logging for debugging

npm run pretranslate        # Regenerate /i18n/en.json (also runs inside `build`)
npm run pretranslate:check  # Dry run: report how many strings are missing

npm run article       # Article CLI: `new` | `list` | `status` | `push`
                      # (`article:new` / `article:status` / `article:push` are shortcuts)
npm run check         # Compare local vs origin/main article state (debug publish drift)
npm run push          # Commit + push with formatted message
npm run sync:projects # Pull external repos' blog-project.json into project cards
npm run onboard:project # Scaffold a new external project into the registry
npm run sync:article-readme # Push docs/article/README.md to GitHub on its own

npm run gen:china-map   # Regenerate chinaMapOutline.generated.js
npm run gen:proj-cover  # Generate project cover images
npm run gen:about-hero  # Generate the about-page hero image
npm run test:siliconflow-cover # One-off probe of the cover-image provider
```

`build` is three steps in one: `copy-api.mjs` → `vuepress build --clean-cache
--clean-temp` (with `--max-old-space-size=8192`) → `pretranslate.mjs`. A bare
`vuepress build` skips both the API copy and the English HTML rewrite.

### Tests

There is **no test runner and no `npm test`**. `tests/*.test.mjs` are plain
`node:assert` scripts — run one directly:

```bash
node tests/about-quark-layout.test.mjs
```

They are **layout guard tests**: each reads source files (`config.js`, `client.js`,
`.vue`, `.scss`) as *text* and asserts that specific class names, CSS properties, and
code patterns are still present. They do not render anything. Consequence: renaming an
`lk-` class or refactoring a guarded block breaks them even when the site is fine —
read the assertion message, then either restore the invariant or update the test
deliberately. Run all four `about-*` / `github-*` ones after any about-page/mobile layout change.

Two of the files are not layout guards: `admin-session-visitor-log.test.mjs` actually runs
`api/*.js` against an in-memory fake of the Upstash REST endpoint, and
`i18n-first-paint.test.mjs` mixes real calls into `scripts/lib/` with source-text guards on
the runtime translator. Run those after touching auth/visitor endpoints or the i18n pipeline.

## Architecture Overview

**Stack**: VuePress 2.x with `vuepress-theme-hope` theme, Vite bundler.

**Directory Structure**:
- `docs/` - Markdown content (pages are auto-routed from file paths)
- `docs/.vuepress/components/` - Vue components registered globally via `client.js`
- `docs/.vuepress/composables/` - Shared reactive state (e.g. `useProjectsHub` for cross-component role filtering)
- `docs/.vuepress/data/` - Static data files (e.g. `projectsCatalog.js`, `projectRoles.js`)
- `docs/.vuepress/utils/` - Shared utilities (auth, preferences, avatar, navigation)
- `docs/.vuepress/styles/` - Global SCSS (`index.scss` + `palette.scss`)

**Key Patterns**:

1. **Client Entry** (`docs/.vuepress/client.js`): Registers root components and handles route-based logic including Live2D widget, scroll effects, home page enhancements, and route-to-hash scrolling. Uses `defineClientConfig` with `rootComponents` array for site-wide Vue components. Key behaviors:
   - `scrollToRouteHash()` — ensures navigation to hash anchors (e.g. `/about#about-intro`) scrolls correctly
   - `syncRouteDataAttr()` — sets `<html data-lk-route>` for CSS route-based styling during transitions
   - `HomeTypewriterTagline` — mounted as a separate Vue app into the Hope theme hero slot

2. **Global Components**: Registered in `enhance()` and usable directly in markdown:
   - `AboutPageLayoutV2` — hub/homepage layout (used at site root `/`)
   - `AboutMePage` — personal about page (used at `/about`)
   - `ProjectCardsGrid`, `ProjectsSidebarFilters` — projects hub with sidebar role filtering
   - `ProfileCard`, `SiteAvatar`, `SiteFooter`, `ProductManagerCases`, etc.

3. **Build-time Variables**: Injected via Vite's `define` in `config.js`:
   - `__LK_ARTICLE_COUNT__` - Total markdown article count
   - `__LK_TECH_COUNT__` - Tech/project page count
   - `__LK_BUILD_TIME_ISO__` - Build timestamp
   - `__LK_SITE_YEAR__` - Current year for footer
   - `__LK_SITE_ONLINE_SINCE_ISO__` - Site launch date for "running X days" footer (default or `LK_SITE_ONLINE_SINCE` env var)

4. **`config.js` page plugins** (VuePress `extendsPage`, not documented anywhere else):
   - `pagePatterns` excludes `agents/**`, `skills/**`, `*_backup.md`, `test-*.md`.
     It does **not** exclude `superpowers/**` or `projects/**`, so
     `docs/superpowers/plans/*.md` and `docs/projects/*.md` are built as real,
     reachable pages even though they are notes. Add an exclusion here before adding a
     notes folder under `docs/`.
   - `lkTechDetailPagesPlugin` force-writes `sidebar` (an explicit array from
     `buildTechSidebar()`), `toc` and `pageClass: 'page-article-post'` onto every
     `tech/*.md` except the README. Frontmatter you set on a tech page for those three
     keys is overwritten — `sidebar: true` alone does not work, Hope fails to match the
     `/tech` prefix, which is why the array is built by hand.
   - `lkBuildTracePlugin` logs each page when `LK_BUILD_TRACE=1` (what `build:trace` sets).
   - `lkDevApiPlugin` serves `api/*.js` under `vuepress dev` — see the dev caveat above.

5. **Navigation Control**: `navPrefs.js` manages navbar visibility and access control via localStorage events. Pages can be hidden/protected through `navbarPageOptions` and `accessControlledPageOptions`.

6. **Projects Hub**: `useProjectsHub()` composable provides reactive role filtering shared between `ProjectsSidebarFilters` and `ProjectCardsGrid`. Role IDs: `all`, `pm`, `ai-product`, `frontend`, `backend`, `embedded`, `ai-engineering`, `ml`. Synced from URL `?role=` query param via `syncHubRoleFromRoute()`.

7. **Styling Conventions**:
   - CSS classes prefixed with `lk-` for custom styles
   - Use `.lk-` classes in `index.scss` to override theme defaults
   - `data-lk-route` attribute on `<html>` for route-based CSS targeting
   - Components use scoped styles with `<style scoped>`

**Routing**:
- Site root `/` (README.md) = hub/homepage using `AboutPageLayoutV2`
- `/about` = personal about page using `AboutMePage`
- `/tech/` = projects hub with sidebar role filters
- `/article/` = blog article list
- Navbar: 首页 → `/`, 项目 → `/tech/`, 文章 → `/article/`, 生活(留学/相册/统计), 关于我 → `/about#about-intro`

## Article Publishing System

The site includes a custom article publishing system with the following workflows:

### API Endpoints

**`docs/api/` is the source of truth. Root `api/` is generated — never edit it.**
`scripts/copy-api.mjs` copies `docs/api/*.js` over root `api/` on every `dev` and
`build`, so edits made directly in `api/` are silently overwritten.

**The generated root `api/` must still be committed.** Vercel decides which Serverless
Functions to bundle from the files in the repo, *not* from what `buildCommand` produces,
so a function that only exists after the build is never deployed. `/api/` used to be in
`.gitignore` with only eight legacy files tracked; `api/translate-page.js` was never
committed and returned **404 in production** for weeks — that is what turned the navbar
globe red ("翻译失败"), because the runtime fallback endpoint did not exist. Same class of
bug as commit `7f5ea0e`. Workflow: edit `docs/api/`, run `npm run dev` or `npm run build`
once, then commit the regenerated `api/` alongside it.

Also note `copy-api.mjs` only copies `.js` — a `.cjs` helper placed in `docs/api/`
would never reach the deployed function.

Endpoints:
- `/api/publish` - Publish single article
- `/api/publish-batch` - Publish multiple articles in one commit
- `/api/delete` - Delete single article
- `/api/delete-batch` - Delete multiple articles in one commit
- `/api/cover` - Generate article covers using Dify AI
- `/api/history` - Commit history for one file; targets restricted to `docs/article` / `docs/tech`
- `/api/sync` - **Local dev only**; shells out to `git pull origin main`
- `/api/git-push` - **Local dev only**; commits and pushes. Deliberately stages tracked
  changes only (`git add -u`) and refuses `.claude/`, `.cursor/`, `.env*` so the
  "push all changes" button cannot publish secrets or scratch files.
- `/api/translate-page` - Runtime *fallback* translation only. Static text is pre-translated at build time into `/i18n/en.json`; this endpoint now only serves strings the dictionary misses (weather, relative timestamps, freshly published articles).
- `/api/login` - Admin login/logout/session status. See **Admin session** below.
- `/api/visit` - Public; records one visit into Redis. See **Visitor log** below.
- `/api/visitor-log` - Admin-only; reads the visit log and counters.

**Shared server code lives in `lib/`, not `docs/api/`.** Every file in `api/` becomes a
Serverless Function, so a helper placed there would deploy as a handler-less function.
All four files there sit outside `api/` and are pulled in by relative `require`, which
`@vercel/nft` traces into the bundle:

| file | what | used by |
|---|---|---|
| `lk-kv.js` | Upstash REST client | login, visit, visitor-log |
| `lk-admin-auth.js` | session issue/verify/renew, credential fallback, login log | login + every write endpoint |
| `lk-ua.js` | `clientIp()` + `parseUa()` — device/OS/browser/bot from the UA, no npm dep | login, visit |
| `lk-visit-classify.js` | `classifyVisits()` — human-vs-bot score per visit row | visitor-log |

`lk-ua.js`'s header documents what model detection *cannot* do (frozen iOS UA, Chrome
≥110 Android UA reduction) so nobody re-litigates it. `lk-visit-classify.js` scores
0–100 (`HUMAN_MIN` 65 / `BOT_MAX` 35, 50 = no signal) from UA + region + path + time
and **deliberately ignores IP**: the site is behind Cloudflare, so `clientIp()` returns
the CF edge node and one phone hops between edge IPs within minutes. `/api/visitor-log`
runs it over `recent` before responding, and `LoginGate.vue` only renders the verdict —
change the scoring server-side, not in the component.

**Those `require('../lib/…')` paths are written relative to the
*generated* `api/` copy, not to `docs/api/` where the source lives** — `docs/api/` is
only ever copied, never executed, so the path looks wrong in the source tree and is
correct where it runs.

The translation logic is **duplicated, not shared**: `docs/api/translate-page.js` and
`scripts/lib/translate-core.cjs` each carry their own copy. When you change the prompt
or model handling, change both — the file header says so too.

The write endpoints authenticate against `LK_SITE_USER` / `LK_SITE_PASS` and commit via
the GitHub Contents API using `GITHUB_TOKEN` / `GITHUB_REPO` / `GITHUB_BRANCH`. They
write to GitHub, not to the local working tree, so a successful publish does **not**
change local files — pull afterwards.

### Admin session

The admin password used to be **hardcoded in `LoginGate.vue`** (`EXPECT_USER` /
`EXPECT_PASS`), which put it in the public JS bundle, and "logging in" only wrote
`lk_private_ok` into `sessionStorage`. There was no server session, so there was no
limit at all on who or how many people could be logged in.

Now `/api/login` compares against `LK_SITE_USER` / `LK_SITE_PASS` server-side and stores
the issued token at **one Redis key, `lk:admin:session`**. That single key *is* the
single-session rule: a new successful login overwrites it and the previous token dies on
the next request. The token goes back as an HttpOnly `lk_admin` cookie plus a readable,
secret-free `lk_admin_hint=1`. The hint does two jobs: `LoginGate` (which mounts on
every page) skips the session check for anonymous visitors instead of burning a
Serverless invocation each, **and `authGate.js#readAuthed()` uses it as the first-paint
login flag**. It has to — the `lk_private_ok` flag lives in `sessionStorage`, which is
wiped when the tab closes, so "log in, close the page, come back" rendered as logged-out
until `GET /api/login` answered, and the admin entries popped in afterwards. The hint
survives, so the admin UI is there on the first frame and `verifyServerSession()` only
corrects *downward* — and when it does (kicked out, expired) it must call
`clearSessionHint()`, or the next load flashes the same way in reverse. Faking the hint
grants nothing: every write endpoint still demands the HttpOnly token or the credentials.

`SESSION_TTL_SEC` is 7 days and **slides**: every authenticated `GET /api/login` calls
`renewSession()`, which re-`EXPIRE`s the Redis key and re-issues both cookies with a fresh
`Max-Age`. It deliberately does not mint a new token — that would invalidate the copy
another tab is holding. It was 12 hours with no renewal, which meant reliably being logged
out overnight.

`lib/lk-admin-auth.js#verifyAdmin` accepts **either** the session cookie **or**
username/password in the body/headers. The credential path is what keeps the existing
publish/delete callers working unchanged — they still read what the user typed at login
out of `utils/siteApiCreds.js` (`readSiteApiCreds()`, `sessionStorage` keys
`lk_api_user` / `lk_api_pass`, written by `LoginGate.vue` on success). Removing it would
require porting every write endpoint at once.

If `LK_SITE_USER`/`LK_SITE_PASS` or the KV vars are missing, `/api/login` returns 500 /
503 with `needsKv`, and the client renders a specific "server is not configured" message
rather than "wrong password" — a mistake that already cost real debugging time once.

**Login log and throttle.** Every attempt, success *and* failure, is pushed onto
`lk:admin:logins` (capped at 50) with time, IP, parsed device, and the *attempted
username* — never the password; a test asserts the password never appears in the log.
The log is returned by `GET /api/login` **only when the caller is authenticated**, so an
anonymous request cannot learn who has been probing. The `session` object in that same
response is gated the same way (`sessionForCaller`): an anonymous caller gets
`{isMine:false}` and nothing else. It used to carry `at` / `ip` / `ua` for everyone, so a
single unauthenticated `curl` revealed when the owner last logged in, from which IP, on
which device. Do not route `replaced` through that gate — it is returned to the person who
just logged in successfully and needs the full record. Failures also `INCR
lk:admin:fail:<ip>` with a 15-minute TTL; past `FAIL_MAX` (10) that IP gets a 429 with
`Retry-After` even if the password is right. The throttle is per-IP on purpose — someone
else brute-forcing must not be able to lock the owner out. This exists because the
password shipped in the public bundle for months, so it must be assumed known.

**Dev caveat:** `lkDevApiPlugin` in `config.js` busts the require cache for the handler
*and* everything under `lib/`. Only clearing the handler leaves it bound to a stale copy
of `lib/`, which surfaces as "`xyz` is not a function" for code you just fixed.

### Admin UI (who actually calls those endpoints)

Nothing in Markdown mounts the admin surface — it is four `rootComponents` in
`client.js`, each wrapped in `ClientOnly`, so it exists on every page and renders
nothing until `useIsLoggedIn()` (from `utils/authGate.js`) is true:

- **`LoginGate.vue`** (~1.9k lines) — the login sheet *and* the whole control panel:
  visitor log + login log, navbar/access prefs (`navPrefs.js`), avatar
  (`avatarPref.js`), Live2D, home background. It is the only writer of
  `siteApiCreds`.
- **`PublishFab.vue`** (~2.5k lines) — the floating publish/push widget, and the single
  biggest component in the repo. Its queue is **client-side**: articles and deletions
  accumulate in `localStorage` (`lk_pending_articles` / `lk_pending_deletes`, restored
  on mount, conflicting slugs pruned), and one "push" fans out to
  `/api/publish-batch` + `/api/delete-batch`, then `/api/git-push` when the queue is
  empty. Covers are generated via `/api/cover` and re-generated on theme change.
- **`ArticleBatchOps.vue`** — the multi-select strip on `/article/`. It does not call an
  API; it drives checkboxes on `.lk-blog__item[data-slug]` in the DOM and hands slugs to
  `PublishFab` through `window` CustomEvents (`add-pending-delete`,
  `clear-pending-deletes`, `open-push-sheet`, `open-publish-panel`). That event bus is
  the coupling between the two — grep the event name, not an import. **Its selectors are
  currently dead** — see *Article index* below.
- **`SettingsFab.vue`** — the public settings gear (theme/particles/translation), not
  admin-gated.

Both admin components authenticate by sending `authUser` / `authPass` in the JSON body
(the credential path of `verifyAdmin`), *not* the session cookie.

### Visitor log

`/api/visit` is fired from `client.js`'s `router.afterEach` via
`utils/visitorLog.js#reportVisit`, which uses `sendBeacon` so it never competes with page
rendering. Redis keys:

| key | what |
|---|---|
| `lk:visits` | LIST of visit rows, capped by `LTRIM` to 800 |
| `lk:pv` | total page views |
| `lk:uv:<YYYY-MM-DD>` | SET of visitor ids for that day, TTL 45d |
| `lk:visitors` / `:first` / `:hits` | per-visitor profile, first seen, hit count |
| `lk:seen:<vid>:<path>` | 30s dedupe lock (`SET NX EX`) |
| `lk:rate:<ip>:<minute>` | per-IP fixed-window counter, TTL 90s |
| `lk:bots` | crawler requests, counted but never recorded |
| `lk:owner` / `:hits` | the owner's own devices — one field each, overwritten in place |
| `lk:admin:session` | the single admin session (see above) |
| `lk:admin:logins` | admin login attempts, capped at 50 |
| `lk:admin:fail:<ip>` | failed-login counter, 15min TTL |

**The owner's own visits are not recorded as visits at all.** `reportVisit` self-reports `owner: true` when the local auth flag is set; `/api/visit` then skips the detail list, PV, UV and the visitor profiles entirely and instead keeps one field per device in `lk:owner`, overwritten in place (`lk:owner:hits` counts them), capped at `OWNER_MAX` devices. It deliberately **skips the 30s dedupe lock** — that row is a live "where am I right now", and half a minute of staleness would defeat it. `owner` is client-asserted and grants nothing: faking it only removes you from the statistics. `/api/visitor-log` returns those rows as `owner`, the admin panel shows them as 我的设备 above the log, and legacy rows carrying `owner: true` are filtered out of `recent`.

Visitor identity is `sha256(ip + '|' + ua)` truncated to 16 hex — stable per
device+network, no tracking cookie. Geography comes from Vercel's `x-vercel-ip-*`
headers, so there is no third-party geo call. Days are cut at UTC+8 to match the
intuition the old busuanzi numbers set.

`reportVisit` **no-ops on localhost** and `/api/visit` **no-ops when KV is unconfigured**,
both returning success — visitor statistics must never be able to break browsing.

**`/api/visit` is public, so it has four gates**, in this order — the cheap ones first,
because the point is to spend as little as possible on traffic that will be thrown away:

1. **Same-site only.** Browsers always send `Origin` on POST (Fetch spec), `sendBeacon`
   included, so requiring it costs no Redis command and keeps `curl` out. Unlike
   `translate-page.js#isAllowedOrigin`, a *missing* `Origin` is **not** waved through —
   that exemption exists for script callers, and this endpoint only ever has browser
   callers. `Referer` is the fallback; extra hosts go in `LK_VISIT_ALLOWED_ORIGINS`.
2. **Crawlers** (`parseUa().bot`) only bump `lk:bots` — one command, no PV/UV/detail.
   The bot test runs *first* inside `parseUa` because Googlebot's UA contains both
   `Android` and `Chrome/`; checking it later filed crawlers as phones, which is what
   the old version did.
3. **Per-IP rate limit**, `RATE_MAX` 120/min. Over the limit it returns a plain
   `{ok:true}` — deliberately **not** 429: a 429 tells whoever is flooding that they were
   blocked and should rotate IPs. The window is encoded in the key, so re-`EXPIRE`ing on
   every hit cannot stretch it and no `EXPIRE ... NX` support is needed.
4. **Profile cardinality cap**, `VISITOR_MAX` 5000. `lk:visitors` / `:first` / `:hits` are
   HASHes with neither `LTRIM` nor TTL, and vid comes from IP+UA, so rotating the UA used
   to be able to grow them without bound. Past the cap only *existing* vids are updated;
   new ones still count toward PV/UV and still get a row in `lk:visits`.

The layer that actually absorbs volume is a Vercel Firewall rate-limit rule, which drops
the request before the function runs — no invocation, no Upstash commands. The four gates
above are the backstop, not the primary defense.

### Key Scripts:
- `scripts/copy-api.mjs` - Copies API files to root for Vercel deployment
- `scripts/pretranslate.mjs` - Build-time pre-translation; runs after `vuepress build` (wired into `npm run build`). Scans `docs/.vuepress/dist/**/*.html`, extracts unique CJK text nodes via `scripts/lib/html-text-nodes.mjs`, translates only the ones missing from the dictionary, writes `docs/.vuepress/public/i18n/en.json` (committed) and mirrors it into `dist/`. It then **rewrites the built HTML into English** and inlines the reverse map (see *First-paint translation*). No API key -> logs and skips translating, never fails the build, so Vercel ships the committed dictionary without burning quota — the HTML rewrite still runs, since it only needs the dictionary.
- `scripts/article.mjs` - CLI tool for article management (create, push, status)
- `scripts/push.mjs` - Git push utility with commit message formatting
- `scripts/sync-article-readme-to-github.mjs` - Syncs README with GitHub
- `scripts/gen-china-outline.mjs` - Generates China map outline data for `VisitedChinaFootprints`
- `scripts/sync-external-projects.mjs` / `scripts/onboard-external-project.mjs` - External project sync (see below)
- `scripts/check-publish.mjs` (`npm run check`) - Diffs local vs `origin/main` article files and counts; use when a publish appears to have half-landed

### Article index: the list is hand-maintained, and publish no longer feeds it

This changed and the old wiring is still in the tree as dead code — read this before
"fixing" a publish that seems not to show up.

`docs/article/README.md` is now 12 lines that render `<ArticleIndexList />`.
(`docs/article.md` is a near-identical twin; `vercel.json` rewrites `/article` to
`/article/index.html`, so the README is the one actually served.) **The card list lives
in a hardcoded `const articles = [...]` array at `ArticleIndexList.vue:16`** — slug,
href, cover, date, title, excerpt, tags per entry. Publishing an article writes
`docs/article/<slug>.md` but does **not** add it to that array, so a freshly published
article renders at its own URL and is invisible on `/article/` until someone edits the
component.

Two consequences:

- **`publish.js` / `publish-batch.js` still try to inject a `<li class="lk-blog__item">`
  card into `docs/article/README.md`.** `updateArticleList()` looks for
  `<ol class="lk-blog__list">`, which that file no longer contains, so it returns `null`
  and the endpoint reports `listUpdated: false` without erroring. Silent no-op, not a
  failure to debug.
- **`ArticleBatchOps.vue` queries `.lk-blog__item[data-slug]`**, but `ArticleIndexList`
  renders `.lk-article-three__item` / `.lk-article-three__card`. Its selectors match
  nothing on the current page, so the multi-select delete strip is inert. Retargeting it
  means changing the selectors in that component, not the markup of the list.

**`__LK_ARTICLE_COUNT__` is not an article count.** `countArticleMarkdown()` in
`config.js` walks `docs/` recursively and counts every `.md` except `docs/README.md`,
dotfiles, `agents/`, `skills/`, `*_backup.md` and `test-*.md` — currently ~42, against
10 real articles in `docs/article/`. `__LK_TECH_COUNT__` is the honest one: flat
`docs/tech/*.md` minus its README.

### External Projects Sync

Project cards can be sourced from *other* repositories instead of being written here.

- `docs/.vuepress/data/external-projects.registry.json` lists each external repo, the
  `blog-project.json` manifest path inside it, and the `docs/tech/<id>.md` detail page
  it feeds.
- `npm run sync:projects` fetches those manifests and writes
  `externalProjectItems.generated.js`, plus it rewrites the region between
  `<!-- sync-setup-start -->` and `<!-- sync-setup-end -->` inside each detail page.
  **Everything in that region and every `*.generated.js` file is overwritten — edit the
  source manifest instead.**
- The script validates each manifest `role` against its own `VALID_ROLES` set, which
  must stay in sync with `roleMapping` in `docs/.vuepress/data/projectsCatalog.js`.
  Adding a role label in one place and not the other either drops the card or files it
  under `pm` (the fallback).
- `docs/.vuepress/data/blog-project.schema.json` is the manifest schema; hand-written
  cards live in `projectItems.manual.js`.

### Article Cover Generation:
- Uses Dify AI API to generate covers
- Queued processing (serial generation)
- Covers stored in `docs/.vuepress/public/gallery/`
- Supports batch generation with manual application

## Development Notes

### Environment Variables:
Local values live in `.env.local` (gitignored). **Never commit a key**, and never write
one into a file outside `.env.local` — the API routes read everything from `process.env`.

- `GITHUB_TOKEN` / `GITHUB_REPO` / `GITHUB_BRANCH` - Used by the publish/delete/history routes to commit via the GitHub Contents API (`GITHUB_BRANCH` defaults to `main`). Without these the write endpoints return a config error.
- `LK_SITE_USER` / `LK_SITE_PASS` - Credentials the publish/delete routes check before writing
- `LK_PUBLISH_API_URL` - Custom API endpoint for publishing
- `LK_SITE_ONLINE_SINCE` - Override site launch date (ISO 8601, e.g. `2026-03-27T00:00:00+08:00`)
- `DIFY_API_URL` / `DIFY_API_KEY` - For AI cover generation
- `SILICONFLOW_API_KEY` - Also powers `/api/translate-page` (required for the page translation toggle)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` - Upstash Redis, injected by the Vercel Marketplace integration. Backs the admin session and the visitor log. `UPSTASH_REDIS_REST_URL` / `_TOKEN` are accepted as aliases. Without them `/api/login` returns 503 and `/api/visit` silently no-ops.
- `TRANSLATE_MODEL` - Override the translation model (default `Qwen/Qwen3-30B-A3B-Instruct-2507`; avoid thinking-mode models, they are ~10x slower)
- `TRANSLATE_API_BASE` / `TRANSLATE_API_KEY` - Point translation at a different OpenAI-compatible provider
- `TRANSLATE_ALLOWED_ORIGINS` - Extra origins allowed to call `/api/translate-page` (same-origin is always allowed)

### Vercel Deployment:
- API files are copied to root before build via `copy-api.mjs`
- Build process uses `--max-old-space-size=8192` for memory optimization
- The root `/` now serves as the main hub page (not a redirect to `/about`)
- `vercel.json` sets `maxDuration: 120` for `api/**` (cover generation and batch publish are slow), rewrites the extensionless `/about` and `/article` to their `.html` output, and caches `/assets/*` immutably while forcing revalidation on `*.html`. Adding a page that needs an extensionless URL may need a rewrite here.

### Conventions (from `.cursor/rules/`)

These rules apply to Cursor but describe this codebase, so they hold here too:

- **Register before use.** A component is only usable in Markdown after
  `app.component(...)` in `client.js`'s `enhance()`.
- **`lk-` prefix** for every custom class and CSS variable.
- **No `!important`** to beat the Hope theme — raise selector specificity or use
  `:has()`, matching what `index.scss` already does.
- **No `100vw`** on page or grid containers; it blows out the sidebar and centre axis.
  Widen with `min()`, `max-width`, or an existing theme variable, and change a single
  variable rather than removing the cap.
- **Run `npm run build` after layout/style changes** as a regression check.
- **Prose style** (`docs/**`): Chinese, keeping technical terms/paths in English;
  paragraphs of at most 3 lines; each topic structured 问题 → 原因 → 解决; always anchor
  to a real path, component, or config in this repo rather than generic background.
- Large images go in `docs/.vuepress/public/gallery/`, referenced as `/gallery/...`.

Those conventions come from `.cursor/rules/luke-blog-system.mdc`.
`vuepress-hope-site.mdc` additionally pins the about-page grid (`lk-about-v2-main__grid
--triple` is "main + timeline" despite the name; the main column keeps a `max-width` +
`justify-self: start`) and the stats page (`lk-stats-hub--triple`, no page-level
`max-width`). `luke-ai-orchestrator.mdc` is Cursor-only agent routing (`.cursor/skills/`,
`.cursor/agents/`) — it does not describe this codebase and nothing in it applies here.

### Repo layout oddities

- `workspace/` is a notes/archives/templates area (34 tracked files) — **not build
  input**. Same for the root `TASK-ASSIGNMENT.md` / `ERROR-FIX-REPORT.md`, which are
  stale one-off reports.
- Notes folders **under `docs/` are different** — VuePress routes what it is not told to
  skip. `docs/agents/` and `docs/skills/` are excluded by `pagePatterns`;
  `docs/superpowers/plans/` and `docs/projects/` are not, so they ship as pages and are
  counted in `__LK_ARTICLE_COUNT__`.
- `.claude/workflows/*.md` predate the current `package.json` and reference scripts that
  no longer exist (e.g. `npm run publish:batch`). Trust `package.json`.
- The repo lives on Windows (`E:\network\page`); the working tree carries a few stray
  files from past shell mishaps (`#`, `{`, `形成死循环。`) that `.gitignore` swallows.
  Don't try to "clean them up" as part of unrelated work.

### Styling System:
- Theme uses CSS variables for colors (`--vp-c-brand-1`, etc.)
- Custom styles in `index.scss` override theme defaults
- Glassmorphism effects throughout with backdrop-filter
- Responsive design with mobile-first approach
- `data-lk-route` on `<html>` enables route-specific CSS without page class flicker

### Special Features:
- Live2D widget (toggleable in navbar)
- Network particle background effects
- Custom navbar with accessibility controls
- WeChat Moments-style travel pages
- Dynamic article cover generation
- China visited footprints map (`VisitedChinaFootprints`)
- Home page typewriter tagline effect
- Site footer with "running X years X days" counter
- Page translation (navbar globe icon next to the theme toggle): `utils/pageTranslate.js` walks CJK text nodes and swaps text in place. Lookup order is **build-time dictionary `/i18n/<lang>.json` -> per-string `localStorage` cache -> `/api/translate-page`**. Originals are kept in a `WeakMap` so switching back is instant. Skip a subtree with `data-lk-no-translate` or `.lk-no-translate`.
  - The dictionary is why this is fast. Model latency is bound by output tokens (measured ~28 chars/s on `Qwen3-30B-A3B`), so bigger batches/higher concurrency barely help — the only real fix is not calling the model at runtime. Measured on `/about`: **12-20s -> 73ms with 0 API calls**.
  - Regenerate with `npm run pretranslate` (or just `npm run build`); `npm run pretranslate:check` dry-runs and reports how many strings are missing. It is incremental — only new strings cost anything.
  - Dictionary coverage is ~100% of static text. What legitimately falls through: live weather, relative timestamps, the footer running-time counter.
  - **Strings that JS builds at runtime never reach the dictionary**, because `pretranslate.mjs` only scans built HTML. A fixed label created like `label.textContent = '此页内容'` is invisible to the scan, so it falls to the 800ms-debounced API path (measured 2.2s to turn English; permanently Chinese with no API key). Register such labels in `scripts/lib/runtime-strings.mjs` and they get translated into the dictionary like anything else. Only for *fixed* text — anything that changes every tick can never hit the dictionary and must carry its own zh/en pair keyed off `pageLang` (as `SiteFooter` and `VisitedChinaFootprints` do).
  - **Internal links must be `RouterLink`, never a raw `<a href>`.** A plain anchor does a full document load, which throws away the whole pre-paint machinery below and reloads the app. `ArticleIndexList.vue:240` has the idiom (`<component :is>` switching on an `external` flag); `AboutArticleRecommend`, `AboutTimeline`, and `ProjectPortfolio` follow it. Measured on a homepage recommendation card: raw anchor destroyed the JS context and showed ~210ms of Chinese; RouterLink keeps the context and shows none.

### First-paint translation (full page loads)

Every visitor gets English unless they explicitly picked 中文 (`translatePref.js` defaults the *mode* to `en`, not `auto`), so **the build ships English HTML**: after `vuepress build`, `pretranslate.mjs` calls `localizeHtml()` from `scripts/lib/html-text-nodes.mjs` and rewrites each page's Chinese text nodes in place (measured: 50 pages, 2708 swaps). The browser's first frame is English and the client does no translation work at all on a full load.

**Do not go back to "send Chinese, swap it before paint".** That was the previous design — an inline script before `</body>` — and it rested on "body parsed = not yet painted", which only holds on a fast desktop. Measured on production, fresh profile: the HTML itself finished downloading at 172ms, but the parser reached that script at 243ms desktop (FCP 500ms, no flash), **1103ms at 4G+2×CPU (FCP 476ms)** and **3329ms at slow 3G+4×CPU (FCP 1668ms)** — i.e. 0.6–1.7s of Chinese on anything slower than a laptop. Cloudflare's Email Obfuscation also injects a parser-blocking `/cdn-cgi/…/email-decode.min.js` directly *before* that script, costing another round trip exactly where it hurts.

What the rewrite depends on:

1. **Hydration undoes part of it, and the boot script puts it back.** Static vnodes compiled from markdown are adopted without comparing text, but anything rendered by a *component* — navbar, site name, skip link, the home page's recommendation cards — gets patched back to the Chinese in the client bundle. Measured on production, 4×CPU + 4G, cold cache: first paint 0 Chinese, hydration at 6670ms puts **26 nodes** back to Chinese, and they stay Chinese until `/i18n/en.json` (46KB, 4.4s on that link) lands at 9707ms — **3 seconds of Chinese**, ~950ms with the dictionary cached. The runtime path loses this race by construction: it waits on a network request, hydration does not. So `renderBootScript()` inverts the inlined `rev` map (`{english: chinese}` → `{chinese: english}`) and keeps its `MutationObserver` running for English visitors too, swapping each patched node back in the frame it changed — inlined data, zero requests. `pageTranslate.js` adopts the same inverted map as `bootForward`, the first of its three lookup tiers, so its own synchronous pass at mount works before the dictionary arrives. The observer hands over via `window.__LK_I18N_BOOT__.stop()` when the visitor switches to 中文, or the two fight over every node.
2. **Switching to 中文 needs a reverse map.** Nothing was translated at runtime, so `originals` is empty. `renderBootScript()` inlines that page's `{english: chinese}` into `window.__LK_I18N_BOOT__.rev`; `adoptBootReverse()` folds it into `bootReverse`, and the walk at the end of `restoreAll()` converts the whole document back. That walk already existed for TOC nodes copied from already-English headings — English HTML is just the general case of it.
3. **Visitors who chose 中文 get English HTML too**, so the same script restores Chinese — from `<head>` (after `<meta charset>`, before any stylesheet, since an inline script waits on pending CSS), via a `MutationObserver` that swaps each node in the parse chunk that produced it. End-of-body is not an option here for the reason above.

**`<title>` is outside `<body>`, so both walks miss it** — and it is the one string always visible in the browser tab. `localizeHtml()` rewrites it separately (whole-string dictionary hit, else split on `' | '` and translate `页面标题` / `站点名` individually, which are already in the dictionary from the body), and records the whole title in `rev`. At runtime `pageTranslate.js` re-applies it through a `MutationObserver` on `<head>`, because VuePress rewrites `document.title` on every route change. Two traps: the home page must **not** declare a frontmatter `title` (it equals the site title, so VuePress joins them into `Luke 的空间 | Luke 的空间`); and VuePress's `takeOverHeadElements()` adopts SSR head tags by `isEqualNode`, which an English `<title>` never matches, so on navigation it *appends a second* `<title>` while `document.title` keeps reading the first — `dedupeTitleElements()` keeps only the last. `tests/i18n-first-paint.test.mjs` guards all of this.

`localizeHtml()` re-encodes `&<>` when writing text back (a translation like `Read more >` is real) and preserves the node's surrounding whitespace, matching the runtime's `applyToNode`. Both it and `extractTranslatableStrings()` share one cursor (`extractTextRanges`) — changing the splitting on one side alone silently misaligns the other. The boot script's language logic is a hand-inlined copy of `translatePref.js`'s `readLangMode`/`resolveLang`, and its skip list a copy of `SKIP_SELECTOR`; both must change in lockstep. Rewriting is idempotent through `<html data-lk-i18n="en">` — pages carrying it are skipped both by the rewrite *and* by the string scan, or a second `npm run pretranslate` without a rebuild would feed the model's own output back into the dictionary. `--dry-run` skips the whole step.
  - **Timing is load-bearing.** Because the dictionary is in memory, a lookup pass is fully synchronous, so it must run in the frame where the DOM is updated but not yet painted — otherwise the new page paints Chinese first. Three places depend on this: `onRouteChanged()` applies the dictionary synchronously (it used to only queue the 800ms `scheduleIncremental` debounce, which route-render mutations kept pushing back — measured 1358ms of visible Chinese); the `MutationObserver` callback applies it synchronously too (a `requestAnimationFrame` there is one frame too late); and `ParticlesNavbarToggle.vue`'s route watcher calls it *before* its `await nextTick()`. The 800ms debounce now only guards the API fallback. Keep the localStorage cache memoized (`cacheSnapshots`) — the sync path reads it every pass and a `JSON.parse` per frame is not free.
  - `<svg>` is in `SKIP_SELECTOR` (translating SVG text breaks layout), so anything that must switch language inside an SVG carries its own bilingual data instead. Same for text a component rewrites every tick — the incremental scan only sees `childList`, never `characterData`, and a per-second string could never hit the cache anyway. Components doing this: `VisitedChinaFootprints` (`nameEn`/`shortEn` on cities, `nameEn` on countries, zh/en weather lines) and `SiteFooter` (uptime counter). All key off the `pageLang` ref exported from `utils/pageTranslate.js`.

### Navbar overflow

`.vp-navbar-center` is a normal flex child (`flex: 1 1 auto; min-width: 0; overflow: hidden`) — **not** absolutely centered. It used to be `position: absolute; left: 50%` with `max-width: calc(100vw - 9.75rem)`, where `9.75rem` was a guessed reservation for the two side groups; at 360px they actually need ~199px, so the nav slid under the gear/globe and got clipped mid-word.

`fitNavbarItems()` in `client.js` hides whole nav items right-to-left until the rest fit, and sets `data-lk-nav-overflow` on the navbar, which reveals the theme's hamburger so hidden pages stay reachable. Two things it must keep doing:

1. **Measure with the hamburger already shown.** Revealing it costs ~33px, which invalidates the measurement that decided to reveal it — that feedback loop is exactly what left a half-cut "Articles" on screen. So: measure once with everything visible; if it fits, return; otherwise set the attribute *first*, then run the hide loop.
2. **Measure every shown child, not just the hideable ones.** On desktop the settings gear is the last item in the nav list and never hides, but it clips like anything else.

Refits are driven by `scheduleNavFit()` (rAF-coalesced) from: the phone-inline-nav sync, window resize, `TRANSLATE_LANG_EVENT` (label widths change with language), `document.fonts.ready`, a `MutationObserver` on the navbar (`childList` + `characterData` — translation rewrites text in place), and a `ResizeObserver` on `.vp-navbar-start` / `.vp-navbar-end`.
  - Local dev serves `docs/.vuepress/public/` directly, so `/i18n/en.json` works under `npm run dev` too. To point the *fallback* endpoint elsewhere: `localStorage.setItem('lk-translate-api', 'https://<host>/api/translate')`.
