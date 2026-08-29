<template>
  <div
    v-if="active && !reducedMotion"
    class="lk-network-particles"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="lk-network-particles__canvas" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { normPath } from '../utils/authGate.js'
import {
  PARTICLES_PREF_EVENT,
  PARTICLES_PREF_KEY,
  readParticlesPref,
} from '../utils/particlesPref.js'

const route = useRoute()
const canvasRef = ref(null)
const reducedMotion = ref(false)
const userParticlesEnabled = ref(true)

/** About / Projects(/tech) / Article：由导航栏开关 + localStorage 控制是否显示 */
const active = computed(() => {
  if (!userParticlesEnabled.value) return false
  const p = normPath(route.path)
  return (
    p === '/about' ||
    p.startsWith('/about/') ||
    p === '/tech' ||
    p.startsWith('/tech/') ||
    p === '/article' ||
    p.startsWith('/article/')
  )
})

let raf = 0
let particles = []
let w = 0
let h = 0
let linkDist = 120
/** 基准粒子数（随窗口在 resize 里更新）；吸引时可在其上加临时粒子 */
let n = 56
/** 吸引态下补粒子用帧计数 */
let mouseSpawnTick = 0

/** 光标：逻辑坐标与上一帧位置（与粒子同一坐标系） */
let mouseX = -1e9
let mouseY = -1e9
let lastTickMouseX = -1e9
let lastTickMouseY = -1e9
let smoothedMouseSpeed = 0
/** 上一帧光标位移（逻辑 px），保留给速度平滑等逻辑 */
let lastMouseDx = 0
let lastMouseDy = 0
let hasMouseSample = false
let mouseListenersAttached = false
/** 吸引强度平滑值 0～1：淡入淡出，避免光标一停就瞬间「爆」一圈 */
let attractBlend = 0
let bonusTrimTick = 0

/** 与光标连线的最大半径（px）；参考图：大量细线从中心辐射到圈内粒子 */
const MOUSE_LINK_RADIUS = 200
/** 光标影响半径（px）；圈外粒子不参与「吸向指针」、也不画到光标的线 */
const MOUSE_ATTRACT_RADIUS = 220
/**
 * 弹簧平衡半径（px）：粒子被吸到「绕指针一圈」的云壳上，像图1蒲公英头，
 * 而不是贴死在指针上或纯涡旋乱转。
 */
