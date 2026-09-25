"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { MineArt, MINE_ORE_PLATE } from "@/data/clicker/mine-assets"
import { playSfx } from "@/components/clicker/clicker-sfx"
import "./clicker-mine.css"

export type MineStrikeResult = { critical: boolean }

type Spark = {
  id: number
  x: number
  y: number
  critical: boolean
  dx: number
  dy: number
}

type Laser = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  critical: boolean
}

type Impact = { id: number; x: number; y: number; critical: boolean }

type Props = {
  visual?: "idle" | "fever" | "crisis"
  muted: boolean
  pop: boolean
  shake: boolean
  onMine: (clientX: number, clientY: number) => MineStrikeResult
  onPop: () => void
  playLaser: (muted: boolean, critical: boolean) => void
  /** Fires when the center ore's integrity hits zero (after ORE_HP strikes). */
  onOreBroken?: () => void
  /** Auto-drill strikes per second (0 = none). */
  autoRate?: number
}


/** Hits to shatter the center ore; each shatter pays BREAK_BONUS extra strikes. */
const ORE_HP = 24
const BREAK_BONUS = 3
const REGROW_MS = 650

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
  onOreBroken,
  autoRate = 0,
}: Props) {
  const [box, setBox] = useState<Box | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hp, setHp] = useState(ORE_HP)
  const [hitSeq, setHitSeq] = useState(0)
  const [broken, setBroken] = useState(false)
  const [sparks, setSparks] = useState<Spark[]>([])
  const [lasers, setLasers] = useState<Laser[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
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

  const fireLaser = useCallback((x: number, y: number, critical: boolean, drill = false) => {
    const el = mineRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const id = ++seq.current
    const side = id % 2 === 0 ? -1 : 1
    // Player rig sits below the frame (alternating barrels); the assist drill fires from the side walls.
    const origin = drill
      ? { x: side < 0 ? -8 : width + 8, y: height * 0.55 }
      : { x: width / 2 + side * width * 0.06, y: height + 8 }
    const beam: Laser = { id, x1: origin.x, y1: origin.y, x2: x, y2: y, critical }
    setLasers((prev) => [...prev.slice(-5), beam])
    setImpacts((prev) => [...prev.slice(-5), { id, x, y, critical }])
    const life = reduceMotion.current ? 80 : 220
    later(() => {
      setLasers((prev) => prev.filter((l) => l.id !== id))
      setImpacts((prev) => prev.filter((i) => i.id !== id))
    }, life)

    const burst = Array.from({ length: critical ? 7 : 4 }, () => ({
      id: ++seq.current,
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      critical,
      dx: (Math.random() - 0.5) * 60,
      dy: -12 - Math.random() * 30,
    }))
    setSparks((prev) => [...prev.slice(-24), ...burst])
    later(() => setSparks((prev) => prev.filter((s) => !burst.some((b) => b.id === s.id))), 480)
  }, [])

  // Latest values for the drill interval without re-arming it every render.
  const live = useRef({ hp, broken, box, muted, onMine, onPop, onOreBroken, playLaser })
  useEffect(() => {
    live.current = { hp, broken, box, muted, onMine, onPop, onOreBroken, playLaser }
  })

  /** One strike at a point in mine-local px — shared by taps and the assist drill. */
  const hitAt = useCallback(
    (x: number, y: number, drill: boolean) => {
      const el = mineRef.current
      const cur = live.current
      if (!el || cur.broken) return
      const rect = el.getBoundingClientRect()
      const { critical } = cur.onMine(rect.left + x, rect.top + y)
      if (!drill) {
        cur.playLaser(cur.muted, critical)
        cur.onPop()
      }
      fireLaser(x, y, critical, drill)
      setHitSeq((n) => n + 1)

      const next = cur.hp - (critical ? 2 : 1)
      live.current = { ...cur, hp: Math.max(0, next) }
      if (next > 0) {
        setHp(next)
        return
      }
      // Shatter: bonus strikes around the crystal, then regrow.
      setHp(0)
      setBroken(true)
      live.current = { ...live.current, broken: true }
      cur.onOreBroken?.()
      const b = cur.box
      for (let i = 0; i < BREAK_BONUS; i++) {
        later(() => {
          const cx = b ? b.left + b.width * (0.3 + Math.random() * 0.4) : rect.width / 2
          const cy = b ? b.top + b.height * (0.3 + Math.random() * 0.4) : rect.height / 2
          live.current.onMine(rect.left + cx, rect.top + cy)
          fireLaser(cx, cy, false)
        }, 90 * (i + 1))
      }
      later(() => {
        setHp(ORE_HP)
        setBroken(false)
      }, reduceMotion.current ? 120 : REGROW_MS)
    },
    [fireLaser],
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

  const plate = MineArt.orePlate
  const { width: iw, height: ih, ore } = MINE_ORE_PLATE
  const scale = size.width ? Math.max(size.width / iw, size.height / ih) : 0
  const integrity = hp / ORE_HP

  return (
    <div
      ref={mineRef}
      data-visual={visual}
      className={`clicker-mine clicker-mine-single${pop ? " is-pop" : ""}${shake ? " is-shake" : ""}`}
    >
      <div className="clicker-mine-plate" style={{ backgroundImage: `url(${plate})` }} aria-hidden />

      {box ? (
        <button
          type="button"
          className={`clicker-mine-crystal${broken ? " is-broken" : ""}${integrity <= 0.34 ? " is-weak" : ""}`}
          aria-label={
            muted
              ? `코어 광석 채굴 · 내구도 ${hp}/${ORE_HP} · 음소거`
              : `코어 광석 채굴 · 레이저 · 내구도 ${hp}/${ORE_HP}`
          }
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onPointerDown={strike}
        >
          {/* Same plate, cropped to the crystal, so hits can pulse just the ore. */}
          <span
            key={hitSeq}
            className={`clicker-mine-crystal-art${hitSeq > 0 ? " is-hit" : ""}`}
            style={
              {
                backgroundImage: `url(${plate})`,
                backgroundSize: `${iw * scale}px ${ih * scale}px`,
                backgroundPosition: `${-ore.x * scale}px ${-ore.y * scale}px`,
                "--ore-crack": String(1 - integrity),
              } as CSSProperties
            }
          />
          <span className="clicker-mine-crystal-glow" />
        </button>
      ) : null}

      {box ? (
        <div
          className="clicker-mine-integrity"
          style={{ left: box.left + box.width * 0.15, top: box.top + box.height + 10, width: box.width * 0.7 }}
          aria-hidden
        >
          <i style={{ width: `${Math.round(integrity * 100)}%` }} />
        </div>
      ) : null}

      {autoRate > 0 ? <span className="clicker-mine-drill-tag">보조 드릴 · {autoRate}/s</span> : null}

      <svg className="clicker-mine-lasers" aria-hidden>
        {lasers.map((laser) => (
          <g key={laser.id} className={`clicker-mine-beam${laser.critical ? " is-crit" : ""}`}>
            <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} className="clicker-mine-beam-glow" />
            <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} className="clicker-mine-beam-core" />
          </g>
        ))}
      </svg>

      <div className="clicker-mine-impacts" aria-hidden>
        {impacts.map((hit) => (
          <span
            key={hit.id}
            className={`clicker-mine-impact${hit.critical ? " is-crit" : ""}`}
            style={{ left: hit.x, top: hit.y }}
          />
        ))}
      </div>

      <div className="clicker-sparks clicker-mine-sparks" aria-hidden>
        {sparks.map((spark) => (
          <span
            key={spark.id}
            className={`clicker-spark${spark.critical ? " is-crit" : ""}`}
            style={
              {
                left: `${spark.x}px`,
                top: `${spark.y}px`,
                "--spark-dx": `${spark.dx}px`,
                "--spark-dy": `${spark.dy}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {broken ? <div className="clicker-mine-shatter" aria-hidden /> : null}
    </div>
  )
}
