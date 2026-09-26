"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import type { MonsterDef, MonsterPoint } from "@/data/clicker/monsters"
import { playSfx } from "@/components/clicker/clicker-sfx"
import "./clicker-monster.css"

const ROAR_MS = 1100
const HIT_MS = 180
const MAX_PARTICLES = 420

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)"
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/** Live `prefers-reduced-motion`; false on the server. */
const useReducedMotion = () => useSyncExternalStore(subscribeReduced, reducedMotion, () => false)

/** Pin the art's points as CSS vars (percent → fraction) for the overlays. */
function monsterVars(m: MonsterDef): CSSProperties {
  return {
    "--m-accent": m.accent,
    // The crop works on screen positions, so a mirrored art is focused on its mirrored point.
    "--m-fx": (m.flip ? 100 - m.focus.x : m.focus.x) / 100,
    "--m-hx-screen": m.flip ? 100 - m.head.x : m.head.x,
    "--m-bx-screen": m.flip ? 100 - m.body.x : m.body.x,
    "--m-fy": m.focus.y / 100,
    "--m-bx": m.body.x,
    "--m-by": m.body.y,
    "--m-br": m.body.r,
    "--m-hx": m.head.x,
    "--m-hy": m.head.y,
  } as CSSProperties
}

/* ---------------- particles ---------------- */

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
  /** Gravity in scene-heights per s². */
  g: number
  streak: boolean
  sway: number
}

type Ring = { x: number; y: number; age: number; life: number; reach: number; color: string; width: number }
type Bolt = { points: [number, number][]; age: number; life: number }

type FxState = {
  particles: Particle[]
  rings: Ring[]
  bolts: Bolt[]
  /** Seconds until the next scheduled ambient event (bolt / pulse). */
  nextEvent: number
  carry: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

/** Jagged midpoint-displacement bolt between two scene points (0..1). */
function makeBolt(from: [number, number], to: [number, number]): Bolt {
  let pts: [number, number][] = [from, to]
  let spread = 0.09
  for (let pass = 0; pass < 6; pass++) {
    const next: [number, number][] = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]
      const [bx, by] = pts[i]
      next.push([(ax + bx) / 2 + rand(-spread, spread), (ay + by) / 2 + rand(-spread, spread) * 0.4], pts[i])
    }
    pts = next
    spread *= 0.55
  }
  return { points: pts, age: 0, life: 0.32 }
}

function spawn(fx: FxState, p: Partial<Particle> & Pick<Particle, "x" | "y">) {
  if (fx.particles.length >= MAX_PARTICLES) return
  fx.particles.push({ vx: 0, vy: 0, age: 0, life: 1, size: 1.5, color: "#fff", g: 0, streak: false, sway: 0, ...p })
}

function burst(fx: FxState, at: MonsterPoint, color: string, count: number, speed: number) {
  const x = at.x / 100
  const y = at.y / 100
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(0.3, 1) * speed
    spawn(fx, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - speed * 0.3,
      life: rand(0.35, 0.8),
      size: rand(1.2, 2.6),
      color: Math.random() < 0.35 ? "#ffffff" : color,
      g: 0.9,
      streak: true,
    })
  }
}

