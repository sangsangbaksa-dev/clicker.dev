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
import { VEIN_LIFETIME_MS, VEIN_SPAWN_CHANCE } from "@/application/clicker-ui"
import { playSfx } from "@/lib/clicker-sfx"
import "./clicker-mine.css"

/** Strikes per second while Space is held down. */
const SPACE_HOLD_CPS = 7

export type MineStrikeResult = { critical: boolean; lightning?: boolean; quake?: boolean; echo?: boolean }

/** Strike spectacle grows with progress: 0 = first mine, 4 = late game (FEVER adds one). */
export type MineFxTier = 0 | 1 | 2 | 3 | 4

type Bolt = { id: number; d: string; big: boolean }
type Ring = { id: number; x: number; y: number; big: boolean }

/** Chance a plain strike also calls down a bolt, per tier. */
const BOLT_CHANCE = [0, 0.08, 0.2, 0.38, 0.6]

/** A jagged lightning path between two points. */
function boltPath(x0: number, y0: number, x1: number, y1: number, jag: number, segments = 9): string {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const off = (Math.random() - 0.5) * jag * (1 - Math.abs(t - 0.5))
    d += `L${(x0 + dx * t + nx * off).toFixed(1)} ${(y0 + dy * t + ny * off).toFixed(1)}`
  }
  return `${d}L${x1.toFixed(1)} ${y1.toFixed(1)}`
}

type Spark = {
  id: number
  x: number
  y: number
  critical: boolean
  dx: number
  dy: number
  /** Prism sparks (top tier) carry their own hue. */
  hue?: number
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
  /** null = strike refused (mine CPS cap). */
  onMine: (clientX: number, clientY: number) => MineStrikeResult | null
  onPop: () => void
  playLaser: (muted: boolean, critical: boolean) => void
  /** Fires when the center ore's integrity hits zero (after ORE_HP strikes). */
  onOreBroken?: () => void
  /** Auto-drill strikes per second (0 = none). */
  autoRate?: number
  /** Golden vein hit — returns the reward label to flash in the scene. */
  onVein?: (clientX: number, clientY: number) => string | null
  /** How flashy strikes are (grows with progress). */
  fxTier?: MineFxTier
  /** An active skill is running: every strike calls down lightning. */
  storm?: boolean
  /** The lightning skill is owned; until then strikes show no bolts or arcs. */
  lightning?: boolean
  /** Bumped when a skill is cast; plays a full-screen burst in `color`. */
  nova?: { key: number; color: string } | null
}

