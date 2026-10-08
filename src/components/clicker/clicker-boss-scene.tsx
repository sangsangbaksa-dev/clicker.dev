"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import { playSfx } from "@/lib/clicker-sfx"
import { formatNumber } from "@/application/clicker-ui"
import { ClickerHpBar } from "@/components/clicker/clicker-hpbar"
import "./clicker-boss-scene.css"

/*
 * Lair bosses are painted INTO their scene (Canva, portrait): the dragon coiled round the
 * spire, the titan grown out of the vault, the behemoth climbing from the chasm. The scene
 * is a living painting: the monster's region is a second, masked copy of the art that
 * breathes, lunges and flinches independently of the backdrop, its eyes burn, and each
 * scene has its own weather (storm lightning + fog, drifting crystal motes, rising embers).
 *
 * Each scene comes in two cuts: the portrait painting for phones and other tall stages, and a
 * 16:9 cut for computers (the same painting extended sideways), so the monster always fills the
 * stage edge to edge. Coordinates are percentages of the portrait painting; the wide cut keeps
 * its full height and centres it, so they map across by `wide.scale`.
 */
type Pt = { x: number; y: number }
type SceneDef = {
  src: string
  /** The 16:9 cut: its file, and the portrait painting's width as a share of it. */
  wide: { src: string; scale: number }
  /** Monster body: hitbox and the centre of the breathing mask. */
  body: { x: number; y: number; w: number; h: number }
  eyes: Pt[]
  /** Where the attack lands / erupts from. */
  strike: Pt
  weather: "storm" | "crystal" | "lava"
  tint: string
  attackSfx: "dragonBreath" | "bossSmash"
  /** Extra idle motion: flyers sway, walkers heave. */
  sway: "wings" | "heave"
}

export const BOSS_SCENES: Record<string, SceneDef> = {
  stormbird: {
    src: "/clicker/boss/storm_spire.webp",
    wide: { src: "/clicker/boss/storm_spire_wide.webp", scale: 0.3748 },
    body: { x: 50, y: 30, w: 98, h: 56 },
    eyes: [{ x: 44.1, y: 23 }, { x: 52.6, y: 23 }],
    strike: { x: 48.8, y: 30 },
    weather: "storm",
    tint: "120 220 255",
    attackSfx: "dragonBreath",
    sway: "wings",
  },
  golem: {
    src: "/clicker/boss/phase_vault.webp",
    wide: { src: "/clicker/boss/phase_vault_wide.webp", scale: 0.3748 },
    body: { x: 52, y: 37, w: 94, h: 62 },
    eyes: [{ x: 49.5, y: 20.6 }, { x: 56.7, y: 21.1 }],
    strike: { x: 50, y: 80 },
    weather: "crystal",
    tint: "80 245 225",
    attackSfx: "bossSmash",
    sway: "heave",
  },
  worm: {
    src: "/clicker/boss/deep_fault.webp",
    wide: { src: "/clicker/boss/deep_fault_wide.webp", scale: 0.374 },
    body: { x: 52, y: 40, w: 80, h: 72 },
    eyes: [{ x: 45, y: 12 }, { x: 52, y: 12 }],
    strike: { x: 50, y: 82 },
    weather: "lava",
    tint: "255 130 40",
    attackSfx: "bossSmash",
    sway: "heave",
  },
}

const ATTACK_EVERY_MS = 4200
/** How far below the eye line (% of the art's height) a wide stage centres the camera. */
const FRAME_BELOW_EYES = 8

/** Anticipation (rear up), strike, recover — the strike beat lands when the engine deals damage. */
const WINDUP_MS = 1100
const STRIKE_MS = 900

type Props = {
  kind: string
  name: string
  alive: boolean
  battle?: { bossHp: number; bossMaxHp: number; nextAttackAt: number } | null
  shieldMs?: number
  tauntKey?: number
  onEnter: () => void
  onStrike: (clientX: number, clientY: number) => boolean
}

/** Portrait-painting coordinates placed on the wide cut (same height, centred). */
function toWide(p: Pt, scale: number): Pt {
  return { x: 50 + (p.x - 50) * scale, y: p.y }
}

/** True while the stage is wider than tall — the computer layout. */
function useWideStage(ref: RefObject<HTMLDivElement | null>): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setWide(el.clientWidth >= el.clientHeight)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return wide
}

