"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import {
  LANDSCAPE,
  MONSTERS,
  PORTRAIT,
  SPAWN_S,
  createHunt,
  emitterOf,
  floorOf,
  hitsMonster,
  huntScore,
  isEnraged,
  monsterPosition,
  nextPlateCrack,
  stepHunt,
  type Field,
  type HuntState,
  type MonsterDef,
  type MonsterKind,
} from "@/domain/services/clicker-monster"
import { playMonsterCue, setLaserHum, stopLaserHum } from "@/components/clicker/clicker-sfx"

/* ---------- Art data (local coords, body centre = 0,0) ---------- */

type Plate = { x: number; y: number; r: number; s: number; shape: number; on?: "armL" | "armR" }

const PLATE_SHAPES = [
  "0,-24 17,-11 15,12 0,22 -16,11 -18,-9",
  "-4,-26 14,-16 20,4 6,20 -14,16 -20,-4",
  "0,-21 20,-6 12,18 -12,18 -20,-6",
]
const PLATE_LIGHT = ["0,-24 17,-11 0,0", "-4,-26 14,-16 0,0", "0,-21 20,-6 0,0"]
const PLATE_DARK = ["0,22 -16,11 0,0", "6,20 -14,16 0,0", "12,18 -12,18 0,0"]

/** Break order = array order: the outer shell goes first, the belly plate last. */
const PLATES: Record<MonsterKind, Plate[]> = {
  specter: [
    { x: -78, y: 0, r: -40, s: 0.85, shape: 2 },
    { x: 78, y: 2, r: 38, s: 0.9, shape: 1 },
    { x: -52, y: -50, r: -25, s: 1.05, shape: 0 },
    { x: 50, y: -52, r: 22, s: 1.0, shape: 1 },
    { x: 0, y: -70, r: 0, s: 1.15, shape: 0 },
    { x: 0, y: 30, r: 180, s: 0.8, shape: 2 },
  ],
  golem: [
    { x: -6, y: 22, r: -5, s: 0.95, shape: 2, on: "armL" },
    { x: 6, y: 22, r: 5, s: 0.95, shape: 2, on: "armR" },
    { x: -88, y: -62, r: -15, s: 1.25, shape: 1 },
    { x: 88, y: -62, r: 15, s: 1.25, shape: 1 },
    { x: 0, y: -132, r: 0, s: 0.9, shape: 0 },
    { x: -40, y: -24, r: -8, s: 1.15, shape: 0 },
    { x: 40, y: -24, r: 8, s: 1.15, shape: 2 },
    { x: 0, y: 36, r: 180, s: 1.05, shape: 1 },
  ],
}

const PALETTE: Record<MonsterKind, { ore: string; oreLight: string; oreDark: string; body: string; bodyEdge: string; core: string; rage: string }> = {
  specter: { ore: "#48c7e6", oreLight: "#bdf4ff", oreDark: "#1b6f8c", body: "#12343f", bodyEdge: "#6fe3ff", core: "#8ff4ff", rage: "#ff6a5c" },
  golem: { ore: "#9a6bff", oreLight: "#dccaff", oreDark: "#4a2d93", body: "#2a2336", bodyEdge: "#8d74c9", core: "#c49bff", rage: "#ff5a4e" },
}

/* ---------- Particles ---------- */

type Particle = {
  kind: "spark" | "chip" | "plate" | "shard" | "dust" | "ring" | "text"
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  rot: number
  vr: number
  size: number
  color: string
  shape?: number
  text?: string
  bounced?: boolean
}

const GRAVITY = 1100
const MAX_PARTICLES = 320

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function stepParticles(list: Particle[], dt: number, floorY: number): Particle[] {
  const out: Particle[] = []
  for (const p of list) {
    const life = p.life - dt
    if (life <= 0) continue
    const g = p.kind === "dust" || p.kind === "ring" || p.kind === "text" ? 0 : p.kind === "spark" ? GRAVITY * 0.8 : GRAVITY
    let vy = p.vy + g * dt
    let vx = p.vx * (p.kind === "dust" ? 0.9 : 1)
    let y = p.y + vy * dt
    let bounced = p.bounced
    if ((p.kind === "plate" || p.kind === "shard" || p.kind === "chip") && y > floorY && vy > 0) {
      // Ore lands on the floor with one dull bounce, then skids.
      y = floorY
      vy = bounced ? 0 : -vy * 0.32
      vx *= 0.6
      bounced = true
    }
    out.push({ ...p, x: p.x + vx * dt, y, vx, vy, life, rot: p.rot + p.vr * dt, vr: p.vr * (bounced ? 0.9 : 1), bounced })
  }
  return out.length > MAX_PARTICLES ? out.slice(out.length - MAX_PARTICLES) : out
}