const MOUSE_RING_PREF = 74
/** 弹簧刚度（乘 edge² 与 (d - R_pref)）；越大越快聚成一圈 */
const MOUSE_SPRING_K = 0.022
/** 弹簧径向加速度每帧上限，防数值爆 */
const MOUSE_SPRING_ACC_CAP = 0.38
/** 外缘软壳：超过 rAt * 该比例时额外向心加速度，轮廓更接近圆 */
const MOUSE_OUTER_SHELL_START = 0.86
/** 外缘向心强度（与越界深度平方成正比） */
const MOUSE_SHELL_IN_K = 0.24
/** 吸引时最多比 n 多出的粒子数（沿环外「生成」再卷入） */
const MOUSE_BONUS_PARTICLES_MAX = 22
/** 吸引满强度时，每隔多少帧最多补 1 个粒子 */
const MOUSE_SPAWN_FRAMES_MIN = 5
/** blend 低时额外拉长间隔的帧数上限 */
const MOUSE_SPAWN_FRAMES_EXTRA = 14
/** attractBlend 向目标靠近：数值越小淡入/淡出越慢 */
const ATTRACT_BLEND_SPEED_UP = 0.03
const ATTRACT_BLEND_SPEED_DOWN = 0.042
/** 径向线整体再压一档，不那么「糊在光标旁」 */
const MOUSE_RADIAL_ALPHA_MUL = 0.72
/** 切向：略加强，帮助角向摊开，减轻「全挤在一边」 */
const MOUSE_SWIRL_STRENGTH = 0.03
/** 吸引区内按方位分桶数，用于「往空扇区」填隙 */
const MOUSE_ANGLE_GAP_BINS = 16
/** 角向填隙：拥挤扇区沿切向滑向最空扇区的强度 */
const MOUSE_ANGLE_GAP_FILL_STRENGTH = 0.048
/** 仅当该扇区粒子数 > avg * 此值 时才推（略大于 1 更积极填洞） */
const MOUSE_ANGLE_GAP_CROWD_OVER_AVG = 0.88
/** 吸引区内粒子过近时的排斥半径与强度（物理摊开，分布更匀） */
const CLUSTER_REPULSE_RANGE = 48
const CLUSTER_REPULSE_STRENGTH = 0.011
/** 吸引区内速度衰减（略紧，便于壳层成形） */
const PARTICLE_VELOCITY_DAMP = 0.997
/** 背景区：更轻的衰减，避免全屏慢慢冻住 */
const PARTICLE_VELOCITY_DAMP_BG = 0.9994
/** 不在吸引半径内时，每帧随机加速度（持续漂移） */
const AMBIENT_DRIFT_ACCEL = 0.055
/** 吸引区内速度上限 */
const PARTICLE_MAX_SPEED = 1.38
/** 背景粒子速度上限（可略高，飘动更明显） */
const PARTICLE_MAX_SPEED_BG = 1.72
/** 超过该速度（px/帧，约 60fps）则不再画光标连线，形成「甩断」 */
const MOUSE_SPEED_BREAK = 20
/** 低于该速度时连线不透明拉满 */
const MOUSE_SPEED_SOFT = 5
/** 超过该平滑速度后，仅「吸引半径内」的粒子受不规则冲量逃散（与拖拽方向无关） */
const MOUSE_FLEE_SPEED_THRESH = 4.8
/** 圈内随机逃离冲量系数；乘 (speed - thresh)，并封顶 */
const MOUSE_FLEE_CAPTURED_STRENGTH = 0.11
const MOUSE_FLEE_CAPTURED_CAP = 0.52
/** 每只粒子冲量幅度的随机倍率区间 [lo, hi] */
const MOUSE_FLEE_GAIN_JITTER_LO = 0.72
const MOUSE_FLEE_GAIN_JITTER_HI = 1.18
/** 逃散前剥掉「仍指向光标」的径向速度比例，避免随机冲量叠在惯性上仍像跟鼠标跑 */
const MOUSE_FLEE_STRIP_RADIAL_IN = 0.93
/** 剥掉沿鼠标移动正方向的速度分量比例，减轻彗尾 */
const MOUSE_FLEE_STRIP_ALONG_DRAG = 0.8

function readThemeColors() {
  if (typeof document === 'undefined') {
    return { dot: 'rgba(100,120,180,0.35)', line: 'rgba(100,120,180,0.35)' }
  }
  const dark =
    document.documentElement.getAttribute('data-theme') === 'dark'
  if (dark) {
    return {
      dot: 'rgba(200, 215, 255, 0.35)',
      line: 'rgba(200, 215, 255, 0.45)',
    }
  }
  return {
    dot: 'rgba(40, 60, 110, 0.28)',
    line: 'rgba(40, 60, 110, 0.35)',
  }
}

function randomParticle() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
  }
}

function initParticles() {
  particles = []
  for (let i = 0; i < n; i += 1) particles.push(randomParticle())
}

/** 在光标影响区外缘附近补点，进入场后会被卷成圆壳 */
function spawnAroundMouse() {
  const ang = Math.random() * Math.PI * 2
  const rad =
    MOUSE_ATTRACT_RADIUS + 12 + Math.random() * (MOUSE_LINK_RADIUS * 0.35)
  let x = mouseX + Math.cos(ang) * rad
  let y = mouseY + Math.sin(ang) * rad
  x = Math.max(4, Math.min(w - 4, x))
  y = Math.max(4, Math.min(h - 4, y))
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 0.26,
    vy: (Math.random() - 0.5) * 0.26,
  }
}

