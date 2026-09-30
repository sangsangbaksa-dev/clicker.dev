"use client"

import { useEffect, useRef, useState } from "react"
import "./clicker-purchase-fx.css"

type Fx = { key: number; kind: string; assetId?: string }
type Shown = Fx & { x?: number; y?: number }

/** A buy made by pointer bursts where it was clicked; older than this, it falls back to the centre. */
const POINTER_FRESH_MS = 1500

/**
 * Purchase burst. Each skill branch / upgrade category has its own look:
 * FOCUS lightning shards, AUTOMATION gear ring, RESONANCE wave rings, TRANSCENDENCE
 * star rays, HUNT claw slashes; CLICK sparks, PRODUCTION coins, FEVER flames, UTILITY hex grid.
 */
export function ClickerPurchaseFx({ fx }: { fx: Fx | null }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const pointer = useRef({ x: 0, y: 0, at: 0 })
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY, at: performance.now() }
    }
    window.addEventListener("pointerdown", onDown, true)
    return () => window.removeEventListener("pointerdown", onDown, true)
  }, [])
  useEffect(() => {
    if (!fx) return
    const p = pointer.current
    const fresh = p.at > 0 && performance.now() - p.at < POINTER_FRESH_MS
    setShown(fresh ? { ...fx, x: p.x, y: p.y } : fx)
    const t = window.setTimeout(() => setShown((cur) => (cur?.key === fx.key ? null : cur)), 1100)
    return () => window.clearTimeout(t)
  }, [fx])
  if (!shown) return null
  const kind = shown.kind.toLowerCase()
  return (
    <div
      key={shown.key}
      className={`clicker-pfx is-${kind}`}
      style={shown.x !== undefined ? { left: shown.x, top: shown.y } : undefined}
      aria-hidden
    >
      <span className="clicker-pfx-ring" />
      <span className="clicker-pfx-ring is-2" />
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="clicker-pfx-bit" style={{ ["--i" as string]: i }} />
      ))}
      {shown.assetId ? <img className="clicker-pfx-icon" src={shown.assetId} alt="" /> : null}
    </div>
  )
}