/* ---------- Frame model ---------- */

type View = {
  field: Field
  t: number
  hunt: HuntState
  pos: { x: number; y: number; facing: 1 | -1 }
  firing: boolean
  aim: { x: number; y: number } | null
  burning: boolean
  particles: Particle[]
  shake: number
  punch: number
  flash: number
  blink: number
  /** Per-frame noise, rolled in the loop so rendering stays pure. */
  jitter: { bodyX: number; bodyY: number; fieldX: number; fieldY: number; beam: number; flare: number }
}

const NO_JITTER = { bodyX: 0, bodyY: 0, fieldX: 0, fieldY: 0, beam: 0, flare: 0 }

function initialView(def: MonsterDef, field: Field): View {
  const hunt = createHunt(def)
  return {
    field,
    t: 0,
    hunt,
    pos: monsterPosition(def.kind, 0, field),
    firing: false,
    aim: null,
    burning: false,
    particles: [],
    shake: 0,
    punch: 0,
    flash: 0,
    blink: 0,
    jitter: NO_JITTER,
  }
}

const easeOutBack = (p: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2)
}

/** Plate's world position for the particle that replaces it when it pops off. */
function plateWorld(v: View, plate: Plate) {
  const armX = plate.on === "armL" ? -100 : plate.on === "armR" ? 100 : 0
  return { x: v.pos.x + v.pos.facing * (plate.x + armX), y: v.pos.y + plate.y }
}

type Props = {
  kind: MonsterKind
  playing: boolean
  muted: boolean
  /** A monster died (the parent counts it as a hit). */
  onKill: () => void
  /** Live 0..1 score including damage on the current monster. */
  onScore: (score: number) => void
}

/**
 * Monster Hunt: hold the laser on an ore-armored monster until its plates crack off and it
 * falls. Mouse/touch aims; holding Space auto-aims. The monster breathes, blinks, watches
 * the beam, flinches and guards while burning, enrages at low HP, shatters and re-emerges.
 */
