"use client"

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import { clickerFramedBossScene, sceneCameraY, weatherMotes } from "@/application/clicker-stage"
import { playSfx } from "@/lib/clicker-sfx"
import { formatNumber } from "@/application/clicker-ui"
import { ClickerHpBar } from "@/components/clicker/clicker-hpbar"
import "./clicker-boss-scene.css"

/*
 * Lair bosses and the core guardian are painted into their scene. Which plate, where the
 * body sits, and which cue fires are catalog data; framing that plate onto a wide stage
 * is a domain rule. This view only breathes, lunges, and spills the weather it was given.
 */

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
  /** The guardian fight draws its own bars, so the scene can stay a painting. */
  showHp?: boolean
  onEnter: () => void
  onStrike: (clientX: number, clientY: number) => boolean
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

export function ClickerBossScene({ kind, name, alive, battle, shieldMs = 0, tauntKey = 0, showHp = true, onEnter, onStrike }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wide = useWideStage(rootRef)
  const scene = clickerFramedBossScene(kind, wide)
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
      playSfx(scene.hurtSfx)
    }
  }

  const b = scene.body
  // Camera target on a wide stage: just below the eye line, so the head is always in frame.
  const vars = {
    "--bx": `${b.x}%`,
    "--by": `${b.y}%`,
    "--byn": sceneCameraY(b.y, scene.eyes.map((eye) => eye.y), scene.strike.y, FRAME_BELOW_EYES),
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
          {scene.weather === "storm"
            ? Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)
            : weatherMotes(scene.weather).map((mote, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--i": i,
                      left: mote.left,
                      "--dur": mote.duration,
                      "--delay": mote.delay,
                      "--drift": mote.drift,
                    } as CSSProperties
                  }
                />
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
      {showHp && battle ? (
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