function resize() {
  const c = canvasRef.value
  if (!c || typeof window === 'undefined') return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = window.innerWidth
  h = window.innerHeight
  linkDist = Math.min(128, Math.max(86, Math.hypot(w, h) / 13))
  /* 数量适中：大屏约百级以内，减轻 O(n^2) 连线与绘制 */
  n = Math.round(Math.min(96, Math.max(36, (w * h) / 17500)))
  c.width = Math.floor(w * dpr)
  c.height = Math.floor(h * dpr)
  c.style.width = `${w}px`
  c.style.height = `${h}px`
  const ctx = c.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  initParticles()
  lastTickMouseX = mouseX
  lastTickMouseY = mouseY
}

function onMouseMove(e) {
  mouseX = e.clientX
  mouseY = e.clientY
  hasMouseSample = true
}

function attachMouseListeners() {
  if (typeof window === 'undefined' || mouseListenersAttached) return
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  mouseListenersAttached = true
}

function detachMouseListeners() {
  if (typeof window === 'undefined' || !mouseListenersAttached) return
  window.removeEventListener('mousemove', onMouseMove)
  mouseListenersAttached = false
  hasMouseSample = false
  smoothedMouseSpeed = 0
  attractBlend = 0
  lastMouseDx = 0
  lastMouseDy = 0
}

let running = true