export function MonsterHunt({ kind, playing, muted, onKill, onScore }: Props) {
  const def = MONSTERS[kind]
  const [view, setView] = useState<View>(() => initialView(def, LANDSCAPE))
  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  /** Upright phones get a tall field so the monster isn't a speck in a wide strip. */
  const fieldRef = useRef<Field>(LANDSCAPE)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const pick = () => {
      const { width, height } = el.getBoundingClientRect()
      fieldRef.current = height > 0 && width / height < 0.9 ? PORTRAIT : LANDSCAPE
    }
    pick()
    const ro = new ResizeObserver(pick)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const input = useRef({ pointer: false, key: false, aim: null as { x: number; y: number } | null })
  const live = useRef({ playing, muted, onKill, onScore })
  useEffect(() => {
    live.current = { playing, muted, onKill, onScore }
  })

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let last = performance.now()
    let v = initialView(def, fieldRef.current)
    let nextBlink = 2
    let lastScore = -1
    let prevStep = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { playing: isPlaying, muted: isMuted } = live.current
      const t = v.t + dt
      const field = fieldRef.current
      const firing = isPlaying && (input.current.pointer || input.current.key)
      let hunt = v.hunt
      let pos = monsterPosition(def.kind, hunt.pathT, field)
      // Space = auto-aim at the body, so the game is playable without a pointer.
      const aim = input.current.key ? { x: pos.x, y: pos.y } : input.current.aim
      const burning = firing && !!aim && hitsMonster(def, hunt, aim, field)
      let particles = v.particles
      let { shake, punch, flash } = v
      const born: Particle[] = []

      if (isPlaying) {
        const before = hunt
        const result = stepHunt(def, hunt, dt, burning)
        hunt = result.state
        pos = monsterPosition(def.kind, hunt.pathT, field)
        // Every plate that broke this frame flies off from where it sat.
        for (let i = before.platesBroken; i < hunt.platesBroken; i++) {
          const plate = PLATES[def.kind][i]
          const at = plate ? plateWorld({ ...v, pos }, plate) : pos
          const dir = Math.atan2(at.y - pos.y, at.x - pos.x || 0.01)
          born.push({
            kind: "plate", x: at.x, y: at.y,
            vx: Math.cos(dir) * rand(260, 420), vy: Math.sin(dir) * 260 - rand(260, 380),
            life: 1.6, max: 1.6, rot: plate?.r ?? 0, vr: rand(-540, 540), size: (plate?.s ?? 1) * 1.1,
            color: PALETTE[def.kind].ore, shape: plate?.shape ?? 0,
          })
          for (let c = 0; c < 7; c++) {
            born.push({ kind: "chip", x: at.x, y: at.y, vx: rand(-260, 260), vy: rand(-380, -80), life: 0.9, max: 0.9, rot: rand(0, 360), vr: rand(-720, 720), size: rand(3, 7), color: PALETTE[def.kind].oreLight })
          }
          punch = 1
          flash = Math.max(flash, 0.7)
          shake = Math.max(shake, 6)
        }
        if (hunt.platesBroken > before.platesBroken) playMonsterCue(isMuted, "plate")
        for (const e of result.events) {
          if (e === "kill") {
            for (let i = 0; i < 22; i++) {
              const a = rand(0, Math.PI * 2)
              const sp = rand(220, 620)
              born.push({ kind: "shard", x: pos.x + rand(-40, 40), y: pos.y + rand(-50, 50), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, life: rand(0.9, 1.4), max: 1.4, rot: rand(0, 360), vr: rand(-900, 900), size: rand(6, 16), color: i % 3 === 0 ? PALETTE[def.kind].oreLight : i % 3 === 1 ? PALETTE[def.kind].ore : PALETTE[def.kind].body })
            }
            born.push({ kind: "ring", x: pos.x, y: pos.y, vx: 0, vy: 0, life: 0.55, max: 0.55, rot: 0, vr: 0, size: 40, color: PALETTE[def.kind].core })
            born.push({ kind: "text", x: pos.x, y: pos.y - def.hitRy - 10, vx: 0, vy: -70, life: 1, max: 1, rot: 0, vr: 0, size: 38, color: "#fff4c2", text: "처치!" })
            shake = Math.max(shake, 14)
            flash = 1
            playMonsterCue(isMuted, "kill")
            live.current.onKill()
          } else if (e === "spawned") {
            playMonsterCue(isMuted, "spawn")
          } else if (e === "enrage") {
            born.push({ kind: "ring", x: pos.x, y: pos.y, vx: 0, vy: 0, life: 0.45, max: 0.45, rot: 0, vr: 0, size: 30, color: PALETTE[def.kind].rage })
            playMonsterCue(isMuted, "enrage")
          }
        }
        // A new monster just started to rise: dust bursts where it emerges.
        if (before.phase === "dying" && hunt.phase === "spawn") {
          const p = monsterPosition(def.kind, hunt.pathT, field)
          const groundY = def.kind === "golem" ? p.y + 150 : p.y + 110
          for (let i = 0; i < 12; i++) born.push({ kind: "dust", x: p.x + rand(-90, 90), y: groundY, vx: rand(-90, 90), vy: rand(-40, -5), life: 0.8, max: 0.8, rot: 0, vr: 0, size: rand(14, 28), color: "#8a8fa0" })
        }
        if (burning && aim) {
          const sparks = Math.random() < dt * 70 ? 2 : 1
          for (let i = 0; i < sparks; i++) {
            const a = rand(-Math.PI, 0)
            const sp = rand(180, 520)
            born.push({ kind: "spark", x: aim.x, y: aim.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.18, 0.4), max: 0.4, rot: 0, vr: 0, size: rand(1.5, 3), color: Math.random() < 0.5 ? "#fff6d6" : "#ffd27a" })
          }
          if (hunt.platesBroken < def.plates && Math.random() < dt * 14) {
            born.push({ kind: "chip", x: aim.x, y: aim.y, vx: rand(-200, 200), vy: rand(-340, -120), life: 0.8, max: 0.8, rot: rand(0, 360), vr: rand(-720, 720), size: rand(2.5, 5), color: PALETTE[def.kind].ore })
          }
        }
        // Golem footfalls: dust, a stomp, and a small shake on each step.
        if (def.kind === "golem" && hunt.phase === "alive") {
          const step = Math.sin(hunt.pathT * Math.PI * 2 * 0.9)
          if (prevStep > 0 !== step > 0 && Math.abs(step - prevStep) < 1) {
            const footX = pos.x + (step > 0 ? -1 : 1) * 42
            for (let i = 0; i < 4; i++) born.push({ kind: "dust", x: footX + rand(-20, 20), y: pos.y + 150, vx: rand(-60, 60), vy: rand(-30, -5), life: 0.55, max: 0.55, rot: 0, vr: 0, size: rand(8, 16), color: "#6f6680" })
            shake = Math.max(shake, isEnraged(def, hunt) ? 5 : 3)
            playMonsterCue(isMuted, "stomp")
          }
          prevStep = step
        }
      }

      // Blink every few seconds (quick close, slower open).
      let blink = v.blink
      if (t > nextBlink) {
        blink = 1
        nextBlink = t + rand(2.2, 4.5)
      }
      blink = Math.max(0, blink - dt * 7)

      particles = stepParticles(particles.concat(born), dt, floorOf(field))
      const nextShake = reduced ? 0 : Math.max(0, shake - dt * 40)
      const tremble = burning && !reduced ? 3 : 0
      const jitter = {
        bodyX: (Math.random() - 0.5) * (tremble + nextShake * 0.3),
        bodyY: (Math.random() - 0.5) * tremble,
        fieldX: (Math.random() - 0.5) * nextShake,
        fieldY: (Math.random() - 0.5) * nextShake,
        beam: Math.random(),
        flare: Math.random(),
      }
      v = {
        field,
        t,
        hunt,
        pos,
        firing,
        aim,
        burning,
        particles,
        shake: nextShake,
        punch: Math.max(0, punch - dt * 5),
        flash: Math.max(0, flash - dt * 3),
        blink,
        jitter,
      }
      setView(v)
      setLaserHum(isMuted, !firing ? 0 : burning ? 1 : 0.4)
      const score = Math.round(huntScore(def, hunt) * 100) / 100
      if (score !== lastScore) {
        lastScore = score
        live.current.onScore(score)
      }
      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)
    return () => {
      window.cancelAnimationFrame(raf)
      stopLaserHum()
    }
  }, [def])

  useEffect(() => {
    if (!playing) {
      input.current.pointer = false
      input.current.key = false
    }
  }, [playing])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== " ") return
      e.preventDefault()
      input.current.key = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") input.current.key = false
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const toField = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const { hunt, pos, particles, field } = view
  const EMITTER = emitterOf(field)
  const FLOOR_Y = floorOf(field)
  const palette = PALETTE[kind]
  const enraged = isEnraged(def, hunt)
  const { bodyX: jx, bodyY: jy, fieldX: fieldShakeX, fieldY: fieldShakeY } = view.jitter

  let bodyScale = 1
  let bodyDy = 0
  let bodyOpacity = 1
  if (hunt.phase === "spawn") {
    const p = Math.min(1, hunt.phaseT / SPAWN_S)
    const e = easeOutBack(p)
    bodyScale = 0.35 + 0.65 * e
    bodyDy = (1 - e) * 140
    bodyOpacity = Math.min(1, p * 1.6)
  }
  const dyingFlash = hunt.phase === "dying" && hunt.phaseT < 0.12
  const hidden = hunt.phase === "dying" && !dyingFlash
  const breathe = Math.sin(view.t * (enraged ? 9 : 5)) * 0.03
  const sx = bodyScale * (1 - breathe + view.punch * 0.08)
  const sy = bodyScale * (1 + breathe - view.punch * 0.1)
  const heat = Math.min(1, hunt.burnT * 1.4)
  const lookAt = view.aim ?? EMITTER
  const look = (ex: number, ey: number) => {
    const wx = pos.x + pos.facing * ex
    const wy = pos.y + ey
    const d = Math.hypot(lookAt.x - wx, lookAt.y - wy) || 1
    return { dx: (((lookAt.x - wx) / d) * 5) * pos.facing, dy: ((lookAt.y - wy) / d) * 5 }
  }
  const squint = view.burning ? 0.35 : 1 - view.blink * 0.9
  const crack = nextPlateCrack(def, hunt)

  const beamEnd = view.firing && view.aim ? view.aim : null
  const beamAngle = beamEnd ? Math.atan2(beamEnd.y - EMITTER.y, beamEnd.x - EMITTER.x) : -Math.PI / 2
  const beamW = 4 + view.jitter.beam * 2 + (view.burning ? 2 : 0)

  const hpShare = hunt.phase === "alive" ? hunt.hp / def.hp : hunt.phase === "spawn" ? 1 : 0

  const plateEls = (on: Plate["on"]) =>
    PLATES[kind].map((plate, i) => {
      if (plate.on !== on || i < hunt.platesBroken) return null
      const cracking = i === hunt.platesBroken ? crack : 0
      return (
        <g key={i} transform={`translate(${plate.x} ${plate.y}) rotate(${plate.r}) scale(${plate.s})`}>
          <polygon points={PLATE_SHAPES[plate.shape]} fill={palette.ore} stroke={palette.oreDark} strokeWidth={2} />
          <polygon points={PLATE_LIGHT[plate.shape]} fill={palette.oreLight} opacity={0.75} />
          <polygon points={PLATE_DARK[plate.shape]} fill={palette.oreDark} opacity={0.7} />
          {cracking > 0.15 ? (
            <polyline
              points="-10,-14 -2,-4 -8,4 2,12 -1,20"
              fill="none"
              stroke="#10131c"
              strokeWidth={2.2}
              opacity={Math.min(1, cracking * 1.3)}
            />
          ) : null}
          {cracking > 0.55 ? <polyline points="-2,-4 10,-8 16,-2" fill="none" stroke="#10131c" strokeWidth={1.8} opacity={cracking} /> : null}
          {cracking > 0.6 ? <polygon points={PLATE_SHAPES[plate.shape]} fill="#fff" opacity={(cracking - 0.6) * Math.abs(Math.sin(view.t * 30)) * 0.8} /> : null}
        </g>
      )
    })

  const eye = (ex: number, ey: number, r: number, glow: string) => {
    const { dx, dy } = look(ex, ey)
    return (
      <g transform={`translate(${ex} ${ey}) scale(1 ${squint})`}>
        <ellipse rx={r} ry={r * 1.15} fill="#f2fbff" />
        <circle cx={dx} cy={dy} r={r * 0.5} fill={enraged ? palette.rage : "#0b1320"} />
        <circle cx={dx - r * 0.18} cy={dy - r * 0.22} r={r * 0.16} fill={glow} />
      </g>
    )
  }

  const hot = enraged ? palette.rage : palette.core

  return (
    <div ref={wrapRef} className={`clicker-hunt is-${kind}${enraged ? " is-enraged" : ""}`}>
      <svg
        ref={svgRef}
        className="clicker-hunt-field"
        viewBox={`0 0 ${field.w} ${field.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${def.name} — 누르고 있는 동안 레이저 발사 (Space: 자동 조준)`}
        onPointerDown={(e) => {
          if (!playing) return
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          input.current.pointer = true
          input.current.aim = toField(e)
        }}
        onPointerMove={(e) => {
          const p = toField(e)
          if (p) input.current.aim = p
        }}
        onPointerUp={() => {
          input.current.pointer = false
        }}
        onPointerCancel={() => {
          input.current.pointer = false
        }}
      >
        <defs>
          <radialGradient id={`hunt-halo-${kind}`}>
            <stop offset="0%" stopColor={hot} stopOpacity={0.45} />
            <stop offset="100%" stopColor={hot} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`hunt-body-${kind}`} cx="45%" cy="35%">
            <stop offset="0%" stopColor={palette.bodyEdge} stopOpacity={0.55} />
            <stop offset="100%" stopColor={palette.body} />
          </radialGradient>
          <linearGradient id="hunt-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.bodyEdge} stopOpacity={0.12} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </linearGradient>
        </defs>

        <g transform={`translate(${fieldShakeX} ${fieldShakeY})`}>
          <rect x={-20} y={FLOOR_Y} width={field.w + 40} height={field.h - FLOOR_Y + 20} fill="url(#hunt-floor)" />
          <line x1={0} y1={FLOOR_Y} x2={field.w} y2={FLOOR_Y} stroke={palette.bodyEdge} strokeOpacity={0.25} />

          {/* Ground shadow tracks the body; it shrinks as the specter floats higher. */}
          {!hidden ? (
            <ellipse
              cx={pos.x}
              cy={FLOOR_Y + 4}
              rx={(kind === "golem" ? 110 : 80) * bodyScale * (kind === "specter" ? 380 / (380 + (FLOOR_Y - pos.y)) * 1.6 : 1)}
              ry={12}
              fill="#000"
              opacity={0.35 * bodyOpacity}
            />
          ) : null}

          {!hidden ? (
            <g
              opacity={bodyOpacity}
              transform={`translate(${pos.x + jx} ${pos.y + bodyDy + jy}) scale(${pos.facing * sx} ${sy})`}
            >
              <circle r={kind === "golem" ? 190 : 150} fill={`url(#hunt-halo-${kind})`} opacity={0.4 + heat * 0.4 + (enraged ? 0.2 : 0)} />
              {kind === "specter" ? (
                <Specter t={view.t} burnT={hunt.burnT} enraged={enraged} palette={palette} heat={heat} flash={dyingFlash ? 1 : view.flash}>
                  {plateEls(undefined)}
                  {eye(-30, -6, 14, hot)}
                  {eye(30, -6, 14, hot)}
                </Specter>
              ) : (
                <Golem
                  pathT={hunt.pathT}
                  moving={hunt.phase === "alive"}
                  guard={Math.min(1, hunt.burnT * 3)}
                  enraged={enraged}
                  palette={palette}
                  heat={heat}
                  flash={dyingFlash ? 1 : view.flash}
                  armL={plateEls("armL")}
                  armR={plateEls("armR")}
                >
                  {plateEls(undefined)}
                  <g transform="translate(0 -112)">
                    {eye(-15, 0, 8, hot)}
                    {eye(15, 0, 8, hot)}
                  </g>
                </Golem>
              )}
            </g>
          ) : null}

          {particles.map((p, i) => {
            const fade = Math.min(1, p.life / Math.min(0.35, p.max))
            if (p.kind === "spark") {
              return <line key={i} x1={p.x} y1={p.y} x2={p.x - p.vx * 0.025} y2={p.y - p.vy * 0.025} stroke={p.color} strokeWidth={p.size} strokeLinecap="round" opacity={fade} />
            }
            if (p.kind === "plate") {
              const shape = p.shape ?? 0
              return (
                <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.size})`} opacity={fade}>
                  <polygon points={PLATE_SHAPES[shape]} fill={palette.ore} stroke={palette.oreDark} strokeWidth={2} />
                  <polygon points={PLATE_LIGHT[shape]} fill={palette.oreLight} opacity={0.75} />
                  <polygon points={PLATE_DARK[shape]} fill={palette.oreDark} opacity={0.7} />
                </g>
              )
            }
            if (p.kind === "chip" || p.kind === "shard") {
              const s = p.size
              return <polygon key={i} points={`0,${-s} ${s * 0.8},${s * 0.3} ${-s * 0.6},${s * 0.7}`} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`} fill={p.color} opacity={fade} />
            }
            if (p.kind === "dust") {
              const k = 1 - p.life / p.max
              return <circle key={i} cx={p.x} cy={p.y} r={p.size * (0.6 + k)} fill={p.color} opacity={(1 - k) * 0.35} />
            }
            if (p.kind === "ring") {
              const k = 1 - p.life / p.max
              return <circle key={i} cx={p.x} cy={p.y} r={p.size + k * 220} fill="none" stroke={p.color} strokeWidth={10 * (1 - k)} opacity={1 - k} />
            }
            return (
              <text key={i} x={p.x} y={p.y} className="clicker-hunt-pop" fill={p.color} fontSize={p.size} textAnchor="middle" opacity={fade}>
                {p.text}
              </text>
            )
          })}

          {beamEnd ? (
            <g className="clicker-hunt-beam" pointerEvents="none">
              <line x1={EMITTER.x} y1={EMITTER.y - 30} x2={beamEnd.x} y2={beamEnd.y} stroke={hot} strokeWidth={beamW * 5} strokeLinecap="round" opacity={0.22} />
              <line x1={EMITTER.x} y1={EMITTER.y - 30} x2={beamEnd.x} y2={beamEnd.y} stroke="#f4feff" strokeWidth={beamW} strokeLinecap="round" />
              <circle cx={beamEnd.x} cy={beamEnd.y} r={view.burning ? 16 + view.jitter.flare * 8 : 7} fill="#fffbe8" opacity={view.burning ? 0.95 : 0.5} />
              {view.burning ? <circle cx={beamEnd.x} cy={beamEnd.y} r={34 + view.jitter.beam * 10} fill={hot} opacity={0.3} /> : null}
            </g>
          ) : null}

          {/* Emitter turret swivels toward the aim. */}
          <g transform={`translate(${EMITTER.x} ${EMITTER.y})`} pointerEvents="none">
            <g transform={`rotate(${(beamAngle * 180) / Math.PI + 90})`}>
              <rect x={-9} y={-44} width={18} height={40} rx={5} fill="#1c2a3a" stroke={palette.bodyEdge} strokeWidth={2} />
              <rect x={-5} y={-48} width={10} height={8} rx={2} fill={view.firing ? "#f4feff" : palette.bodyEdge} />
            </g>
            <ellipse rx={46} ry={26} fill="#101a26" stroke={palette.bodyEdge} strokeWidth={2} />
          </g>
        </g>

        {/* HP bar floats over the monster; plate pips show the armor left. */}
        {hunt.phase !== "dying" ? (
          <g transform={`translate(${pos.x} ${Math.max(28, pos.y + bodyDy - def.hitRy - 34)})`} opacity={bodyOpacity} pointerEvents="none">
            <text y={-10} textAnchor="middle" className="clicker-hunt-name" fill={enraged ? palette.rage : "#e8f6ff"}>
              {def.name}
              {enraged ? " · 격노" : ""}
            </text>
            <rect x={-80} y={0} width={160} height={10} rx={5} fill="#000" opacity={0.6} />
            <rect x={-80} y={0} width={160 * hpShare} height={10} rx={5} fill={enraged ? palette.rage : palette.ore} />
            {Array.from({ length: def.plates }, (_, i) => (
              <rect key={i} x={-80 + i * (160 / def.plates) + 2} y={14} width={160 / def.plates - 4} height={5} rx={2} fill={i < def.plates - hunt.platesBroken ? palette.oreLight : "#333a48"} />
            ))}
          </g>
        ) : null}
      </svg>
      <p className="clicker-hunt-kills" aria-live="polite">
        처치 <strong>{hunt.kills}</strong> / {def.killTarget}
      </p>
      <p className="clicker-hunt-hint">누르고 있으면 레이저 · 괴물을 따라가며 조준 · Space 자동 조준</p>
    </div>
  )
}