export function ClickerBossScene({ kind, name, alive, battle, shieldMs = 0, tauntKey = 0, onEnter, onStrike }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wide = useWideStage(rootRef)
  const portrait = BOSS_SCENES[kind]
  const scene: SceneDef | undefined = portrait && wide
    ? {
        ...portrait,
        src: portrait.wide.src,
        body: { ...toWide(portrait.body, portrait.wide.scale), w: portrait.body.w * portrait.wide.scale, h: portrait.body.h },
        eyes: portrait.eyes.map((e) => toWide(e, portrait.wide.scale)),
        strike: toWide(portrait.strike, portrait.wide.scale),
      }
    : portrait
  const [phase, setPhase] = useState<"idle" | "windup" | "strike">("idle")
  const [hitKey, setHitKey] = useState(0)
  const [dying, setDying] = useState(false)
  const [taunting, setTaunting] = useState(false)
  /** Spark bursts at the exact tap points (removed after their animation). */
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number }>>([])
  const sparkId = useRef(0)
  const shielded = shieldMs > 0 && !battle
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // One attack: growl + rear up, then the strike lands with its sound and particles.
  const swing = useRef<() => void>(() => {})
  const attackSfx = scene?.attackSfx ?? "bossSmash"
  useEffect(() => {
    swing.current = () => {
      setPhase("windup")
      playSfx("bossGrowl")
      later(() => {
        setPhase("strike")
        playSfx(attackSfx)
      }, WINDUP_MS)
      later(() => setPhase("idle"), WINDUP_MS + STRIKE_MS)
    }
  })
  // In battle the strike beat is timed to the engine's damage; outside it the boss just menaces.
  const nextAttackAt = battle?.nextAttackAt
  useEffect(() => {
    if (!nextAttackAt) return
    const id = window.setTimeout(() => swing.current(), Math.max(0, nextAttackAt - WINDUP_MS - Date.now()))
    return () => window.clearTimeout(id)
  }, [nextAttackAt])
  const inBattle = Boolean(battle)
  useEffect(() => {
    if (!alive || inBattle) return
    const id = window.setInterval(() => swing.current(), ATTACK_EVERY_MS * 2)
    return () => window.clearInterval(id)
  }, [alive, inBattle])

  useEffect(() => {
    if (!tauntKey) return
    setTaunting(true)
    playSfx("bossRoar")
    const id = window.setTimeout(() => setTaunting(false), 1800)
    return () => window.clearTimeout(id)
  }, [tauntKey])

  if (!scene) return <div ref={rootRef} className="clicker-boss-scene" />
  const tap = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || dying) return
    e.preventDefault()
    e.stopPropagation()
    if (!battle) {
      if (shielded || !alive) playSfx("deny")
      onEnter()
      return
    }
    setHitKey((k) => k + 1)
    const box = e.currentTarget.getBoundingClientRect()
    const id = ++sparkId.current
    setSparks((list) => [...list.slice(-5), { id, x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 }])
    later(() => setSparks((list) => list.filter((sp) => sp.id !== id)), 460)
    if (onStrike(e.clientX, e.clientY)) {
      playSfx("bossDeath")
      setDying(true)
      later(() => setDying(false), 2400)
    } else {
      playSfx("bossHurt")
    }
  }

  const b = scene.body
  // Camera target on a wide stage: just below the eye line, so the head is always in frame.
  const eyeY = scene.eyes.reduce((sum, e) => sum + e.y, 0) / Math.max(1, scene.eyes.length)
  const vars = {
    "--bx": `${b.x}%`,
    "--by": `${b.y}%`,
    "--byn": Math.min(b.y, eyeY + FRAME_BELOW_EYES) / 100,
    "--bw": `${b.w}%`,
    "--bh": `${b.h}%`,
    "--tint": scene.tint,
  } as CSSProperties
  const state = [
    `is-${scene.weather}`,
    `sway-${scene.sway}`,
    phase !== "idle" ? `is-${phase}` : "",
    dying ? "is-dying" : "",
    !alive && !dying ? "is-dormant" : "",
    shielded ? "is-shielded" : "",
    taunting ? "is-taunting" : "",
    battle ? "is-battle" : "",
    // Under 30% HP the guardian enrages: red pulse, so the last stretch feels like a finish.
    battle && battle.bossHp / Math.max(1, battle.bossMaxHp) < 0.3 ? "is-enraged" : "",
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <div ref={rootRef} className={`clicker-boss-scene ${wide ? "is-wide" : "is-tall"} ${state}`} style={vars}>
      {/* Hits alternate between two identical animations so each tap restarts it without remounting the art. */}
      <div className={`boss-scene-box${hitKey ? ` hit-${hitKey % 2}` : ""}`}>
        {/* The whole painting moves as one picture — no masked second copy sliding over a still
            backdrop, which doubled and smeared the outline. Three nested layers so nothing
            snaps: the rig loops a slow breath forever, the pose eases between rest / wind-up /
            strike / collapse, the flesh shakes under hits. The eyes ride inside. */}
        <div className="boss-scene-rig">
          <div className="boss-scene-pose">
            <div className="boss-scene-flesh">
              <img className="boss-scene-base" src={scene.src} alt="" draggable={false} decoding="async" />
              {scene.eyes.map((p, i) => (
                <span key={i} className="boss-scene-eye" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden />
              ))}
            </div>
          </div>
        </div>
        <div className="boss-scene-weather" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        {phase === "strike" ? (
          <span className="boss-scene-impact" style={{ left: `${scene.strike.x}%`, top: `${scene.strike.y}%` }} aria-hidden>
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        ) : null}
        {sparks.map((sp) => (
          <span key={sp.id} className="boss-scene-spark" style={{ left: `${sp.x}%`, top: `${sp.y}%` }} aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        ))}
        {dying ? <span className="boss-scene-killflash" aria-hidden /> : null}
        {shielded ? (
          <span className="boss-scene-shield" aria-hidden>
            <b>
              보호막 {Math.floor(Math.ceil(shieldMs / 1000) / 60)}:{String(Math.ceil(shieldMs / 1000) % 60).padStart(2, "0")}
            </b>
          </span>
        ) : null}
        <button
          type="button"
          data-sfx="off"
          className="boss-scene-hitbox"
          aria-label={battle ? `${name} 공격` : shielded ? `${name} · 보호막` : `${name} 토벌하러 들어가기`}
          onPointerDown={tap}
        />
      </div>
      {battle ? (
        <div className="boss-scene-hp">
          <ClickerHpBar
            tone="boss"
            value={battle.bossHp}
            max={battle.bossMaxHp}
            label={name}
            valueText={`${formatNumber(Math.max(0, battle.bossHp))} / ${formatNumber(battle.bossMaxHp)}`}
            ariaLabel={`${name} 체력 ${battle.bossHp}/${battle.bossMaxHp}`}
          />
        </div>
      ) : null}
    </div>
  )
}
