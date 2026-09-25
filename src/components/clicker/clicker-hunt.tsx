"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { MONSTER_ART } from "@/data/clicker/hunt-assets"
import {
  HUNT_HIT_PAYOUT,
  HUNT_MAX_ALIVE,
  HUNT_RESPAWN_MS,
  MONSTERS,
  pickMonster,
  type MonsterKind,
} from "@/domain/services/clicker-region-activity"
import type { MineStrikeResult } from "@/components/clicker/clicker-mine"
import "./clicker-mine.css"
import "./clicker-hunt.css"

type Monster = {
  id: number
  kind: MonsterKind
  /** Center, as fractions of the arena. */
  x: number
  y: number
  dir: 1 | -1
  hp: number
  bornAt: number
  /** Last 30% of its life — blinks before escaping. */
  fleeing?: boolean
  /** Set when killed or escaped; the sprite plays out before removal. */
  gone?: "slain" | "fled"
  goneAt?: number
}

type Shot = { id: number; x1: number; y1: number; x2: number; y2: number; critical: boolean }

type Props = {
  /** Region backdrop. */
  bg: string
  visual?: "idle" | "fever" | "crisis"
  muted: boolean
  /** One strike worth `payout` units at a screen point. */
  onHit: (clientX: number, clientY: number, payout: number) => MineStrikeResult
  onSlain: (kind: MonsterKind, clientX: number, clientY: number) => void
  playLaser: (muted: boolean, critical: boolean) => void
  /** Assist-drill strikes per second — plain strikes, as in every region. */
  autoRate?: number
  onDrill?: (clientX: number, clientY: number) => void
}

const FADE_MS = 360
/** Preferred spacing between monster centers (arena fractions, y weighted for the wide arena). */
const MIN_GAP = 0.22
/** Spawns stay inside this band so sprites and HP bars never clip the HUD. */
const BAND = { x0: 0.14, x1: 0.86, y0: 0.24, y1: 0.66 }