type Palette = (typeof PALETTE)[MonsterKind]

/** Hot-body overlay: the body glows as the beam heats it, and flashes white on hits. */
function heatFill(palette: Palette, heat: number, flash: number, enraged: boolean) {
  return { color: flash > 0.05 ? "#ffffff" : enraged ? palette.rage : "#ffb46b", opacity: Math.max(flash * 0.85, heat * 0.28) }
}

function Specter({
  t,
  burnT,
  enraged,
  palette,
  heat,
  flash,
  children,
}: {
  t: number
  burnT: number
  enraged: boolean
  palette: Palette
  heat: number
  flash: number
  children: ReactNode
}) {
  const speed = enraged ? 4.2 : 2.2
  // Tentacles sway in a travelling wave; under the beam they curl up and thrash.
  const curl = Math.min(1, burnT * 2.5)
  const tentacles = [-60, -30, 0, 30, 60].map((x0, i) => {
    const amp = 22 + curl * 18
    const len = 118 - curl * 30 + Math.sin(t * 1.3 + i) * 6
    const w1 = Math.sin(t * speed + i * 0.9) * amp
    const w2 = Math.sin(t * speed + i * 0.9 + 1.4) * amp * 1.4
    return `M ${x0} 34 Q ${x0 + w1} ${34 + len * 0.5} ${x0 + w2 - x0 * 0.15 * curl} ${34 + len}`
  })
  const glow = heatFill(palette, heat, flash, enraged)
  const dome = "M -96 38 C -100 -96 100 -96 96 38 Q 72 54 48 40 Q 24 58 0 42 Q -24 58 -48 40 Q -72 54 -96 38 Z"
  return (
    <g>
      {tentacles.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={palette.bodyEdge} strokeOpacity={0.35} strokeWidth={14} strokeLinecap="round" />
          <path d={d} fill="none" stroke={palette.body} strokeWidth={8} strokeLinecap="round" />
        </g>
      ))}
      <path d={dome} fill={`url(#hunt-body-specter)`} stroke={palette.bodyEdge} strokeWidth={3} />
      <ellipse cx={0} cy={-22} rx={34} ry={26} fill={enraged ? palette.rage : palette.core} opacity={0.25 + 0.2 * Math.sin(t * (enraged ? 12 : 4)) + heat * 0.3} />
      <path d={dome} fill={glow.color} opacity={glow.opacity} />
      {children}
    </g>
  )
}

