"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { RegionChallengeKind } from "@/domain/entities/clicker"
import { playChallengeCue } from "@/components/clicker/clicker-sfx"
import "./clicker-region-challenge.css"

type Props = {
  kind: RegionChallengeKind
  name: string
  description: string
  durationSec: number
  muted: boolean
  /** Final score 0..1 — the parent claims the reward. */
  onFinish: (score: number) => void
  /** Closed before play started: nothing is claimed and no cooldown starts. */
  onCancel: () => void
}

type Phase = "countdown" | "play" | "done"

const COUNTDOWN_MS = 3000

type GameProps = {
  /** ms since play started (frozen once time is up). */
  elapsed: number
  playing: boolean
  hits: number
  onHit: () => void
  onMiss: () => void
}

/** Targets presented so far for each game; misses (wrong taps / cracks) cost half an attempt. */
function attempts(kind: RegionChallengeKind, elapsed: number, hits: number, misses: number): number {
  if (kind === "ROD_STRIKE") return Math.max(0, Math.floor((elapsed - ROD_FIRST_MS) / ROD_EVERY_MS) + 1) + misses * 0.5
  if (kind === "FAULT_DRILL") return Math.max(DRILL_TARGET, hits) + misses * 0.5
  return Math.max(0, Math.floor((elapsed - DRONE_FIRST_MS) / DRONE_EVERY_MS) + 1)
}

/**
 * Full-screen timed mini-game for a region's field challenge: 3 s countdown, play, result.
 * Leaving mid-play settles with the score so far, so a bad run can't be dodged for free.
 */
export function ClickerRegionChallenge({ kind, name, description, durationSec, muted, onFinish, onCancel }: Props) {
  const [clock, setClock] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const durationMs = durationSec * 1000
  const phase: Phase = clock < COUNTDOWN_MS ? "countdown" : clock < COUNTDOWN_MS + durationMs ? "play" : "done"

  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const loop = () => {
      const t = performance.now() - t0
      setClock(t)
      if (t >= COUNTDOWN_MS + durationMs) {
        playChallengeCue(muted, "done")
        return
      }
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [durationMs, muted])

  const elapsed = Math.min(durationMs, Math.max(0, clock - COUNTDOWN_MS))
  const left = durationMs - elapsed
  const tries = attempts(kind, elapsed, hits, misses)
  const score = tries > 0 ? Math.min(1, Math.min(hits, kind === "FAULT_DRILL" ? DRILL_TARGET : hits) / tries) : 0
  const pct = Math.round(score * 100)

  const close = () => {
    if (phase === "countdown") onCancel()
    else onFinish(score)
  }
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      closeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const gameProps: GameProps = {
    elapsed,
    playing: phase === "play",
    hits,
    onHit: () => {
      setHits((n) => n + 1)
      playChallengeCue(muted, "hit")
    },
    onMiss: () => {
      setMisses((n) => n + 1)
      playChallengeCue(muted, "miss")
    },
  }

  return (
    <div className={`clicker-challenge is-${kind.toLowerCase()}`} role="dialog" aria-modal="true" aria-label={name}>
      <header className="clicker-challenge-head">
        <div>
          <p className="clicker-challenge-kicker">FIELD CHALLENGE</p>
          <h2>{name}</h2>
          <p className="clicker-challenge-desc">{description}</p>
        </div>
        <div className="clicker-challenge-stats" role="status" aria-live="off">
          <span>
            남은 시간 <strong>{(left / 1000).toFixed(1)}s</strong>
          </span>
          <span>
            성공률 <strong>{pct}%</strong>
          </span>
        </div>
      </header>
      <div className="clicker-challenge-bar" aria-hidden>
        <i style={{ width: `${(left / durationMs) * 100}%` }} />
      </div>

      <div className="clicker-challenge-field">
        {kind === "ROD_STRIKE" ? <RodStrike {...gameProps} /> : null}
        {kind === "FAULT_DRILL" ? <FaultDrill {...gameProps} misses={misses} /> : null}
        {kind === "DRONE_RECALL" ? <DroneRecall {...gameProps} /> : null}
        {phase === "countdown" ? (
          <div className="clicker-challenge-countdown" aria-live="assertive">
            {/* Keyed so each new number punches in. */}
            <span key={Math.ceil((COUNTDOWN_MS - clock) / 1000)}>
              {Math.max(1, Math.ceil((COUNTDOWN_MS - clock) / 1000))}
            </span>
          </div>
        ) : null}
        {phase === "done" ? (
          <div className="clicker-challenge-result">
            <p>도전 종료</p>
            <strong>{pct}%</strong>
            <span>
              성공 {hits} · 실수 {misses}
            </span>
            <button type="button" className="clicker-primary" autoFocus onClick={() => onFinish(score)}>
              보상 받기
            </button>
          </div>
        ) : null}
      </div>

      {phase !== "done" ? (
        <button type="button" className="clicker-challenge-quit" onClick={close}>
          {phase === "countdown" ? "취소 · Esc" : "여기서 끝내기 · Esc"}
        </button>
      ) : null}
    </div>
  )
}

