"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { playSfx } from "./clicker-sfx"
import "./clicker-boss-scene.css"

/*
 * Lair bosses are painted INTO their scene (Canva, portrait): the dragon coiled round the
 * spire, the titan grown out of the vault, the behemoth climbing from the chasm. The scene
 * is a living painting: the monster's region is a second, masked copy of the art that
 * breathes, lunges and flinches independently of the backdrop, its eyes burn, and each
 * scene has its own weather (storm lightning + fog, drifting crystal motes, rising embers).
 *
 * Coordinates are percentages of the 9:16 scene box.
 */
type Pt = { x: number; y: number }
type SceneDef = {
  src: string
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
    body: { x: 50, y: 30, w: 96, h: 54 },
    eyes: [{ x: 46, y: 15 }, { x: 53, y: 15 }],
    strike: { x: 50, y: 70 },
    weather: "storm",
    tint: "120 220 255",
    attackSfx: "dragonBreath",
    sway: "wings",
  },
  golem: {
    src: "/clicker/boss/phase_vault.webp",
    body: { x: 50, y: 38, w: 92, h: 60 },
    eyes: [{ x: 48, y: 16 }, { x: 56, y: 16 }],
    strike: { x: 50, y: 80 },
    weather: "crystal",
    tint: "80 245 225",
    attackSfx: "bossSmash",
    sway: "heave",
  },
  worm: {
    src: "/clicker/boss/deep_fault.webp",
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

export function ClickerBossScene({ kind, name, alive, battle, shieldMs = 0, tauntKey = 0, onEnter, onStrike }: Props) {
  const scene = BOSS_SCENES[kind]
  const [phase, setPhase] = useState<"idle" | "windup" | "strike">("idle")
  const [hitKey, setHitKey] = useState(0)
  const [dying, setDying] = useState(false)
  const [taunting, setTaunting] = useState(false)
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

  if (!scene) return null
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
    if (onStrike(e.clientX, e.clientY)) {
      playSfx("bossDeath")
      setDying(true)
      later(() => setDying(false), 2400)
    } else {
      playSfx("bossHurt")
    }
  }

  const b = scene.body
  const vars = {
    "--bx": `${b.x}%`,
    "--by": `${b.y}%`,
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
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <div className={`clicker-boss-scene ${state}`} style={vars}>
      {/* Hits alternate between two identical animations so each tap restarts it without remounting the art. */}
      <div className={`boss-scene-box${hitKey ? ` hit-${hitKey % 2}` : ""}`}>
        <img className="boss-scene-base" src={scene.src} alt="" draggable={false} />
        {/* The monster: same painting, masked to its body, animated on its own. */}
        {/* The rig carries the never-interrupted idle motion; attacks and flinches ease on top of it. */}
        <div className="boss-scene-rig">
          <img className="boss-scene-body" src={scene.src} alt="" draggable={false} />
        </div>
        <div className="boss-scene-weather" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        {scene.eyes.map((p, i) => (
          <span key={i} className="boss-scene-eye" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden />
        ))}
        {phase === "strike" ? (
          <span className="boss-scene-impact" style={{ left: `${scene.strike.x}%`, top: `${scene.strike.y}%` }} aria-hidden>
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
        ) : null}
        {shielded ? (
          <span className="boss-scene-shield" aria-hidden>
            <b>
              🛡 {Math.floor(Math.ceil(shieldMs / 1000) / 60)}:{String(Math.ceil(shieldMs / 1000) % 60).padStart(2, "0")}
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
        <div className="boss-scene-hp" aria-label={`${name} 체력 ${battle.bossHp}/${battle.bossMaxHp}`}>
          <i style={{ width: `${(battle.bossHp / battle.bossMaxHp) * 100}%` }} />
          <span>{name}</span>
        </div>
      ) : null}
    </div>
  )
}