function Golem({
  pathT,
  moving,
  guard,
  enraged,
  palette,
  heat,
  flash,
  armL,
  armR,
  children,
}: {
  pathT: number
  moving: boolean
  guard: number
  enraged: boolean
  palette: Palette
  heat: number
  flash: number
  armL: ReactNode
  armR: ReactNode
  children: ReactNode
}) {
  const phase = moving ? pathT * Math.PI * 2 * 0.9 : 0
  const lift = (p: number) => Math.max(0, Math.sin(p)) * 22
  const stride = (p: number) => Math.cos(p) * 16
  const bob = -Math.abs(Math.sin(phase)) * 6
  // Arms swing against the legs; while burning they sweep across the chest and up to
  // shield the face (SVG rotate: a hanging arm at -120° points up and inward on the left).
  const swing = Math.sin(phase) * 14
  const armAngle = (side: 1 | -1) => (1 - guard) * swing * side + guard * 120 * side
  const glow = heatFill(palette, heat, flash, enraged)
  const torso = "M -78 -78 Q 0 -96 78 -78 L 70 62 Q 0 80 -70 62 Z"
  const leg = (side: 1 | -1, p: number) => (
    <g transform={`translate(${side * 40 + stride(p)} ${62 - lift(p)})`}>
      <rect x={-22} y={0} width={44} height={70} rx={12} fill={palette.body} stroke={palette.bodyEdge} strokeWidth={2.5} />
      <rect x={-28} y={62} width={56} height={24} rx={8} fill={palette.body} stroke={palette.bodyEdge} strokeWidth={2.5} />
    </g>
  )
  const arm = (side: 1 | -1, plates: ReactNode) => (
    <g transform={`translate(${side * 92} -58) rotate(${armAngle(side)})`}>
      <rect x={-20} y={-6} width={40} height={96} rx={16} fill={palette.body} stroke={palette.bodyEdge} strokeWidth={2.5} />
      <circle cx={0} cy={98} r={26} fill={palette.body} stroke={palette.bodyEdge} strokeWidth={2.5} />
      {plates}
    </g>
  )
  return (
    <g transform={`translate(0 ${bob})`}>
      {leg(-1, phase)}
      {leg(1, phase + Math.PI)}
      {arm(-1, armL)}
      <path d={torso} fill={`url(#hunt-body-golem)`} stroke={palette.bodyEdge} strokeWidth={3} />
      <polygon points="0,-34 16,-14 0,6 -16,-14" fill={enraged ? palette.rage : palette.core} opacity={0.55 + heat * 0.4} />
      <rect x={-38} y={-142} width={76} height={62} rx={18} fill={`url(#hunt-body-golem)`} stroke={palette.bodyEdge} strokeWidth={3} />
      <rect x={-30} y={-122} width={60} height={20} rx={9} fill="#0b0e16" />
      <path d={torso} fill={glow.color} opacity={glow.opacity} />
      {arm(1, armR)}
      {children}
    </g>
  )
}
