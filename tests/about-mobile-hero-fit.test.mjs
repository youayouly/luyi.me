import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pageRoot = path.resolve(__dirname, '..')
const componentPath = path.join(
  pageRoot,
  'docs',
  '.vuepress',
  'components',
  'AboutPageLayoutV2.vue',
)
const clientPath = path.join(pageRoot, 'docs', '.vuepress', 'client.js')
const stylesPath = path.join(pageRoot, 'docs', '.vuepress', 'styles', 'index.scss')

function main() {
  const component = fs.readFileSync(componentPath, 'utf8')
  const client = fs.readFileSync(clientPath, 'utf8')
  const styles = fs.readFileSync(stylesPath, 'utf8')

  assert.match(
    component,
    /visualViewport\?\.(height|width)|window\.innerHeight/,
    'about mobile hero logic should measure the visible viewport height',
  )

  assert.match(
    component,
    /--lk-about-mobile-hero-height/,
    'about mobile hero logic should expose a CSS variable for dynamic hero height',
  )

  assert.match(
    component,
    /--lk-about-mobile-hero-stack-offset/,
    'about mobile hero logic should expose a CSS variable for decoupled hero stack positioning',
  )

  assert.match(
    component,
    /MOBILE_CARD_HIDE_BUFFER\s*=\s*(6[4-9]|[7-9]\d|\d{3,})/,
    'about mobile hero logic should keep a generous hide buffer so intro cards stay off the first screen',
  )

  assert.match(
    component,
    /getMobileCardHideBuffer/,
    'about mobile hero logic should use a larger hide buffer on Quark',
  )

  assert.match(
    component,
    /desiredCardTop\s*=\s*viewportHeight\s*\+\s*getMobileCardHideBuffer\(\)/,
    'about mobile hero logic should push the intro card below the visible viewport',
  )

  assert.match(
    component,
    /MOBILE_QUARK_CENTER_DROP_PX/,
    'about mobile hero logic should nudge the Quark hero stack slightly downward',
  )

  assert.match(
    component,
    /getMobileHeroStackCenterY/,
    'about mobile hero logic should adjust the hero stack center on Quark',
  )

  assert.match(
    component,
    /getVisibleViewportCenterY/,
    'about mobile hero logic should center against the visible viewport instead of screen.height guesses',
  )

  assert.match(
    component,
    /offsetTop\s*\+\s*height\s*\/\s*2/,
    'about mobile hero logic should map the visual viewport center into client coordinates',
  )

  assert.match(
    component,
    /getMobileHeroStackCenterY/,
    'about mobile hero logic should derive stack center from the visible viewport with optional Quark lift',
  )

  assert.doesNotMatch(
    component,
    /MOBILE_SCREEN_CENTER_EXTRA_RATIO|rawScreenHeight\s*\/\s*2/,
    'about mobile hero logic should not rely on screen.height fractional lifts that drift across mobile browsers',
  )

  assert.match(
    component,
    /mobileHeroStackOffset/,
    'about mobile hero logic should store stack offset separately from hero height',
  )

  assert.doesNotMatch(
    component,
    /Math\.max\(\s*centeredHeroHeight\s*,\s*cardDrivenHeroHeight\s*\)/,
    'about mobile hero logic should not couple centered hero height with card-driven hero height',
  )

  assert.match(
    component,
    /cardDrivenHeroHeight/,
    'about mobile hero logic should still derive hero height from the intro card position',
  )

  assert.match(
    component,
    /getStackNaturalCenterY/,
    'about mobile hero logic should measure stack position without transform feedback loops',
  )

  assert.match(
    component,
    /document\.documentElement\.classList\.contains\('lk-phone-viewport'\)/,
    'about mobile hero logic should reuse the shared phone viewport signal so Quark-like browsers still get the mobile fit behavior',
  )

  assert.doesNotMatch(
    component,
    /window\.addEventListener\('scroll',\s*onViewportChange/,
    'about mobile hero logic should avoid window scroll listeners that cause first-screen layout jitter',
  )

  assert.match(
    component,
    /MOBILE_HERO_STABILIZE_DEBOUNCE_MS/,
    'about mobile hero logic should debounce late mobile browser toolbar stabilization',
  )

  assert.match(
    component,
    /visualViewport\?\.addEventListener\('scrollend',\s*onViewportChange\)/,
    'about mobile hero logic should still react to visual viewport scrollend without continuous scroll jitter',
  )

  assert.match(
    client,
    /lk-phone-viewport/,
    'client shell should mark likely phone viewports on the root element for shared layout fixes',
  )

  assert.match(
    client,
    /screenShortSide|PHONE_VIEWPORT_MAX_SHORT_SIDE/,
    'client shell should detect real phones from handset-sized screen metrics instead of only CSS layout width',
  )

  assert.match(
    client,
    /PHONE_LAYOUT_WIDTH_MISMATCH_RATIO/,
    'client shell should treat wide layout viewports on handsets as phone mode for Quark-like browsers',
  )

  assert.match(
    styles,
    /var\(--lk-about-mobile-hero-height,\s*clamp\(320px,\s*50vh,\s*420px\)\)/,
    'mobile about hero styles should consume the dynamic hero height variable',
  )

  assert.match(
    styles,
    /translateY\(var\(--lk-about-mobile-hero-stack-offset/,
    'mobile about hero styles should apply the decoupled stack offset variable',
  )

  assert.match(
    styles,
    /\.lk-about-v2-hero__overlay\s*\{[\s\S]*?justify-content:\s*flex-start\s*!important;/,
    'mobile about hero styles should anchor hero content from the top instead of flex-centering inside a tall hero',
  )

  assert.match(
    styles,
    /html\.lk-phone-viewport[\s\S]*?@include lk-phone-inline-navbar/,
    'phone-mode navbar should use inline primary navigation links',
  )

  assert.match(
    styles,
    /@mixin lk-phone-inline-navbar[\s\S]*?\.vp-toggle-navbar-button[\s\S]*?display:\s*none\s*!important;/,
    'phone inline navbar should hide the hamburger menu button',
  )
}

main()