/** Random layout fixed for the whole run (lazy state init runs once). */
function useSchedule<T>(make: () => T[]): T[] {
  const [items] = useState(make)
  return items
}

/** Brief hit/miss flash keyed to the play clock. */
type Flash = { key: number; ok: boolean; at: number }
const FLASH_MS = 260

/* ---------- Storm Spire: catch the charged rod before lightning lands ---------- */

const ROD_COUNT = 5
const ROD_FIRST_MS = 300
const ROD_EVERY_MS = 850
const ROD_WINDOW_MS = 800

function RodStrike({ elapsed, playing, onHit, onMiss }: GameProps) {
  const charges = useSchedule(() => {
    const out: number[] = []
    let prev = -1
    for (let i = 0; i < 40; i++) {
      let rod = Math.floor(Math.random() * ROD_COUNT)
      if (rod === prev) rod = (rod + 1 + Math.floor(Math.random() * (ROD_COUNT - 1))) % ROD_COUNT
      out.push(rod)
      prev = rod
    }
    return out
  })
  const [caught, setCaught] = useState<ReadonlySet<number>>(() => new Set())
  const [flash, setFlash] = useState<Flash | null>(null)

  const index = Math.floor((elapsed - ROD_FIRST_MS) / ROD_EVERY_MS)
  const start = ROD_FIRST_MS + index * ROD_EVERY_MS
  const live = playing && index >= 0 && elapsed - start < ROD_WINDOW_MS && !caught.has(index) ? index : -1

  const tap = (rod: number) => {
    if (!playing) return
    if (live >= 0 && charges[live] === rod) {
      setCaught(new Set(caught).add(live))
      onHit()
      setFlash({ key: rod, ok: true, at: elapsed })
    } else {
      onMiss()
      setFlash({ key: rod, ok: false, at: elapsed })
    }
  }

  // Keys 1–5 strike rods left to right.
  const tapRef = useRef(tap)
  useEffect(() => {
    tapRef.current = tap
  })
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      const rod = Number(e.key) - 1
      if (e.repeat || !Number.isInteger(rod) || rod < 0 || rod >= ROD_COUNT) return
      e.preventDefault()
      tapRef.current(rod)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [playing])

  return (
    <div className="clicker-rods">
      {Array.from({ length: ROD_COUNT }, (_, rod) => {
        const charged = live >= 0 && charges[live] === rod
        const remain = charged ? 1 - (elapsed - start) / ROD_WINDOW_MS : 0
        const fx = flash && flash.key === rod && elapsed - flash.at < FLASH_MS ? (flash.ok ? " is-hit" : " is-miss") : ""
        return (
          <button
            key={rod}
            type="button"
            className={`clicker-rod${charged ? " is-charged" : ""}${fx}`}
            style={{ "--remain": remain } as CSSProperties}
            aria-label={`피뢰침 ${rod + 1}${charged ? " · 충전됨" : ""}`}
            aria-keyshortcuts={String(rod + 1)}
            onPointerDown={(e) => {
              e.preventDefault()
              tap(rod)
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              if (!e.repeat) tap(rod)
            }}
          >
            <span className="clicker-rod-tip" />
            <span className="clicker-rod-mast" />
            <span className="clicker-rod-key" aria-hidden>
              {rod + 1}
            </span>
            {/* Caught: the bolt lands on the rod instead of the ground. */}
            {fx === " is-hit" && flash ? <span key={flash.at} className="clicker-rod-bolt" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Deep Fault: drill while the pressure needle is in the green band ---------- */

const DRILL_TARGET = 10

function FaultDrill({ elapsed, playing, hits, misses, onHit, onMiss }: GameProps & { misses: number }) {
  const [band, setBand] = useState(0.5)
  const [flash, setFlash] = useState<Flash | null>(null)
  const width = Math.max(0.08, 0.3 - hits * 0.022)
  const speed = 1.6 + hits * 0.22
  const needle = (Math.sin((elapsed / 1000) * speed * Math.PI) + 1) / 2

  const drill = () => {
    if (!playing) return
    const ok = Math.abs(needle - band) <= width / 2
    if (ok) {
      setBand(0.2 + Math.random() * 0.6)
      onHit()
    } else {
      onMiss()
    }
    // key = needle position (0..1000) so the hit spark lands where the needle was.
    setFlash({ key: Math.round(needle * 1000), ok, at: elapsed })
  }
  const drillRef = useRef(drill)
  useEffect(() => {
    drillRef.current = drill
  })
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return
      e.preventDefault()
      drillRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [playing])

  const fx = flash && elapsed - flash.at < FLASH_MS ? (flash.ok ? " is-hit" : " is-miss") : ""
  return (
    <div className={`clicker-drill${fx}`}>
      <div className="clicker-drill-gauge" aria-hidden>
        <i className="clicker-drill-band" style={{ left: `${(band - width / 2) * 100}%`, width: `${width * 100}%` }} />
        <b className="clicker-drill-needle" style={{ left: `${needle * 100}%` }} />
        {fx && flash ? (
          <i
            key={flash.at}
            className={`clicker-drill-spark${flash.ok ? "" : " is-miss"}`}
            style={{ left: `${flash.key / 10}%` }}
          />
        ) : null}
      </div>
      <p className="clicker-drill-depth">
        깊이 <strong>{Math.min(hits, DRILL_TARGET)}</strong> / {DRILL_TARGET} · 균열 {misses}
      </p>
      <div className="clicker-drill-shaft" aria-hidden>
        {Array.from({ length: DRILL_TARGET }, (_, i) => (
          <span
            key={i}
            className={
              i < hits ? (i === hits - 1 && fx === " is-hit" ? "is-dug is-new" : "is-dug") : ""
            }
          />
        ))}
      </div>
      <button
        type="button"
        className="clicker-primary clicker-drill-btn"
        disabled={!playing}
        onPointerDown={(e) => {
          e.preventDefault()
          drill()
        }}
      >
        시추 · Space
      </button>
    </div>
  )
}

/* ---------- Drone Foundry: tap drones as they cross the hangar ---------- */

const DRONE_FIRST_MS = 200
const DRONE_EVERY_MS = 650
const DRONE_FLIGHT_MS = 2400
const DRONE_POP_MS = 520

type Drone = { lane: number; ltr: boolean }

function DroneRecall({ elapsed, playing, onHit }: GameProps) {
  const drones = useSchedule<Drone>(() =>
    Array.from({ length: 40 }, () => ({ lane: 0.1 + Math.random() * 0.72, ltr: Math.random() < 0.5 })),
  )
  const [caught, setCaught] = useState<ReadonlySet<number>>(() => new Set())
  const [pops, setPops] = useState<{ id: number; x: number; y: number; at: number }[]>([])

  return (
    <div className="clicker-hangar">
      {pops
        .filter((pop) => elapsed - pop.at < DRONE_POP_MS)
        .map((pop) => (
          <span
            key={pop.id}
            className="clicker-drone-pop"
            style={{ left: `${pop.x}%`, top: `${pop.y}%` }}
            aria-hidden
          >
            <b>+1</b>
          </span>
        ))}
      {drones.map((d, i) => {
        const p = (elapsed - (DRONE_FIRST_MS + i * DRONE_EVERY_MS)) / DRONE_FLIGHT_MS
        if (p < 0 || p > 1 || caught.has(i)) return null
        const x = d.ltr ? p : 1 - p
        const recall = () => {
          if (!playing) return
          setCaught(new Set(caught).add(i))
          setPops((prev) => [...prev.slice(-5), { id: i, x: x * 92 + 4, y: d.lane * 100, at: elapsed }])
          onHit()
        }
        return (
          <button
            key={i}
            type="button"
            className={`clicker-drone${d.ltr ? "" : " is-rtl"}`}
            style={{ left: `${x * 92 + 4}%`, top: `${d.lane * 100}%` }}
            aria-label="드론 회수"
            onPointerDown={(e) => {
              e.preventDefault()
              recall()
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return
              e.preventDefault()
              if (!e.repeat) recall()
            }}
          >
            <span className="clicker-drone-body" />
          </button>
        )
      })}
    </div>
  )
}