type Vein = { x: number; y: number; expiresAt: number }


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
  onOreBroken: _onOreBroken,
  autoRate = 0,
  onVein,
  fxTier = 0,
  storm = false,
  lightning = false,
  nova = null,
}: Props) {
  const [box, setBox] = useState<Box | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hitSeq, setHitSeq] = useState(0)
  const broken = false
  const [sparks, setSparks] = useState<Spark[]>([])
  const [lasers, setLasers] = useState<Laser[]>([])
  const [impacts, setImpacts] = useState<Impact[]>([])
  const [bolts, setBolts] = useState<Bolt[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [flash, setFlash] = useState(0)
  const [vein, setVein] = useState<Vein | null>(null)
  const [veinLabel, setVeinLabel] = useState<string | null>(null)
  const seq = useRef(0)
  const mineRef = useRef<HTMLDivElement>(null)
  /** Last measured mine size (ResizeObserver), so strike effects never force a layout read. */
  const sizeRef = useRef({ width: 0, height: 0 })
  const reduceMotion = useRef(false)
  const timers = useRef(new Set<number>())

  /** setTimeout that forgets itself once it fires and is cleared on unmount. */
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const el = mineRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      sizeRef.current = { width, height }
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

  const fireLaser = useCallback((x: number, y: number, critical: boolean, drill = false, tier: MineFxTier = 0) => {
    const { width, height } = sizeRef.current
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

    const burst = Array.from({ length: (critical ? 7 : 4) + tier * 2 }, () => ({
      id: ++seq.current,
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      critical,
      dx: (Math.random() - 0.5) * 60,
      dy: -12 - Math.random() * (30 + tier * 10),
      hue: tier >= 4 ? Math.floor(Math.random() * 360) : undefined,
    }))
    setSparks((prev) => [...prev.slice(-24), ...burst])
    later(() => setSparks((prev) => prev.filter((s) => !burst.some((b) => b.id === s.id))), 480)
  }, [])

  // Latest values for the drill interval without re-arming it every render.
  const live = useRef({ broken, box, muted, onMine, onPop, playLaser, fxTier, storm, lightning })
  useEffect(() => {
    live.current = { broken, box, muted, onMine, onPop, playLaser, fxTier, storm, lightning }
  })

  /** Lightning, shockwaves, arcs and prism sparks on top of the laser, scaled by tier. */
  const fireFx = useCallback((x: number, y: number, hit: MineStrikeResult, tier: MineFxTier, stormOn: boolean, boltsOn: boolean) => {
    if (reduceMotion.current) return
    const { width } = sizeRef.current
    const b = live.current.box
    const newBolts: Bolt[] = []
    const newRings: Ring[] = []
    if (hit.lightning || (boltsOn && (stormOn || Math.random() < BOLT_CHANCE[tier] * (hit.critical ? 1.6 : 1)))) {
      const sx = x + (Math.random() - 0.5) * width * 0.35
      newBolts.push({ id: ++seq.current, d: boltPath(sx, -10, x, y, 70 + tier * 12, 11), big: Boolean(hit.lightning) })
      if (hit.lightning) {
        newBolts.push({ id: ++seq.current, d: boltPath(sx + 30, -10, x, y, 90, 10), big: true })
      }
    }
    // Chain arcs across the crystal (tier 3+ crits, every hit at 4, and every lightning proc).
    if (b && (hit.lightning || (boltsOn && ((tier >= 3 && hit.critical) || tier >= 4)))) {
      const arcs = hit.lightning ? 4 : tier >= 4 ? 2 : 1
      for (let i = 0; i < arcs; i++) {
        const tx = b.left + b.width * (0.15 + Math.random() * 0.7)
        const ty = b.top + b.height * (0.15 + Math.random() * 0.7)
        newBolts.push({ id: ++seq.current, d: boltPath(x, y, tx, ty, 26, 7), big: false })
      }
    }
    if (hit.quake || (tier >= 2 && hit.critical) || tier >= 3) newRings.push({ id: ++seq.current, x, y, big: Boolean(hit.quake) })
    if (hit.echo) newRings.push({ id: ++seq.current, x: x + 18, y: y - 14, big: false })
    if (newBolts.length) {
      setBolts((prev) => [...prev.slice(-10), ...newBolts])
      later(() => setBolts((prev) => prev.filter((v) => !newBolts.includes(v))), 260)
    }
    if (newRings.length) {
      setRings((prev) => [...prev.slice(-6), ...newRings])
      later(() => setRings((prev) => prev.filter((v) => !newRings.includes(v))), 520)
    }
    if (hit.lightning || hit.quake || (tier >= 4 && hit.critical)) setFlash((n) => n + 1)
  }, [])

  /** One strike at a point in mine-local px — shared by taps and the assist drill. */
  const hitAt = useCallback(
    (x: number, y: number, drill: boolean) => {
      const el = mineRef.current
      const cur = live.current
      if (!el || cur.broken) return
      const rect = el.getBoundingClientRect()
      const strike = cur.onMine(rect.left + x, rect.top + y)
      if (!strike) return
      const { critical } = strike
      if (!drill) {
        cur.playLaser(cur.muted, critical)
        cur.onPop()
      }
      fireLaser(x, y, critical, drill, cur.fxTier)
      fireFx(x, y, strike, cur.fxTier, cur.storm, cur.lightning)
      setHitSeq((n) => n + 1)

    },
    [fireLaser, fireFx],
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

  // Every strike that isn't a tap (Space, the assist drill) lands where the mouse cursor is — and
  // only if the cursor is on the ore; anywhere else it's void.
  const cursor = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const track = (e: PointerEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY }
    }
    const lose = () => {
      cursor.current = null
    }
    window.addEventListener("pointermove", track, { passive: true })
    window.addEventListener("pointerdown", track, { passive: true, capture: true })
    document.documentElement.addEventListener("mouseleave", lose)
    window.addEventListener("blur", lose)
    return () => {
      window.removeEventListener("pointermove", track)
      window.removeEventListener("pointerdown", track, { capture: true })
      document.documentElement.removeEventListener("mouseleave", lose)
      window.removeEventListener("blur", lose)
    }
  }, [])
  /** The cursor in mine-local px when it is over the ore's hitbox, else null. */
  const aimAtCursor = useCallback((): { x: number; y: number } | null => {
    const el = mineRef.current
    const c = cursor.current
    if (!el || !c) return null
    const target = document.elementFromPoint(c.x, c.y)
    if (!target?.closest(".clicker-mine-crystal, .clicker-mine-vein-gold") || !el.contains(target)) return null
    const rect = el.getBoundingClientRect()
    return { x: c.x - rect.left, y: c.y - rect.top }
  }, [])

  // Assist drill: auto strikes at the cursor while it rests on the crystal.
  useEffect(() => {
    if (autoRate <= 0) return
    const id = window.setInterval(() => {
      const at = aimAtCursor()
      if (at) hitAt(at.x, at.y, true)
    }, 1000 / autoRate)
    return () => window.clearInterval(id)
  }, [autoRate, hitAt, aimAtCursor])

  // Holding Space mines at a steady 7 strikes a second (first strike on press), at the cursor.
  useEffect(() => {
    let timer = 0
    const hitCursor = () => {
      const at = aimAtCursor()
      if (at) hitAt(at.x, at.y, false)
    }
    const stop = () => {
      if (timer) window.clearInterval(timer)
      timer = 0
    }
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      e.preventDefault()
      if (timer || e.repeat) return
      hitCursor()
      timer = window.setInterval(hitCursor, 1000 / SPACE_HOLD_CPS)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") stop()
    }
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    window.addEventListener("blur", stop)
    return () => {
      stop()
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
      window.removeEventListener("blur", stop)
    }
  }, [hitAt, aimAtCursor])

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
      className={`clicker-mine clicker-mine-single is-tier-${fxTier}${storm ? " is-storm" : ""}${pop ? " is-pop" : ""}${shake ? " is-shake" : ""}`}
    >
      <div className="clicker-mine-plate" style={{ backgroundImage: `url(${plate})` }} aria-hidden />

      {box ? (
        <button
          type="button"
          className={`clicker-mine-crystal${broken ? " is-broken" : ""}`}
          aria-label={
            muted
              ? "코어 광석 채굴 · 음소거"
              : "코어 광석 채굴 · 레이저"
          }
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onPointerDown={strike}
        >
          {/* Same plate, cropped to the crystal, so hits can pulse just the ore. */}
          <span
            className="clicker-mine-crystal-art"
            style={
              {
                backgroundImage: `url(${plate})`,
                backgroundSize: `${iw * scale}px ${ih * scale}px`,
                backgroundPosition: `${-ore.x * scale}px ${-ore.y * scale}px`,
              } as CSSProperties
            }
          />
          {/* Hit flash is its own soft layer: re-filtering the masked ore art every hit dropped frames. */}
          {hitSeq > 0 ? <span key={hitSeq} className="clicker-mine-crystal-flash" /> : null}
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
      {autoRate > 0 ? <span className="clicker-mine-drill-tag">보조 드릴 · {autoRate}/s · 커서 조준</span> : null}

      <svg className="clicker-mine-lasers" aria-hidden>
        {lasers.map((laser) => (
          <g key={laser.id} className={`clicker-mine-beam${laser.critical ? " is-crit" : ""}`}>
            <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} className="clicker-mine-beam-glow" />
            <line x1={laser.x1} y1={laser.y1} x2={laser.x2} y2={laser.y2} className="clicker-mine-beam-core" />
          </g>
        ))}
      </svg>

      <svg className="clicker-mine-bolts" aria-hidden>
        {bolts.map((bolt) => (
          <g key={bolt.id} className={`clicker-mine-bolt${bolt.big ? " is-big" : ""}`}>
            <path d={bolt.d} className="clicker-mine-bolt-glow" />
            <path d={bolt.d} className="clicker-mine-bolt-core" />
          </g>
        ))}
      </svg>
      <div className="clicker-mine-rings" aria-hidden>
        {rings.map((ring) => (
          <span key={ring.id} className={`clicker-mine-ring${ring.big ? " is-big" : ""}`} style={{ left: ring.x, top: ring.y }} />
        ))}
      </div>
      {flash > 0 ? <span key={`flash-${flash}`} className="clicker-mine-flash" aria-hidden /> : null}
      {nova ? (
        <span key={`nova-${nova.key}`} className="clicker-mine-nova" style={{ "--nova": nova.color } as CSSProperties} aria-hidden />
      ) : null}

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
            className={`clicker-spark${spark.critical ? " is-crit" : ""}${spark.hue === undefined ? "" : " is-prism"}`}
            style={
              {
                left: `${spark.x}px`,
                top: `${spark.y}px`,
                "--spark-dx": `${spark.dx}px`,
                "--spark-dy": `${spark.dy}px`,
                ...(spark.hue === undefined ? {} : { "--spark-hue": `${spark.hue}deg` }),
              } as CSSProperties
            }
          />
        ))}
      </div>

      {broken ? <div className="clicker-mine-shatter" aria-hidden /> : null}
    </div>
  )
}
