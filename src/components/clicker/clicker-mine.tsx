"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { MineArt, MINE_ORE_PLATE } from "@/data/clicker/mine-assets"
import { VEIN_LIFETIME_MS, VEIN_SPAWN_CHANCE } from "@/domain/services/clicker-bonus"
import { playSfx } from "@/components/clicker/clicker-sfx"
import "./clicker-mine.css"

export type MineStrikeKind = "lightning" | "quake" | "echo"
export type MineStrikeResult = { critical: boolean; strike?: MineStrikeKind }

/** Rock chip thrown from a hit: arcs up, then falls under gravity while spinning. */
type Chip = {
  id: number
  x: number
  y: number
  critical: boolean
  dx: number
  dy: number
  spin: number
  size: number
}

type Laser = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  critical: boolean
  echo: boolean
}

type Impact = { id: number; x: number; y: number; critical: boolean; echo: boolean }


type Bolt = { id: number; main: string; branches: string[] }
type Quake = { id: number; x: number; y: number; width: number }

type Props = {
  visual?: "idle" | "fever" | "crisis"
  muted: boolean
  pop: boolean
  shake: boolean
  onMine: (clientX: number, clientY: number) => MineStrikeResult
  onPop: () => void
  playLaser: (muted: boolean, critical: boolean) => void
  /** Auto-drill strikes per second (0 = none). */
  autoRate?: number
  /** Golden vein hit — returns the reward label to flash in the scene. */
  onVein?: (clientX: number, clientY: number) => string | null
}

type Vein = { x: number; y: number; expiresAt: number }

/** The echo proc rings back a beat after the strike (matches the echoStrike SFX). */
const ECHO_DELAY_MS = 130

/** Jagged polyline from (x1,y1) to (x2,y2); jitter tapers off toward the target. */
function jagged(x1: number, y1: number, x2: number, y2: number, steps: number, jitter: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  const nx = -(y2 - y1) / len
  const ny = (x2 - x1) / len
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const off = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 2 * jitter * (1 - t * 0.6)
    pts.push(`${(x1 + (x2 - x1) * t + nx * off).toFixed(1)},${(y1 + (y2 - y1) * t + ny * off).toFixed(1)}`)
  }
  return pts.join(" ")
}

type Box = { left: number; top: number; width: number; height: number }

/**
 * Where the crystal sits inside the plate, and the plate's cover-fit
 * placement for a given viewport — must match `background-size: cover` + center.
 */
function oreBoxFor(width: number, height: number): Box {
  const { width: iw, height: ih, ore } = MINE_ORE_PLATE
  const scale = Math.max(width / iw, height / ih)
  const ox = (width - iw * scale) / 2
  const oy = (height - ih * scale) / 2
  return {
    left: ox + ore.x * scale,
    top: oy + ore.y * scale,
    width: ore.w * scale,
    height: ore.h * scale,
  }
}