/** Signal Relay session: tap monsters down before they slip away; kills pay the bounty. */
export function ClickerHunt({ bg, visual = "idle", muted, onHit, onSlain, playLaser, autoRate = 0, onDrill }: Props) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const [monsters, setMonsters] = useState<Monster[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [hitSeq, setHitSeq] = useState<Record<number, number>>({})
  /** Source of truth for the arena; taps and the loop both read and write it synchronously. */
  const live = useRef<Monster[]>([])
  const seq = useRef(0)
  const timers = useRef<number[]>([])
  const reduceMotion = useRef(false)

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const commit = (next: Monster[]) => {
    live.current = next
    setMonsters(next)
  }

  /** New monster at the free spot farthest from those on the field (best of a few rolls). */
  const spawn = useCallback((now: number, field: Monster[] = []): Monster => {
    const kind = pickMonster(Math.random())
    const others = field.filter((m) => !m.gone)
    let best = { x: 0.5, y: 0.45, gap: -1 }
    for (let i = 0; i < 6; i++) {
      const x = BAND.x0 + Math.random() * (BAND.x1 - BAND.x0)
      const y = BAND.y0 + Math.random() * (BAND.y1 - BAND.y0)
      const gap = others.length ? Math.min(...others.map((m) => Math.hypot(m.x - x, (m.y - y) * 1.6))) : 1
      if (gap > best.gap) best = { x, y, gap }
      if (gap >= MIN_GAP) break
    }
    return {
      id: ++seq.current,
      kind,
      x: best.x,
      y: best.y,
      dir: Math.random() < 0.5 ? 1 : -1,
      hp: MONSTERS[kind].hp,
      bornAt: now,
    }
  }, [])

  // Drift, escapes, exits and refills — one loop for the whole arena.
  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let last = 0
    let slotFreeSince = 0
    const step = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0
      last = t
      const now = Date.now()
      // Open with two on the field.
      let next = live.current
      if (next.length === 0 && seq.current === 0) {
        const first = spawn(now)
        next = [first, spawn(now, [first])]
      }
      next = next
        .filter((m) => !m.gone || now - (m.goneAt ?? now) < FADE_MS)
        .map((m) => {
          if (m.gone) return m
          const def = MONSTERS[m.kind]
          const age = now - m.bornAt
          if (age > def.lifeMs) return { ...m, gone: "fled" as const, goneAt: now }
          const fleeing = age > def.lifeMs * 0.7
          if (!def.speed || reduceMotion.current) return fleeing === m.fleeing ? m : { ...m, fleeing }
          let x = m.x + def.speed * m.dir * dt
          let dir = m.dir
          if (x < BAND.x0 || x > BAND.x1) {
            dir = (dir * -1) as 1 | -1
            x = Math.min(BAND.x1, Math.max(BAND.x0, x))
          }
          return { ...m, x, dir, fleeing }
        })
      if (next.filter((m) => !m.gone).length < HUNT_MAX_ALIVE) {
        slotFreeSince ||= now
        if (now - slotFreeSince >= HUNT_RESPAWN_MS) {
          slotFreeSince = 0
          next = [...next, spawn(now, next)]
        }
      } else {
        slotFreeSince = 0
      }
      const changed = next.length !== live.current.length || next.some((m, i) => m !== live.current[i])
      if (changed) {
        live.current = next
        setMonsters(next)
      }
      raf = window.requestAnimationFrame(step)
    }
    raf = window.requestAnimationFrame(step)
    const pending = timers.current
    return () => {
      window.cancelAnimationFrame(raf)
      for (const t of pending) window.clearTimeout(t)
    }
  }, [spawn])

  useEffect(() => {
    if (autoRate <= 0 || !onDrill) return
    const id = window.setInterval(() => {
      const rect = arenaRef.current?.getBoundingClientRect()
      if (!rect) return
      onDrill(rect.left + rect.width * (0.3 + Math.random() * 0.4), rect.top + rect.height * (0.3 + Math.random() * 0.3))
    }, 1000 / autoRate)
    return () => window.clearInterval(id)
  }, [autoRate, onDrill])

  const fire = (x: number, y: number, critical: boolean) => {
    const el = arenaRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const id = ++seq.current
    const side = id % 2 === 0 ? -1 : 1
    setShots((prev) => [
      ...prev.slice(-5),
      { id, x1: width / 2 + side * width * 0.06, y1: height + 8, x2: x, y2: y, critical },
    ])
    later(() => setShots((prev) => prev.filter((s) => s.id !== id)), reduceMotion.current ? 80 : 200)
  }

  const strike = (id: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    const m = live.current.find((x) => x.id === id)
    if (e.button !== 0 || !m || m.gone) return
    e.preventDefault()
    e.stopPropagation()
    const el = arenaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const { critical } = onHit(e.clientX, e.clientY, HUNT_HIT_PAYOUT)
    playLaser(muted, critical)
    fire(e.clientX - rect.left, e.clientY - rect.top, critical)
    setHitSeq((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    const hp = Math.max(0, m.hp - (critical ? 2 : 1))
    const slain = hp === 0
    commit(
      live.current.map((x) =>
        x.id === id ? { ...x, hp, ...(slain ? { gone: "slain" as const, goneAt: Date.now() } : {}) } : x,
      ),
    )
    if (slain) onSlain(m.kind, e.clientX, e.clientY)
  }

  return (
    <div ref={arenaRef} data-visual={visual} className="clicker-hunt">
      <div className="clicker-activity-plate" style={{ backgroundImage: `url(${bg})` }} aria-hidden />
      {monsters.map((m) => {
        const def = MONSTERS[m.kind]
        const art = MONSTER_ART[m.kind]
        return (
          <button
            key={m.id}
            type="button"
            className={`clicker-hunt-monster is-${m.kind}${m.gone ? ` is-${m.gone}` : ""}${m.fleeing && !m.gone ? " is-fleeing" : ""}`}
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, "--flip": m.dir } as CSSProperties}
            aria-label={`${def.name} · 체력 ${m.hp}/${def.hp}`}
            disabled={Boolean(m.gone)}
            onPointerDown={strike(m.id)}
          >
            <span key={hitSeq[m.id] ?? 0} className={`clicker-hunt-body${hitSeq[m.id] ? " is-hit" : ""}`}>
              {art ? <img src={art} alt="" draggable={false} /> : <i className="clicker-hunt-fallback" aria-hidden />}
            </span>
            <span className="clicker-hunt-hp" aria-hidden>
              <i style={{ width: `${(m.hp / def.hp) * 100}%` }} />
            </span>
          </button>
        )
      })}

      <svg className="clicker-mine-lasers" aria-hidden>
        {shots.map((s) => (
          <g key={s.id} className={`clicker-mine-beam${s.critical ? " is-crit" : ""}`}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="clicker-mine-beam-glow" />
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="clicker-mine-beam-core" />
          </g>
        ))}
      </svg>
      <p className="clicker-hunt-hint" aria-hidden>
        몬스터를 탭해 처치 · 처치 시 현상금
      </p>
      {autoRate > 0 ? <span className="clicker-mine-drill-tag">보조 드릴 · {autoRate}/s</span> : null}
    </div>
  )
}