function tick() {
  if (typeof window === 'undefined') return
  if (!running || !active.value) return
  const c = canvasRef.value
  const ctx = c?.getContext('2d')
  if (!ctx || !w || !h) {
    raf = requestAnimationFrame(tick)
    return
  }

  if (hasMouseSample) {
    const dxm = mouseX - lastTickMouseX
    const dym = mouseY - lastTickMouseY
    const inst =
      lastTickMouseX < -1e8 ? 0 : Math.hypot(dxm, dym)
    smoothedMouseSpeed = smoothedMouseSpeed * 0.78 + inst * 0.22
    if (lastTickMouseX < -1e8) {
      lastMouseDx = 0
      lastMouseDy = 0
    } else {
      lastMouseDx = dxm
      lastMouseDy = dym
    }
    lastTickMouseX = mouseX
    lastTickMouseY = mouseY
  } else {
    lastMouseDx = 0
    lastMouseDy = 0
  }

  const { dot, line } = readThemeColors()
  ctx.clearRect(0, 0, w, h)

  const mouseInView =
    hasMouseSample &&
    mouseX >= 0 &&
    mouseX <= w &&
    mouseY >= 0 &&
    mouseY <= h
  const mouseSlowEnough = smoothedMouseSpeed < MOUSE_SPEED_BREAK
  const attractInstant =
    mouseInView && mouseSlowEnough
      ? Math.min(
          1,
          Math.max(
            0,
            1 -
              (smoothedMouseSpeed - MOUSE_SPEED_SOFT) /
                (MOUSE_SPEED_BREAK - MOUSE_SPEED_SOFT),
          ),
        )
      : 0

  {
    const tgt = attractInstant
    const k =
      tgt > attractBlend ? ATTRACT_BLEND_SPEED_UP : ATTRACT_BLEND_SPEED_DOWN
    attractBlend += (tgt - attractBlend) * k
    if (attractBlend < 1e-4) attractBlend = 0
    else if (attractBlend > 0.999) attractBlend = 1
  }

  /** 甩动时瞬时关物理；连线等仍可按 attractBlend 渐隐 */
  const attractMag = attractInstant > 0 ? attractBlend : 0
  const attractVis = attractBlend

  /* 多余临时粒子：随 blend 走低慢慢摘掉，避免一关就全没 */
  if (particles.length > n) {
    if (!mouseInView || attractVis < 0.035) {
      bonusTrimTick += 1
      if (bonusTrimTick >= 4) {
        bonusTrimTick = 0
        particles.pop()
      }
    } else {
      bonusTrimTick = 0
    }
  }

  const canBuildCluster =
    mouseInView && mouseSlowEnough && attractInstant > 0.03 && attractVis > 0.18
  if (!canBuildCluster) {
    mouseSpawnTick = 0
  } else {
    const bonusTarget = Math.round(MOUSE_BONUS_PARTICLES_MAX * attractVis)
    const cap = n + bonusTarget
    const spawnEvery =
      MOUSE_SPAWN_FRAMES_MIN +
      Math.round(MOUSE_SPAWN_FRAMES_EXTRA * (1 - attractVis))
    mouseSpawnTick += 1
    if (mouseSpawnTick >= spawnEvery && particles.length < cap) {
      mouseSpawnTick = 0
      particles.push(spawnAroundMouse())
    }
  }

  /* 弹簧壳层 + 外缘软壳（圆）+ 极弱切向 */
  if (mouseInView && mouseSlowEnough && attractMag > 0) {
    const rAt = MOUSE_ATTRACT_RADIUS
    const shellR = rAt * MOUSE_OUTER_SHELL_START
    const shellSpan = Math.max(1e-3, rAt - shellR)
    for (const p of particles) {
      const dx = mouseX - p.x
      const dy = mouseY - p.y
      const d = Math.hypot(dx, dy)
      if (d < 1e-4 || d >= rAt) continue
      const dSafe = Math.max(d, 12)
      const inv = 1 / dSafe
      const ux = dx * inv
      const uy = dy * inv
      const tx = -uy
      const ty = ux
      const edge = 1 - d / rAt
      const edgeW = edge * edge
      let aRad =
        MOUSE_SPRING_K * edgeW * attractMag * (d - MOUSE_RING_PREF)
      if (d > shellR) {
        const over = (d - shellR) / shellSpan
        aRad += MOUSE_SHELL_IN_K * over * over * attractMag
      }
      if (aRad > MOUSE_SPRING_ACC_CAP) aRad = MOUSE_SPRING_ACC_CAP
      if (aRad < -MOUSE_SPRING_ACC_CAP) aRad = -MOUSE_SPRING_ACC_CAP
      const kTan = MOUSE_SWIRL_STRENGTH * edge * attractMag
      p.vx += ux * aRad + tx * kTan
      p.vy += uy * aRad + ty * kTan
    }
  }

  /* 角向填隙：统计环绕光标的角度直方图，拥挤扇区受切向力滑向最空扇区，更快闭合成圆 */
  if (mouseInView && mouseSlowEnough && attractMag > 0.05) {
    const rAt = MOUSE_ATTRACT_RADIUS
    const NB = MOUSE_ANGLE_GAP_BINS
    const hist = new Array(NB).fill(0)
    const inZone = []
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      const dx = p.x - mouseX
      const dy = p.y - mouseY
      const d = Math.hypot(dx, dy)
      if (d < 14 || d >= rAt) continue
      let ang = Math.atan2(dy, dx)
      if (ang < 0) ang += Math.PI * 2
      const bin = Math.min(NB - 1, Math.floor((ang / (Math.PI * 2)) * NB))
      hist[bin] += 1
      inZone.push({ i, bin, ang })
    }
    let minBin = 0
    let minCount = 1e9
    let sum = 0
    for (let b = 0; b < NB; b += 1) {
      const h = hist[b]
      sum += h
      if (h < minCount) {
        minCount = h
        minBin = b
      }
    }
    const avg = sum / NB
    if (inZone.length >= 4 && avg >= 0.25) {
      const binW = (Math.PI * 2) / NB
      const targetAng = (minBin + 0.5) * binW
      for (const it of inZone) {
        const c = hist[it.bin]
        if (c <= avg * MOUSE_ANGLE_GAP_CROWD_OVER_AVG) continue
        const p = particles[it.i]
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const d = Math.hypot(dx, dy)
        const inv = 1 / d
        const tcx = -dy * inv
        const tcy = dx * inv
        let diff = targetAng - it.ang
        if (diff > Math.PI) diff -= Math.PI * 2
        if (diff < -Math.PI) diff += Math.PI * 2
        const dir = diff >= 0 ? 1 : -1
        const crowding = (c - avg) / (avg + 0.5)
        const edgeBoost = Math.min(1.15, (d / rAt) * 1.25)
        let k =
          MOUSE_ANGLE_GAP_FILL_STRENGTH *
          crowding *
          edgeBoost *
          attractMag *
          (0.4 + Math.abs(diff) / Math.PI)
        if (k > 0.48) k = 0.48
        p.vx += tcx * dir * k
        p.vy += tcy * dir * k
      }
    }
  }

  /* 吸引区内近距排斥：打散局部堆叠，外轮廓更接近均匀圆环 */
  if (mouseInView && attractMag > 0.08) {
    const rAt = MOUSE_ATTRACT_RADIUS
    const rr = CLUSTER_REPULSE_RANGE * CLUSTER_REPULSE_RANGE
    const kRep = CLUSTER_REPULSE_STRENGTH * attractMag
    const len = particles.length
    for (let i = 0; i < len; i += 1) {
      const a = particles[i]
      const da = Math.hypot(mouseX - a.x, mouseY - a.y)
      if (da >= rAt) continue
      for (let j = i + 1; j < len; j += 1) {
        const b = particles[j]
        const db = Math.hypot(mouseX - b.x, mouseY - b.y)
        if (db >= rAt) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy
        if (d2 >= rr || d2 < 1e-8) continue
        const d = Math.sqrt(d2)
        const t = 1 - d / CLUSTER_REPULSE_RANGE
        const f = kRep * t * t
        const nx = dx / d
        const ny = dy / d
        a.vx -= nx * f
        a.vy -= ny * f
        b.vx += nx * f
        b.vy += ny * f
      }
    }
  }

  /* 快划：仅吸引半径内；先剥跟手惯性（径向朝内 + 沿拖拽向），再随机冲量，避免仍顺鼠标飞 */
  if (mouseInView && smoothedMouseSpeed > MOUSE_FLEE_SPEED_THRESH) {
    const rAt = MOUSE_ATTRACT_RADIUS
    const over = smoothedMouseSpeed - MOUSE_FLEE_SPEED_THRESH
    const gainBase = Math.min(
      MOUSE_FLEE_CAPTURED_CAP,
      MOUSE_FLEE_CAPTURED_STRENGTH * over * 0.95,
    )
    const spm = Math.hypot(lastMouseDx, lastMouseDy)
    let dragMx = 0
    let dragMy = 0
    if (spm > 0.08) {
      const inv = 1 / spm
      dragMx = lastMouseDx * inv
      dragMy = lastMouseDy * inv
    }
    for (const p of particles) {
      const dxp = p.x - mouseX
      const dyp = p.y - mouseY
      const d = Math.hypot(dxp, dyp)
      if (d > rAt || d < 1e-4) continue
      const invd = 1 / d
      /* 粒子 → 光标 单位向量；vr>0 表示仍在被「吸向」光标 */
      const uxIn = -dxp * invd
      const uyIn = -dyp * invd
      const vr = p.vx * uxIn + p.vy * uyIn
      if (vr > 0) {
        const s = MOUSE_FLEE_STRIP_RADIAL_IN * vr
        p.vx -= uxIn * s
        p.vy -= uyIn * s
      }
      if (spm > 0.08) {
        const along = p.vx * dragMx + p.vy * dragMy
        if (along > 0) {
          const t = MOUSE_FLEE_STRIP_ALONG_DRAG * along
          p.vx -= dragMx * t
          p.vy -= dragMy * t
        }
      }
      const ang = Math.random() * Math.PI * 2
      const g =
        gainBase *
        (MOUSE_FLEE_GAIN_JITTER_LO +
          Math.random() *
            (MOUSE_FLEE_GAIN_JITTER_HI - MOUSE_FLEE_GAIN_JITTER_LO))
      p.vx += Math.cos(ang) * g
      p.vy += Math.sin(ang) * g
    }
  }

  for (const p of particles) {
    let dMouse = 1e12
    if (mouseInView) dMouse = Math.hypot(mouseX - p.x, mouseY - p.y)
    const inAttractField =
      mouseInView &&
      mouseSlowEnough &&
      attractMag > 0.06 &&
      dMouse < MOUSE_ATTRACT_RADIUS
    if (!inAttractField) {
      p.vx += (Math.random() - 0.5) * AMBIENT_DRIFT_ACCEL
      p.vy += (Math.random() - 0.5) * AMBIENT_DRIFT_ACCEL
      p.vx *= PARTICLE_VELOCITY_DAMP_BG
      p.vy *= PARTICLE_VELOCITY_DAMP_BG
    } else {
      p.vx *= PARTICLE_VELOCITY_DAMP
      p.vy *= PARTICLE_VELOCITY_DAMP
    }
    const vCap = inAttractField ? PARTICLE_MAX_SPEED : PARTICLE_MAX_SPEED_BG
    const sp = Math.hypot(p.vx, p.vy)
    if (sp > vCap && sp > 1e-6) {
      const s = vCap / sp
      p.vx *= s
      p.vy *= s
    }
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > w) p.vx *= -1
    if (p.y < 0 || p.y > h) p.vy *= -1
    p.x = Math.max(0, Math.min(w, p.x))
    p.y = Math.max(0, Math.min(h, p.y))
  }

  const ld2 = linkDist * linkDist
  ctx.lineWidth = 0.65
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i]
      const b = particles[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d2 = dx * dx + dy * dy
      if (d2 < ld2) {
        const t = 1 - d2 / ld2
        ctx.save()
        ctx.globalAlpha = t * 0.22
        ctx.strokeStyle = line
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  /* 光标径向连线：细线束 + 近中心略亮，贴近参考图蒲公英效果 */
  if (mouseInView && attractVis > 0.02) {
    const r2 = MOUSE_LINK_RADIUS * MOUSE_LINK_RADIUS
    ctx.lineWidth = 0.55
    const visCurve = attractVis * attractVis
    for (const p of particles) {
      const dx = p.x - mouseX
      const dy = p.y - mouseY
      const d2 = dx * dx + dy * dy
      if (d2 >= r2) continue
      const t = 1 - d2 / r2
      const alpha =
        (0.06 + t * 0.36) * visCurve * MOUSE_RADIAL_ALPHA_MUL
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = line
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(mouseX, mouseY)
      ctx.stroke()
      ctx.restore()
    }
  }

  ctx.fillStyle = dot
  for (const p of particles) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.22, 0, Math.PI * 2)
    ctx.fill()
  }

  raf = requestAnimationFrame(tick)
}