/** Single center ore: tap the big crystal, a laser fires from the rig below. */
export function ClickerMine({
  visual = "idle",
  muted,
  pop,
  shake,
  onMine,
  onPop,
  playLaser,
  autoRate = 0,
  onVein,
}: Props) {
  const [box, setBox] = useState<Box | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hitSeq, setHitSeq] = useState(0)
  const [lastCrit, setLastCrit] = useState(false)
  const [chips, setChips] = useState<Chip[]>([])
  const [lasers, setLasers] = useState<Laser[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
  const [bolts, setBolts] = useState<Bolt[]>([])
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [strikeFlash, setStrikeFlash] = useState<{ id: number; kind: MineStrikeKind } | null>(null)
  const [vein, setVein] = useState<Vein | null>(null)
  const [veinLabel, setVeinLabel] = useState<string | null>(null)
  const seq = useRef(0)
  const mineRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useRef(false)
  const timers = useRef<number[]>([])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const el = mineRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setSize({ width, height })
      setBox(oreBoxFor(width, height))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const pending = timers.current
    return () => {
      ro.disconnect()
      for (const t of pending) window.clearTimeout(t)
    }
  }, [])

  // Latest values for the drill interval without re-arming it every render.
  const live = useRef({ box, muted, onMine, onPop, playLaser })
  useEffect(() => {
    live.current = { box, muted, onMine, onPop, playLaser }
  })

  const fireLaser = useCallback((x: number, y: number, critical: boolean, drill = false, echo = false) => {
    const el = mineRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const id = ++seq.current
    const side = id % 2 === 0 ? -1 : 1
    // Player rig sits below the frame (alternating barrels); the assist drill fires from the side walls.
    const origin = drill
      ? { x: side < 0 ? -8 : width + 8, y: height * 0.55 }
      : { x: width / 2 + side * width * 0.06, y: height + 8 }
    const beam: Laser = { id, x1: origin.x, y1: origin.y, x2: x, y2: y, critical, echo }
    setLasers((prev) => [...prev.slice(-7), beam])
    setImpacts((prev) => [...prev.slice(-7), { id, x, y, critical, echo }])
    const life = reduceMotion.current ? 80 : echo ? 340 : critical ? 300 : 240
    later(() => {
      setLasers((prev) => prev.filter((l) => l.id !== id))
      setImpacts((prev) => prev.filter((i) => i.id !== id))
    }, life)

    if (reduceMotion.current) return
    // Chips fly away from the rig: bias the throw along the beam direction.
    const away = Math.sign(x - origin.x) || 1
    const burst: Chip[] = Array.from({ length: echo ? 2 : critical ? 8 : 5 }, () => ({
      id: ++seq.current,
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      critical,
      dx: (Math.random() - 0.35) * 70 * away,
      dy: -(24 + Math.random() * (critical ? 52 : 36)),
      spin: (Math.random() - 0.5) * 540,
      size: 5 + Math.random() * (critical ? 6 : 4),
    }))
    setChips((prev) => [...prev.slice(-32), ...burst])
    later(() => setChips((prev) => prev.filter((s) => !burst.some((b) => b.id === s.id))), 640)
  }, [])

  /** Strike procs from the engine get their own motion on top of the laser. */
  const playStrike = useCallback(
    (kind: MineStrikeKind, x: number, y: number, drill: boolean) => {
      const el = mineRef.current
      if (!el) return
      const id = ++seq.current
      setStrikeFlash({ id, kind })
      later(() => setStrikeFlash((cur) => (cur?.id === id ? null : cur)), kind === "quake" ? 420 : 300)

      if (kind === "echo") {
        // The same strike rings back a beat later as a violet ghost beam.
        later(() => fireLaser(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, false, drill, true), ECHO_DELAY_MS)
        return
      }

      const { width } = el.getBoundingClientRect()
      if (kind === "lightning") {
        const top = { x: x + (Math.random() - 0.5) * width * 0.3, y: -12 }
        const main = jagged(top.x, top.y, x, y, 10, 26)
        // Chain arcs jump from the landing point to other spots on the crystal.
        const b = live.current.box
        const branches = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => {
          const tx = b ? b.left + b.width * (0.2 + Math.random() * 0.6) : x + (Math.random() - 0.5) * 120
          const ty = b ? b.top + b.height * (0.2 + Math.random() * 0.6) : y + (Math.random() - 0.5) * 120
          return jagged(x, y, tx, ty, 5, 12)
        })
        setBolts((prev) => [...prev.slice(-2), { id, main, branches }])
        later(() => setBolts((prev) => prev.filter((bolt) => bolt.id !== id)), reduceMotion.current ? 120 : 320)
        return
      }

      // Quake: shockwave rings roll out along the ground under the crystal.
      const b = live.current.box
      const ring: Quake = b
        ? { id, x: b.left + b.width / 2, y: b.top + b.height * 0.9, width: b.width * 1.5 }
        : { id, x: width / 2, y: y + 40, width: width * 0.6 }
      if (!reduceMotion.current) {
        setQuakes((prev) => [...prev.slice(-1), ring])
        later(() => setQuakes((prev) => prev.filter((q) => q.id !== id)), 700)
      }
    },
    [fireLaser],
  )

  /** One strike at a point in mine-local px — shared by taps and the assist drill. */
  const hitAt = useCallback(
    (x: number, y: number, drill: boolean) => {
      const el = mineRef.current
      const cur = live.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const { critical, strike } = cur.onMine(rect.left + x, rect.top + y)
      if (!drill) {
        cur.playLaser(cur.muted, critical)
        cur.onPop()
      }
      fireLaser(x, y, critical, drill)
      if (strike) playStrike(strike, x, y, drill)
      setLastCrit(critical)
      setHitSeq((n) => n + 1)
    },
    [fireLaser, playStrike],
  )

  const strike = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const el = mineRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      hitAt(e.clientX - rect.left, e.clientY - rect.top, false)
    },
    [hitAt],
  )

  /** Keyboard mining: Enter/Space strikes near the crystal's center; held-key repeats are ignored. */
  const strikeKey = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      if (e.repeat) return
      const b = live.current.box
      if (!b) return
      hitAt(b.left + b.width * (0.35 + Math.random() * 0.3), b.top + b.height * (0.35 + Math.random() * 0.3), false)
    },
    [hitAt],
  )

  // Assist drill: auto strikes on random points of the crystal.
  useEffect(() => {
    if (autoRate <= 0) return
    const id = window.setInterval(() => {
      const b = live.current.box
      if (!b) return
      hitAt(b.left + b.width * (0.25 + Math.random() * 0.5), b.top + b.height * (0.2 + Math.random() * 0.55), true)
    }, 1000 / autoRate)
    return () => window.clearInterval(id)
  }, [autoRate, hitAt])

  // Golden vein: maybe one per session, a few seconds in, briefly clickable.
  useEffect(() => {
    if (!onVein || Math.random() >= VEIN_SPAWN_CHANCE) return
    const spawn = window.setTimeout(() => {
      setVein({ x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.5, expiresAt: Date.now() + VEIN_LIFETIME_MS })
      playSfx("veinSpawn")
    }, 1500 + Math.random() * 3500)
    return () => window.clearTimeout(spawn)
    // One roll per mount (= per mine session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!vein) return
    const t = window.setTimeout(() => setVein(null), Math.max(0, vein.expiresAt - Date.now()))
    return () => window.clearTimeout(t)
  }, [vein])

  const claimVein = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !vein) return
    e.preventDefault()
    e.stopPropagation()
    const el = mineRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    playLaser(muted, true)
    fireLaser(e.clientX - rect.left, e.clientY - rect.top, true)
    setVein(null)
    const label = onVein?.(e.clientX, e.clientY) ?? null
    if (label) {
      setVeinLabel(label)
      later(() => setVeinLabel(null), 1800)
    }
  }

  const plate = MineArt.orePlate
  const { width: iw, height: ih, ore } = MINE_ORE_PLATE
  const scale = size.width ? Math.max(size.width / iw, size.height / ih) : 0

  return (
    <div
      ref={mineRef}
      data-visual={visual}
      className={`clicker-mine clicker-mine-single${pop ? " is-pop" : ""}${shake ? " is-shake" : ""}${
        strikeFlash?.kind === "quake" ? " is-quake" : ""
      }`}
    >
      <div className="clicker-mine-plate" style={{ backgroundImage: `url(${plate})` }} aria-hidden />

      {box ? (
        <button
          type="button"
          className="clicker-mine-crystal"
          aria-label={muted ? "코어 광석 채굴 · 음소거" : "코어 광석 채굴 · 레이저"}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onPointerDown={strike}
          onKeyDown={strikeKey}
        >
          {/* Same plate, cropped to the crystal, so hits can pulse just the ore. */}
          <span
            key={hitSeq}
            className={`clicker-mine-crystal-art${hitSeq > 0 ? (lastCrit ? " is-hit is-crit-hit" : " is-hit") : ""}`}
            style={
              {
                backgroundImage: `url(${plate})`,
                backgroundSize: `${iw * scale}px ${ih * scale}px`,
                backgroundPosition: `${-ore.x * scale}px ${-ore.y * scale}px`,
              } as CSSProperties
            }
          />
          <span className="clicker-mine-crystal-glow" />
        </button>
      ) : null}

      {vein && box ? (
        <button
          type="button"
          className="clicker-mine-vein-gold"
          aria-label="황금 광맥 — 탭하여 보상"
          style={{ left: box.left + box.width * vein.x, top: box.top + box.height * vein.y }}
          onPointerDown={claimVein}
        />
      ) : null}
      {veinLabel ? (
        <p className="clicker-mine-vein-label" role="status">
          {veinLabel}
        </p>
      ) : null}
      {autoRate > 0 ? <span className="clicker-mine-drill-tag">보조 드릴 · {autoRate}/s</span> : null}

      <svg className="clicker-mine-lasers" aria-hidden>
        {lasers.map((laser) => (
          <g
            key={laser.id}
            className={`clicker-mine-beam${laser.critical ? " is-crit" : ""}${laser.echo ? " is-echo" : ""}`}
          >
            <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} className="clicker-mine-beam-glow" />
            <line
              x1={laser.x1}
              y1={laser.y1}
              x2={laser.x2}
              y2={laser.y2}
              pathLength={1}
              className="clicker-mine-beam-core"
            />
            <circle cx={laser.x1} cy={laser.y1} r={laser.critical ? 20 : 14} className="clicker-mine-muzzle" />
          </g>
        ))}
        {bolts.map((bolt) => (
          <g key={bolt.id} className="clicker-mine-bolt">
            <polyline points={bolt.main} className="clicker-mine-bolt-glow" />
            {bolt.branches.map((points, i) => (
              <polyline key={i} points={points} className="clicker-mine-bolt-glow is-branch" />
            ))}
            <polyline points={bolt.main} className="clicker-mine-bolt-core" />
            {bolt.branches.map((points, i) => (
              <polyline key={`c${i}`} points={points} className="clicker-mine-bolt-core is-branch" />
            ))}
          </g>
        ))}
      </svg>

      <div className="clicker-mine-impacts" aria-hidden>
        {impacts.map((hit) => (
          <span
            key={hit.id}
            className={`clicker-mine-impact${hit.critical ? " is-crit" : ""}${hit.echo ? " is-echo" : ""}`}
            style={{ left: hit.x, top: hit.y }}
          >
            <i />
          </span>
        ))}
        {quakes.map((q) => (
          <span
            key={q.id}
            className="clicker-mine-quake"
            style={{ left: q.x, top: q.y, width: q.width, height: q.width * 0.26 }}
          >
            <i />
            <i />
          </span>
        ))}
      </div>

      <div className="clicker-mine-sparks" aria-hidden>
        {chips.map((chip) => (
          <span
            key={chip.id}
            className={`clicker-mine-debris${chip.critical ? " is-crit" : ""}`}
            style={
              {
                left: `${chip.x}px`,
                top: `${chip.y}px`,
                width: `${chip.size}px`,
                height: `${chip.size}px`,
                "--chip-size": `${chip.size}px`,
                "--chip-dx": `${chip.dx}px`,
                "--chip-dy": `${chip.dy}px`,
                "--chip-spin": `${chip.spin}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {strikeFlash ? (
        <div key={strikeFlash.id} className={`clicker-mine-strike-flash is-${strikeFlash.kind}`} aria-hidden />
      ) : null}
    </div>
  )
}
