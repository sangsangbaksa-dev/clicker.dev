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
import { mineOreLayout, type OrePlateLayout } from "@/lib/clicker-ore-plate"
import { VEIN_LIFETIME_MS, VEIN_SPAWN_CHANCE } from "@/application/clicker-ui"
import { playSfx } from "@/lib/clicker-sfx"
import "./clicker-mine.css"

const SPACE_HOLD_CPS = 7

type Props = {
  muted: boolean
  onMine: (clientX: number, clientY: number, auto?: boolean) => { critical: boolean } | null
  playLaser: (muted: boolean, critical: boolean) => void
  /** Auto-drill strikes per second (0 = none). */
  autoRate?: number
  /** Golden vein hit — returns the reward label to flash in the scene. */
  onVein?: (clientX: number, clientY: number) => string | null
}

type Vein = { x: number; y: number; expiresAt: number }


type Box = { left: number; top: number; width: number; height: number }

/** Soft dark-cyan ellipse fill: full `alpha` at the core, half at mid-radius, nothing at the rim. */
function shadowGradient(rgb: readonly number[], alpha: number): string {
  const c = rgb.join(" ")
  return `radial-gradient(closest-side, rgb(${c} / ${alpha}), rgb(${c} / ${alpha / 2}) 50%, rgb(${c} / 0))`
}

/** Single center ore: tap the big crystal to mine it. */
export function ClickerMine({
  muted,
  onMine,
  playLaser,
  autoRate = 0,
  onVein,
}: Props) {
  /** Shrunk ore box, tap target and ground shadow for the current mine size (pure rule in the domain). */
  const [layout, setLayout] = useState<OrePlateLayout | null>(null)
  const box = layout?.hit ?? null
  const [vein, setVein] = useState<Vein | null>(null)
  const [veinLabel, setVeinLabel] = useState<string | null>(null)
  const mineRef = useRef<HTMLDivElement>(null)
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
    const el = mineRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setLayout(mineOreLayout(width, height))
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

  const live = useRef({ muted, onMine, playLaser })
  useEffect(() => {
    live.current = { muted, onMine, playLaser }
  })

  /** One strike at a point in mine-local px — shared by taps and the assist drill. */
  const hitAt = useCallback(
    (x: number, y: number, drill: boolean) => {
      const el = mineRef.current
      const cur = live.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const strike = cur.onMine(rect.left + x, rect.top + y, drill)
      if (!strike) return
      if (!drill) cur.playLaser(cur.muted, strike.critical)
    },
    [],
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
    playLaser(muted, true)
    setVein(null)
    const label = onVein?.(e.clientX, e.clientY) ?? null
    if (label) {
      setVeinLabel(label)
      later(() => setVeinLabel(null), 1800)
    }
  }

  const plate = MineArt.orePlate
  /** The crystal is cropped from the ORIGINAL plate (it still has the big crystal baked in); the background is the clean one. */
  const crystalSrc = MineArt.orePlateCrystal

  return (
    <div
      ref={mineRef}
      className="clicker-mine clicker-mine-single"
    >
      <div className="clicker-mine-plate" style={{ backgroundImage: `url(${plate})` }} aria-hidden>
        {layout && layout.shadow.alpha > 0 ? (
          <span
            className="clicker-mine-plate-shadow"
            style={{
              left: layout.shadow.rect.left,
              top: layout.shadow.rect.top,
              width: layout.shadow.rect.width,
              height: layout.shadow.rect.height,
              backgroundImage: shadowGradient(MINE_ORE_PLATE.shadow.rgb, layout.shadow.alpha),
            }}
          />
        ) : null}
      </div>

      {box ? (
        <button
          type="button"
          className="clicker-mine-crystal"
          aria-label={
            muted
              ? "코어 광석 채굴 · 음소거"
              : "코어 광석 채굴"
          }
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          onPointerDown={strike}
        >
          {/* The original plate (crystal baked in), cropped to the crystal and shrunk with it, so hits can pulse just the ore. */}
          <span
            className="clicker-mine-crystal-art"
            style={
              {
                backgroundImage: `url(${crystalSrc})`,
                backgroundSize: `${layout?.art.width ?? 0}px ${layout?.art.height ?? 0}px`,
                backgroundPosition: `${layout?.art.x ?? 0}px ${layout?.art.y ?? 0}px`,
              } as CSSProperties
            }
          />
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
    </div>
  )
}