function onVisibility() {
  running = document.visibilityState !== 'hidden'
  if (running && active.value && !reducedMotion.value) {
    cancelAnimationFrame(raf)
    tick()
  }
}

function checkReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let mq = null
let mqHandler = null

function startLayer() {
  if (typeof window === 'undefined') return
  if (reducedMotion.value || !active.value) return
  requestAnimationFrame(() => resize())
  running = true
  cancelAnimationFrame(raf)
  attachMouseListeners()
  lastTickMouseX = mouseX
  lastTickMouseY = mouseY
  tick()
}

function stopLayer() {
  running = false
  cancelAnimationFrame(raf)
  detachMouseListeners()
}

function refreshParticlesPref() {
  userParticlesEnabled.value = readParticlesPref()
}

function onParticlesStorage(e) {
  if (e.key === PARTICLES_PREF_KEY || e.key === null) refreshParticlesPref()
}

onMounted(() => {
  userParticlesEnabled.value = readParticlesPref()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onParticlesStorage)
    window.addEventListener(PARTICLES_PREF_EVENT, refreshParticlesPref)
  }

  reducedMotion.value = checkReducedMotion()
  if (reducedMotion.value) return

  window.addEventListener('resize', resize, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)

  mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mqHandler = () => {
    reducedMotion.value = mq.matches
    if (reducedMotion.value) stopLayer()
    else startLayer()
  }
  if (mq.addEventListener) mq.addEventListener('change', mqHandler)
  else mq.addListener(mqHandler)

  if (active.value) startLayer()
})

onUnmounted(() => {
  stopLayer()
  detachMouseListeners()
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', onParticlesStorage)
    window.removeEventListener(PARTICLES_PREF_EVENT, refreshParticlesPref)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    if (mq && mqHandler) {
      if (mq.removeEventListener) mq.removeEventListener('change', mqHandler)
      else mq.removeListener(mqHandler)
    }
  }
})

watch(active, (on) => {
  if (typeof window === 'undefined') return
  if (reducedMotion.value) return
  if (on) startLayer()
  else stopLayer()
})
</script>

<style scoped>
.lk-network-particles {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.lk-network-particles__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