/** Ambient emission for one frame of `dt` seconds. */
function emitAmbient(fx: FxState, m: MonsterDef, dt: number, onBolt: () => void) {
  const rate = { motes: 16, signal: 14, lightning: 90, embers: 26, sparks: 30 }[m.fx]
  fx.carry += rate * dt
  const emitters = m.emitters ?? []
  while (fx.carry >= 1) {
    fx.carry -= 1
    switch (m.fx) {
      case "motes":
        spawn(fx, {
          x: rand(0.04, 0.96),
          y: rand(0.55, 0.98),
          vy: -rand(0.02, 0.06),
          life: rand(4, 7),
          size: rand(0.8, 2.4),
          color: Math.random() < 0.3 ? "#e6ffff" : m.accent,
          sway: rand(0.004, 0.012),
        })
        break
      case "signal": {
        const tower = Math.random() < 0.45 ? pick(emitters) : undefined
        spawn(fx, {
          x: tower ? tower.x / 100 + rand(-0.015, 0.015) : rand(0.05, 0.95),
          y: tower ? tower.y / 100 + rand(-0.1, 0.25) : rand(0.35, 0.95),
          vy: tower ? -rand(0.25, 0.45) : -rand(0.02, 0.05),
          life: tower ? rand(0.6, 1.1) : rand(3, 5),
          size: rand(0.8, 1.8),
          color: Math.random() < 0.5 ? "#b8ffd8" : m.accent,
          streak: Boolean(tower),
          sway: tower ? 0 : 0.006,
        })
        break
      }
      case "lightning":
        spawn(fx, {
          x: rand(-0.1, 1.1),
          y: rand(-0.05, 0.3),
          vx: -0.12,
          vy: rand(1.1, 1.5),
          life: rand(0.5, 0.9),
          size: 0.8,
          color: "rgba(190,215,255,0.55)",
          streak: true,
        })
        break
      case "embers":
        spawn(fx, {
          x: Math.random() < 0.7 ? rand(0.02, 0.98) : m.body.x / 100 + rand(-0.15, 0.15),
          y: rand(0.78, 1.02),
          vx: rand(-0.02, 0.02),
          vy: -rand(0.08, 0.22),
          life: rand(2, 4.2),
          size: rand(0.9, 2.8),
          color: pick(["#ffd27a", "#ff9a3c", "#ff5a1f", m.accent]),
          sway: rand(0.006, 0.02),
        })
        break
      case "sparks": {
        const [torchA, torchB, ...furnaces] = emitters
        const torch = Math.random() < 0.5 ? torchA : torchB
        if (Math.random() < 0.72 && torch) {
          spawn(fx, {
            x: torch.x / 100,
            y: torch.y / 100,
            vx: rand(-0.12, 0.12),
            vy: rand(-0.05, 0.12),
            life: rand(0.5, 1.1),
            size: rand(0.9, 1.9),
            color: pick(["#fff4c8", "#ffd27a", "#ffae4a"]),
            g: 0.75,
            streak: true,
          })
        } else if (furnaces.length) {
          const f = pick(furnaces)
          spawn(fx, {
            x: f.x / 100 + rand(-0.04, 0.04),
            y: f.y / 100,
            vx: rand(-0.02, 0.02),
            vy: -rand(0.1, 0.2),
            life: rand(1.2, 2.4),
            size: rand(1, 2.4),
            color: pick(["#ffd27a", "#ff7a1a"]),
            sway: 0.012,
          })
        }
        break
      }
    }
  }

  fx.nextEvent -= dt
  if (fx.nextEvent > 0) return
  if (m.fx === "lightning") {
    const target = emitters[0] && Math.random() < 0.55 ? emitters[0] : { x: rand(15, 90), y: rand(55, 90) }
    fx.bolts.push(makeBolt([rand(0.15, 0.95), -0.02], [target.x / 100, target.y / 100]))
    if (Math.random() < 0.4) fx.bolts.push(makeBolt([rand(0.1, 0.9), -0.02], [rand(0.1, 0.9), rand(0.3, 0.7)]))
    onBolt()
    fx.nextEvent = rand(2.6, 6)
  } else if (m.fx === "signal") {
    fx.rings.push({ x: m.head.x / 100, y: m.head.y / 100, age: 0, life: 2.2, reach: 0.34, color: m.accent, width: 2 })
    for (const tower of emitters) {
      fx.rings.push({ x: tower.x / 100, y: tower.y / 100, age: -rand(0, 0.6), life: 1.6, reach: 0.12, color: "#6dffe0", width: 1.5 })
    }
    fx.nextEvent = rand(1.6, 2.4)
  } else if (m.fx === "motes" && emitters[0]) {
    fx.rings.push({ x: emitters[0].x / 100, y: emitters[0].y / 100, age: 0, life: 2.6, reach: 0.16, color: m.accent, width: 1.5 })
    fx.nextEvent = rand(2.2, 3.4)
  } else {
    fx.nextEvent = 99
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: FxState, w: number, h: number, dt: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  ctx.globalCompositeOperation = "lighter"

  fx.particles = fx.particles.filter((p) => (p.age += dt) < p.life)
  for (const p of fx.particles) {
    p.vy += p.g * dt
    p.x += (p.vx + (p.sway ? Math.sin(t * 1.7 + p.life * 9) * p.sway : 0)) * dt
    p.y += p.vy * dt
    const k = p.age / p.life
    const alpha = Math.min(1, k * 6) * (1 - k) ** 1.4
    if (alpha <= 0.01) continue
    ctx.globalAlpha = alpha
    ctx.strokeStyle = ctx.fillStyle = p.color
    const px = p.x * w
    const py = p.y * h
    if (p.streak) {
      ctx.lineWidth = p.size
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - p.vx * w * 0.045, py - p.vy * h * 0.045)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  fx.rings = fx.rings.filter((r) => (r.age += dt) < r.life)
  for (const r of fx.rings) {
    if (r.age < 0) continue
    const k = r.age / r.life
    const eased = 1 - (1 - k) ** 3
    ctx.globalAlpha = (1 - k) * 0.85
    ctx.strokeStyle = r.color
    ctx.lineWidth = r.width * (1 - k * 0.6)
    ctx.beginPath()
    ctx.ellipse(r.x * w, r.y * h, eased * r.reach * w, eased * r.reach * w * 0.62, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  fx.bolts = fx.bolts.filter((b) => (b.age += dt) < b.life)
  for (const b of fx.bolts) {
    const k = b.age / b.life
    // Strobe twice, like a real return stroke.
    const alpha = (k < 0.25 || (k > 0.45 && k < 0.6) ? 1 : 0.35) * (1 - k)
    ctx.globalAlpha = alpha
    ctx.lineJoin = "round"
    for (const [width, color] of [
      [9, "rgba(120,170,255,0.35)"],
      [3.5, "rgba(190,220,255,0.9)"],
      [1.4, "#ffffff"],
    ] as const) {
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.beginPath()
      b.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
}

/* ---------------- stage ---------------- */

type StageProps = {
  monster: MonsterDef
  /** Bump to make the guardian roar (region activity used, challenge cleared…). */
  roarKey: number
  muted: boolean
  className?: string
}

type Pulse = { kind: "hit" | "roar" | "bolt"; n: number }

/**
 * The region's guardian as a living backdrop: slow camera drift, a breathing body,
 * glowing eyes, region weather on a canvas, and reactions to taps and roars.
 * Purely presentational — taps give feedback, never rewards.
 */
export function ClickerMonsterStage({ monster, roarKey, muted, className = "" }: StageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<FxState>({ particles: [], rings: [], bolts: [], nextEvent: 1.2, carry: 0 })
  const mutedRef = useRef(muted)
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [state, setState] = useState<"idle" | "hit" | "roar">("idle")
  const reduced = useReducedMotion()

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Fresh weather per guardian.
  useEffect(() => {
    fxRef.current = { particles: [], rings: [], bolts: [], nextEvent: 1.2, carry: 0 }
  }, [monster.regionId])

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    const scene = sceneRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !scene || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let w = 0
    let h = 0
    const fit = () => {
      w = scene.offsetWidth
      h = scene.offsetHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(scene)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      emitAmbient(fxRef.current, monster, dt, () => {
        setPulse((p) => ({ kind: "bolt", n: (p?.n ?? 0) + 1 }))
        if (!mutedRef.current && Math.random() < 0.5) playSfx("lightning")
      })
      drawFx(ctx, fxRef.current, w, h, dt, now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [monster, reduced])

  // Roar on demand (skips the initial mount value).
  const seenRoar = useRef(roarKey)
  useEffect(() => {
    if (roarKey === seenRoar.current) return
    seenRoar.current = roarKey
    const fx = fxRef.current
    for (let i = 0; i < 3; i++) {
      fx.rings.push({ x: monster.head.x / 100, y: monster.head.y / 100, age: -i * 0.14, life: 1.1, reach: 0.55, color: monster.accent, width: 4 })
    }
    for (const eye of monster.eyes) burst(fx, eye, monster.accent, 26, 0.5)
    burst(fx, monster.head, "#ffffff", 20, 0.7)
    setPulse((p) => ({ kind: "roar", n: (p?.n ?? 0) + 1 }))
    setState("roar")
    if (!mutedRef.current) playSfx("monsterRoar")
    const id = window.setTimeout(() => setState("idle"), ROAR_MS)
    return () => window.clearTimeout(id)
  }, [roarKey, monster])

  // Idle growl: every so often the eyes flare and the body shudders.
  useEffect(() => {
    if (reduced) return
    let id = 0
    const arm = () => {
      id = window.setTimeout(() => {
        setState((s) => (s === "idle" ? "hit" : s))
        window.setTimeout(() => setState((s) => (s === "hit" ? "idle" : s)), 420)
        arm()
      }, rand(8000, 14000))
    }
    arm()
    return () => window.clearTimeout(id)
  }, [reduced])

  const hitTimer = useRef(0)
  const onPointerDown = (e: ReactPointerEvent) => {
    const scene = sceneRef.current
    if (!scene) return
    const rect = scene.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width) * 100
    const at = { x: monster.flip ? 100 - sx : sx, y: ((e.clientY - rect.top) / rect.height) * 100 }
    const fx = fxRef.current
    burst(fx, at, monster.accent, 22, 0.42)
    fx.rings.push({ x: at.x / 100, y: at.y / 100, age: 0, life: 0.45, reach: 0.06, color: "#ffffff", width: 2.5 })
    const onBody = Math.hypot(at.x - monster.body.x, (at.y - monster.body.y) / 1.78) < monster.body.r
    if (!onBody) return
    setPulse((p) => ({ kind: "hit", n: (p?.n ?? 0) + 1 }))
    setState((s) => (s === "roar" ? s : "hit"))
    window.clearTimeout(hitTimer.current)
    hitTimer.current = window.setTimeout(() => setState((s) => (s === "hit" ? "idle" : s)), HIT_MS)
    if (!mutedRef.current) playSfx("monsterHit")
  }
  useEffect(() => () => window.clearTimeout(hitTimer.current), [])

  return (
    <div
      ref={rootRef}
      className={`clicker-monster is-${monster.fx} is-${state}${monster.flip ? " is-flipped" : ""}${reduced ? " is-still" : ""} ${className}`}
      style={monsterVars(monster)}
      onPointerDown={onPointerDown}
      aria-hidden
    >
      <div className="clicker-monster-shake">
        <div className="clicker-monster-cam">
          <div ref={sceneRef} className="clicker-monster-scene">
            <img className="clicker-monster-base" src={monster.src} alt="" draggable={false} />
            <img className="clicker-monster-body" src={monster.src} alt="" draggable={false} />
            {monster.eyes.map((eye, i) => (
              <span
                key={i}
                className="clicker-monster-eye"
                style={{ left: `${eye.x}%`, top: `${eye.y}%`, animationDelay: `${-i * 0.37}s` }}
              />
            ))}
            <span className="clicker-monster-aura" />
            {!reduced ? <canvas ref={canvasRef} className="clicker-monster-fx" /> : null}
          </div>
        </div>
      </div>
      <div className="clicker-monster-fog" />
      {pulse ? <div key={pulse.n} className={`clicker-monster-flash is-${pulse.kind}`} /> : null}
    </div>
  )
}

/* ---------------- encounter cinematic ---------------- */

const ENCOUNTER_MS = 3200
const IMPACT_MS = 1000

/**
 * Boss-style arrival card: letterbox, hazard banner, camera push from the guardian's eyes,
 * then an impact that slams the nameplate in. Tap / Esc skips; reduced motion skips it outright.
 */
export function ClickerMonsterEncounter({
  monster,
  regionName,
  muted,
  onDone,
}: {
  monster: MonsterDef
  regionName: string
  muted: boolean
  onDone: () => void
}) {
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    if (reducedMotion()) {
      doneRef.current()
      return
    }
    const impact = window.setTimeout(() => {
      if (!muted) playSfx("monsterRoar")
    }, IMPACT_MS)
    const end = window.setTimeout(() => doneRef.current(), ENCOUNTER_MS)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      doneRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(impact)
      window.clearTimeout(end)
      window.removeEventListener("keydown", onKey)
    }
  }, [muted])

  const banner = Array.from({ length: 6 }, () => "WARNING · GUARDIAN DETECTED · ").join("")
  return (
    <div
      className={`clicker-encounter${monster.flip ? " is-flipped" : ""}`}
      style={monsterVars(monster)}
      role="dialog"
      aria-modal="true"
      aria-label={`${regionName} 수호자 · ${monster.name}`}
      onPointerDown={() => doneRef.current()}
    >
      <div className="clicker-encounter-shake">
        <div className="clicker-encounter-art">
          <img src={monster.src} alt="" draggable={false} />
        </div>
      </div>
      <div className="clicker-encounter-flash" />
      <div className="clicker-encounter-bar is-top" />
      <div className="clicker-encounter-bar is-bottom" />
      <div className="clicker-encounter-warning" aria-hidden>
        <span>{banner}</span>
        <span>{banner}</span>
      </div>
      <div className="clicker-encounter-plate">
        <p className="clicker-encounter-kicker">{regionName} · GUARDIAN</p>
        <h2>{monster.nameEn}</h2>
        <p className="clicker-encounter-epithet">
          <strong>{monster.name}</strong> — {monster.epithet}
        </p>
      </div>
      <p className="clicker-encounter-skip">탭하여 건너뛰기</p>
    </div>
  )
}
