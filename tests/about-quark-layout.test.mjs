import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pageRoot = path.resolve(__dirname, '..')
const configPath = path.join(pageRoot, 'docs', '.vuepress', 'config.js')
const clientPath = path.join(pageRoot, 'docs', '.vuepress', 'client.js')
const componentPath = path.join(
  pageRoot,
  'docs',
  '.vuepress',
  'components',
  'AboutPageLayoutV2.vue',
)
const stylesPath = path.join(pageRoot, 'docs', '.vuepress', 'styles', 'index.scss')
const techStylesPath = path.join(pageRoot, 'docs', '.vuepress', 'styles', 'tech-detail-layout.scss')
const profileCardPath = path.join(pageRoot, 'docs', '.vuepress', 'components', 'ProfileCard.vue')
const routeCurtainPath = path.join(pageRoot, 'docs', '.vuepress', 'components', 'RoutePageCurtain.vue')
// 头像等站点身份自 site.config.js 抽取后搬到了那里；config.js 只剩 siteConfig.avatar 的引用
const siteConfigPath = path.join(pageRoot, 'docs', '.vuepress', 'site.config.js')

function main() {
  const config = fs.readFileSync(configPath, 'utf8')
  const client = fs.readFileSync(clientPath, 'utf8')
  const component = fs.readFileSync(componentPath, 'utf8')
  const styles = fs.readFileSync(stylesPath, 'utf8')
  const techStyles = fs.readFileSync(techStylesPath, 'utf8')
  const profileCard = fs.readFileSync(profileCardPath, 'utf8')
  const routeCurtain = fs.readFileSync(routeCurtainPath, 'utf8')
  const siteConfigSrc = fs.readFileSync(siteConfigPath, 'utf8')

  assert.match(
    config,
    /logo:\s*siteConfig\.avatar/,
    'site config should use the capybara avatar as the default navbar logo',
  )

  assert.match(
    siteConfigSrc,
    /avatar:\s*'\/gallery\/avatar-luke-capybara\.png'/,
    'site.config.js should declare the capybara avatar as the site avatar',
  )

  assert.match(
    config,
    /rel:\s*'icon'[\s\S]*?siteConfig\.avatar/,
    'site config should use the capybara avatar as the default favicon',
  )

  assert.match(
    client,
    /function isQuarkBrowser\(\)/,
    'client shell should detect Quark from user agent',
  )

  assert.match(
    client,
    /syncQuarkNavbarAvatar/,
    'client shell should sync navbar avatars early on Quark',
  )

  assert.match(
    client,
    /readAvatar/,
    'client shell should read the shared avatar preference for Quark navbar sync',
  )

  assert.match(
    client,
    /lk-quark-browser/,
    'client shell should expose a Quark-only root class',
  )

  assert.match(
    client,
    /syncQuarkBrowserClass/,
    'client shell should sync the Quark root class on viewport changes',
  )

  assert.match(
    client,
    /\\bQuark/i,
    'Quark detection should match the Quark token only, not generic UCBrowser',
  )

  assert.match(
    client,
    /isQuarkDevOverrideEnabled|lk-force-quark|lk-quark/,
    'client shell should allow localhost-only Quark simulation for local debugging',
  )

  assert.doesNotMatch(
    client,
    /UCBrowser/i,
    'Quark detection should avoid broad UC browser matching',
  )

  assert.match(
    component,
    /classList\.contains\('lk-quark-browser'\)/,
    'about mobile hero logic should treat Quark as a mobile-fit viewport',
  )

  assert.match(
    styles,
    /@mixin lk-about-mobile-layout/,
    'about styles should define a shared mobile about layout mixin',
  )

  assert.match(
    styles,
    /@mixin lk-quark-footer-layout/,
    'Quark styles should define a dedicated footer layout mixin',
  )

  assert.match(
    styles,
    /@mixin lk-quark-navbar-end/,
    'Quark styles should define navbar-end compaction for settings visibility',
  )

  assert.match(
    styles,
    /@mixin lk-quark-proj-hub-layout/,
    'Quark styles should define a dedicated projects hub layout mixin',
  )

  assert.match(
    styles,
    /@mixin lk-quark-article-layout/,
    'Quark styles should define a dedicated article layout mixin',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-about-mobile-layout/,
    'Quark styles should reuse the shared mobile about layout mixin',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-quark-footer-layout/,
    'Quark styles should apply the footer layout mixin',
  )

  assert.match(
    styles,
    /@mixin lk-quark-navbar-end[\s\S]*\.lk-settings-btn[\s\S]*display:\s*inline-flex\s*!important;/,
    'Quark navbar mixin should keep the settings gear visible',
  )

  assert.match(
    styles,
    /@mixin lk-quark-navbar-end[\s\S]*\.vp-navbar-end[\s\S]*flex:\s*0\s*0\s*auto\s*!important/,
    'Quark navbar end should shrink-wrap controls instead of stretching across the header',
  )

  assert.doesNotMatch(
    styles,
    /@mixin lk-quark-navbar-end[\s\S]*\.lk-settings-btn[\s\S]*order:\s*-10/,
    'Quark settings gear should not use negative flex order that overlaps center nav',
  )

  assert.match(
    styles,
    /@mixin lk-chromium-inline-navbar-guard[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/,
    'Chromium inline navbar guard should use a three-column grid between logo and end controls',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-chromium-inline-navbar-guard/,
    'Quark browser should apply the chromium inline navbar overlap guard',
  )

  assert.match(
    styles,
    /html\.lk-huawei-browser[\s\S]*@include lk-chromium-inline-navbar-guard/,
    'Huawei browser should apply the chromium inline navbar overlap guard',
  )

  assert.match(
    client,
    /function isHuaweiBrowser\(\)/,
    'client should detect Huawei browser from user agent',
  )

  assert.match(
    client,
    /syncHuaweiBrowserClass[\s\S]*HUAWEI_BROWSER_CLASS/,
    'client should toggle lk-huawei-browser on the root element',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-quark-proj-hub-layout/,
    'Quark styles should apply the projects hub layout mixin',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-quark-article-layout/,
    'Quark styles should apply the article layout mixin',
  )

  assert.match(
    styles,
    /@mixin lk-quark-proj-hub-layout[\s\S]*\.lk-proj-hub-layout[\s\S]*grid-template-columns:\s*1fr\s*!important;/,
    'Quark projects mixin should force the projects hub into a single column',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*@include lk-compact-mobile-navbar/,
    'Quark styles should compact the navbar like phone mode',
  )

  assert.match(
    styles,
    /@mixin lk-compact-mobile-navbar[\s\S]*@include lk-phone-inline-navbar/,
    'compact mobile navbar should expose inline site navigation links',
  )

  // 以前这里守的是 position: absolute + left: 50% 的居中写法。那套靠一个拍脑袋的
  // calc(100vw - 9.75rem) 给两侧留位置，360px 下 start+end 实际要 199px，导航就被压到
  // 齿轮/地球底下、还被 overflow 裁掉半个字。改成普通 flex 子项后，导航拿到的是减掉两侧
  // 之后真正剩下的宽度——现在要守的是「结构上不可能再重叠」这个前提，不是那串坐标。
  assert.match(
    styles,
    /@mixin lk-phone-inline-navbar[\s\S]*\.vp-navbar-center[\s\S]*position:\s*static[\s\S]*flex:\s*1 1 auto\s*!important[\s\S]*justify-content:\s*center[\s\S]*min-width:\s*0[\s\S]*overflow:\s*hidden/,
    'phone inline navbar should lay the nav links out as a normal flex child (not absolute centering) so they can never overlap the side groups',
  )

  assert.match(
    styles,
    /@mixin lk-phone-inline-navbar[\s\S]*\.vp-navbar-center[\s\S]*font-size:\s*0\.92rem\s*!important/,
    'phone inline navbar should use a slightly larger font for nav links',
  )

  assert.match(
    styles,
    /@mixin lk-phone-inline-navbar[\s\S]*html\[data-theme='dark'\] \.vp-navbar \.lk-settings-btn[\s\S]*#5eead4/,
    'phone inline navbar should use high-contrast gear colors in dark mode',
  )

  assert.match(
    styles,
    /html\[data-theme='dark'\]\[data-lk-route\^='\/article\/'\][\s\S]*\[vp-content\]:not\(\.custom\)[\s\S]*background:[\s\S]*!important[\s\S]*color:\s*#f5f5f4\s*!important/,
    'article detail dark mode should invert vp-content card colors with html data-lk-route',
  )

  assert.match(
    styles,
    /@function lk-dark-surface-root[\s\S]*data-theme[\s\S]*dark[\s\S]*data-lk-route\^="\/article\/"/,
    'route fallback dark surface should merge data-theme onto html',
  )

  assert.match(
    styles,
    /#{lk-dark-surface-root\(\$lk-article-detail-route-a\)} \.vp-toc-placeholder[\s\S]*#0f172a/,
    'mobile vp-toc-placeholder dark should use lk-dark-surface-root for route fallback',
  )

  assert.match(
    styles,
    /html\[data-theme='dark'\]\[data-lk-route\^='\/article\/'\][\s\S]*\.lk-article-toc-dock[\s\S]*#0f172a[\s\S]*!important/,
    'article detail dark mode should invert desktop TOC dock card colors',
  )

  assert.match(
    styles,
    /html\[data-theme='dark'\]\[data-lk-route\^='\/article\/'\][\s\S]*nav\.vp-page-nav a\.route-link\.auto-link[\s\S]*#0f172a[\s\S]*!important/,
    'article detail dark mode should invert bottom prev/next nav cards',
  )

  assert.match(
    styles,
    /@mixin lk-phone-inline-navbar[\s\S]*\.vp-toggle-navbar-button[\s\S]*display:\s*none\s*!important/,
    'phone inline navbar should hide the hamburger menu button',
  )

  assert.match(
    styles,
    /@mixin lk-quark-article-layout[\s\S]*\.lk-article-three__content[\s\S]*grid-template-columns:\s*1fr\s*!important;/,
    'Quark article mixin should force the article index into a single column',
  )

  assert.match(
    styles,
    /@mixin lk-quark-article-layout[\s\S]*\.lk-article-three__card[\s\S]*grid-template-rows:\s*auto auto\s*!important;/,
    'Quark article mixin should stack article cards vertically',
  )

  assert.match(
    styles,
    /@mixin lk-quark-footer-layout[\s\S]*\.lk-footer__row[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/,
    'Quark footer mixin should stack footer sections in one column',
  )

  assert.match(
    styles,
    /@mixin lk-quark-article-layout[\s\S]*@media \(max-width: 959px\)[\s\S]*@include lk-article-mobile-sidebar-drawer/,
    'Quark article post drawer rules should stay narrow-screen only',
  )

  assert.match(
    styles,
    /@mixin lk-article-desktop-cluster-layout[\s\S]*--lk-article-cluster-w[\s\S]*margin-inline-start/,
    'desktop article cluster mixin should offset title and content by cluster width',
  )

  assert.match(
    styles,
    /@media \(min-width: 960px\)[\s\S]*@include lk-article-desktop-cluster-layout[\s\S]*data-lk-route/,
    'desktop cluster layout should apply via data-lk-route when page-article-post is missing',
  )

  assert.match(
    client,
    /function isDesktopArticleClusterPath[\s\S]*ARTICLE_LEFT_TOC_MEDIA_QUERY/,
    'client should distinguish desktop article cluster paths from narrow layouts',
  )

  assert.match(
    client,
    /function syncArticleTocDock[\s\S]*isDesktopArticleClusterPath[\s\S]*sidebar-collapsed/,
    'desktop TOC dock sync should restore the left sidebar before docking',
  )

  assert.match(
    styles,
    /@mixin lk-article-mobile-sidebar-drawer[\s\S]*\.vp-sidebar[\s\S]*top:\s*0\s*!important[\s\S]*padding:\s*0\s*!important/,
    'mobile article sidebar drawer should flush to the viewport top without a blank strip',
  )

  assert.match(
    styles,
    /@mixin lk-article-mobile-sidebar-drawer[\s\S]*#{lk-dark-surface-root\(\$root\)} \.vp-sidebar[\s\S]*rgba\(11, 15, 25/,
    'mobile article sidebar drawer should use lk-dark-surface-root for dark background',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*\.vp-toc-placeholder[\s\S]*\.vp-page-title[\s\S]*var\(--lk-article-shell-w\)/,
    'article post surfaces should share the same shell width for TOC and content',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*#\{\$root\} \[vp-content\]:not\(\.custom\)/,
    'article and project detail pages should align content shell without requiring sidebar :has()',
  )

  assert.match(
    styles,
    /#\{\$root\} \[vp-content\]:not\(\.custom\)[\s\S]*var\(--lk-article-post-pad-x\)/,
    'article/project content card should share horizontal padding with the TOC bar',
  )

  assert.match(
    styles,
    /--lk-article-post-pad-x[\s\S]*--lk-article-toc-inner-x:\s*var\(--lk-article-post-pad-x\)/,
    'article post TOC should reuse the same horizontal padding token as the content card',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*\.vp-toc-placeholder[\s\S]*position:\s*sticky/,
    'article post TOC placeholder should stay sticky with the aligned shell width',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*\.vp-toc-placeholder[\s\S]*border:\s*1px solid[\s\S]*\.vp-toc-placeholder \[vp-toc\][\s\S]*border:\s*none/,
    'sticky TOC card chrome should live on the placeholder so the border survives page scroll',
  )

  assert.match(
    styles,
    /#\{\$root\} \.vp-toc-placeholder \[vp-toc\][\s\S]*border:\s*none/,
    'inline TOC inner shell should not paint a second border over the sticky placeholder card',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*#\{\$root\} \.vp-toc-placeholder[\s\S]*background:\s*#f4fdfb/,
    'TOC sticky shell should use an opaque background so fast scroll does not wash out the frame',
  )

  assert.match(
    styles,
    /@mixin lk-article-post-surface-align[\s\S]*#\{\$root\} \.vp-toc-placeholder::after[\s\S]*inset 0 0 0 1px/,
    'TOC sticky shell should keep a dedicated inset ring layer during compositor repaints',
  )

  assert.match(
    styles,
    /#\{\$root\} \.vp-navbar \.vp-toggle-sidebar-button[\s\S]*#\{\$root\} \.vp-navbar \.lk-settings-btn/,
    'article detail navbar should visually separate sidebar toggle from settings button',
  )

  assert.match(
    styles,
    /@mixin lk-quark-article-layout[\s\S]*@include lk-article-post-surface-align/,
    'Quark article layout should align TOC width with article content width',
  )

  assert.match(
    styles,
    /@mixin lk-about-mobile-layout[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/,
    'mobile about mixin should force a single-column grid for Quark',
  )

  assert.match(
    styles,
    /html\.lk-quark-browser[\s\S]*\.lk-about-timeline/,
    'Quark styles should include timeline containment overrides',
  )

  assert.match(
    styles,
    /@media \(max-width: 719px\)[\s\S]*@include lk-about-mobile-layout/,
    'narrow viewport media query should reuse the same mobile about mixin',
  )

  assert.match(
    client,
    /function syncPortfolioSidebarActiveState[\s\S]*seenActiveTargets/,
    'portfolio sidebar should only keep the first link active when multiple entries share one detail URL',
  )

  assert.match(
    client,
    /scheduleArticleChrome\(path\)[\s\S]*syncPortfolioSidebarActiveState\(path\)/,
    'article chrome scheduling should reconcile duplicate sidebar active states',
  )

  assert.match(
    client,
    /function resetArticlePostLayoutForRoute[\s\S]*lk-article-toc-left[\s\S]*\.lk-article-toc-dock/,
    'route changes should reset docked TOC state before syncing the next article/project page',
  )

  assert.match(
    client,
    /function isArticleTocSidebarDockable[\s\S]*QUARK_BROWSER_CLASS[\s\S]*getComputedStyle\(sidebar\)/,
    'TOC should not dock into a CSS-hidden sidebar (e.g. Quark article layout)',
  )

  assert.match(
    client,
    /function syncArticleTocDock[\s\S]*isArticleTocSidebarDockable\(sidebar\)/,
    'syncArticleTocDock should use sidebar dockability instead of viewport width alone',
  )

  assert.match(
    client,
    /function syncQuarkBrowserClass[\s\S]*wasQuark !== isQuark[\s\S]*requestArticlePostLayoutResync/,
    'Quark class toggles should re-sync article TOC placement only when the class changes',
  )

  assert.match(
    client,
    /function syncPhoneViewportClass[\s\S]*wasPhone !== isPhoneViewport[\s\S]*requestArticlePostLayoutResync/,
    'phone viewport class should not reset article layout on every scroll tick',
  )

  assert.match(
    client,
    /function undockArticleTocToInline[\s\S]*restoreArticleTocToMarker[\s\S]*\.lk-article-toc-dock/,
    'undocking TOC must restore placeholder before removing the dock host',
  )

  assert.match(
    client,
    /isQuarkBrowser\(\)/,
    'TOC dockability should consult Quark UA directly, not only the root class',
  )

  assert.match(
    client,
    /function requestArticlePostLayoutResync[\s\S]*resetArticlePostLayoutForRoute[\s\S]*requestAnimationFrame/,
    'viewport resync should reset dock state then sync after CSS settles',
  )

  assert.match(
    client,
    /getArticleLeftTocMediaQueryList[\s\S]*addEventListener\('change'/,
    'article layout should listen to the 960px media query change event',
  )

  assert.match(
    client,
    /function scheduleArticleRouteClasses[\s\S]*portfolioRouteClassesApplied[\s\S]*page-article-post/,
    'article route classes should retry until page-article-post sticks after Hope navigation',
  )

  assert.match(
    client,
    /function scheduleArticleChrome[\s\S]*syncArticleRouteClasses/,
    'article chrome scheduling should re-apply page-article-post before TOC dock sync',
  )

  assert.match(
    client,
    /attachPortfolioRouteClassObserver[\s\S]*MutationObserver[\s\S]*page-article-post/,
    'portfolio route class observer should re-apply page-article-post when Hope strips it',
  )

  assert.match(
    styles,
    /html\[data-lk-route\^='\/article\/'\][\s\S]*@include lk-article-post-surface-align/,
    'article detail surfaces should fall back to data-lk-route when page-article-post is missing',
  )

  assert.match(
    techStyles,
    /html\.lk-tech-detail-post \.theme-container\.page-article-post \[vp-content\]:not\(\.custom\)/,
    'tech detail pages should keep the content shell without requiring sidebar :has() during route transitions',
  )

  assert.match(
    styles,
    /html\.lk-about-profile-center[\s\S]*@include lk-about-profile-center-layout/,
    'browser zoom should center about profile via html.lk-about-profile-center',
  )

  assert.match(
    styles,
    /@mixin lk-about-profile-center-layout[\s\S]*\.lk-about-v2-main__grid--triple[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/,
    'about profile zoom center mode should stack timeline below the main column',
  )

  assert.match(
    styles,
    /@mixin lk-about-profile-center-layout[\s\S]*align-self:\s*center\s*!important/,
    'about profile center mixin should reset mini card align-self start',
  )

  assert.match(
    client,
    /getAboutProfileBrowserZoomRatio[\s\S]*ABOUT_PROFILE_ZOOM_WIDTH_RATIO/,
    'client should detect browser zoom via layout width vs screen width ratio only',
  )

  assert.match(
    client,
    /shouldCenterAboutProfile[\s\S]*getAboutProfileBrowserZoomRatio/,
    'client should center about profile only from browser zoom ratio',
  )

  assert.doesNotMatch(
    client,
    /layoutWidth\s*<=\s*ABOUT_PROFILE_CENTER_MAX_LAYOUT_WIDTH/,
    'client should not center about profile from layout width alone at 100% zoom',
  )

  assert.match(
    styles,
    /data-lk-profile-pair-sync[\s\S]*--lk-about-profile-pair-height/,
    'about v2 intro card should match mini card height via profile pair sync variable',
  )

  assert.match(
    component,
    /syncProfilePairHeight[\s\S]*getBoundingClientRect\(\)\.height/,
    'about layout should measure mini card height as the profile pair baseline',
  )

  assert.match(
    component,
    /shouldSyncProfilePairHeight[\s\S]*lk-about-profile-center/,
    'about layout should disable profile pair sync in zoom center mode',
  )

  assert.match(
    styles,
    /\.lk-about-v2 \.about-profile\.about-profile--vstack[\s\S]*align-items:\s*start/,
    'about v2 profile grid should top-align paired cards before height sync',
  )

  assert.match(
    styles,
    /\.lk-about-v2 \.about-profile\.about-profile--vstack[\s\S]*margin-inline:\s*0/,
    'about v2 profile row should left-align with projects section below',
  )

  assert.match(
    styles,
    /\.lk-about-v2 \.about-profile\.about-profile--vstack[\s\S]*grid-template-columns:\s*220px minmax\(0,\s*1fr\)/,
    'about v2 profile grid should use a narrow mini column so intro can expand',
  )

  assert.match(
    styles,
    /data-lk-profile-pair-sync[\s\S]*overflow-y:\s*hidden/,
    'about v2 intro card should hide overflow when pair sync locks height',
  )

  assert.match(
    styles,
    /html:not\(\.lk-about-profile-center\)[\s\S]*\.lk-about-v2 \.about-card--intro[\s\S]*height:\s*auto\s*!important/,
    'about v2 intro card should use content height when pair sync is inactive',
  )

  assert.match(
    profileCard,
    /\.lk-card:not\(\.lk-card--embedded\):not\(\.lk-card--mini\)/,
    'profile mini card should not inherit the full-size lk-card min-height shell',
  )

  assert.match(
    profileCard,
    /\.lk-card--mini[\s\S]*min-height:\s*0/,
    'profile mini card should shrink-wrap its avatar and social dock',
  )

  assert.match(
    client,
    /syncAboutProfileCenterClass[\s\S]*ABOUT_PROFILE_CENTER_CLASS/,
    'client should toggle lk-about-profile-center on the root element',
  )

  assert.match(
    routeCurtain,
    /resolvePhoneInlineNavCurtainNavigation[\s\S]*lk-phone-inline-nav\[data-lk-phone-inline-nav="1"\]/,
    'route curtain should intercept mobile inline navbar links for transition animation',
  )

  assert.match(
    routeCurtain,
    /resolvePhoneInlineNavCurtainNavigation\(event\)[\s\S]*resolveArticleCurtainNavigation\(event\)/,
    'route curtain click handler should prioritize mobile inline navbar navigation',
  )
}

main()
