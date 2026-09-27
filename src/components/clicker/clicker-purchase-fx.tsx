"use client"

import { useEffect, useState } from "react"
import "./clicker-purchase-fx.css"

type Fx = { key: number; kind: string; assetId?: string }

/**
 * Purchase burst. Each skill branch / upgrade category has its own look:
 * FOCUS lightning shards, AUTOMATION gear ring, RESONANCE wave rings, TRANSCENDENCE
 * star rays, HUNT claw slashes; CLICK sparks, PRODUCTION coins, FEVER flames, UTILITY hex grid.
 */
export function ClickerPurchaseFx({ fx }: { fx: Fx | null }) {
  const [shown, setShown] = useState<Fx | null>(null)
  useEffect(() => {
    if (!fx) return
    setShown(fx)
    const t = window.setTimeout(() => setShown((cur) => (cur?.key === fx.key ? null : cur)), 1100)
    return () => window.clearTimeout(t)
  }, [fx])
  if (!shown) return null
  const kind = shown.kind.toLowerCase()
  return (
    <div key={shown.key} className={`clicker-pfx is-${kind}`} aria-hidden>
      <span className="clicker-pfx-ring" />
      <span className="clicker-pfx-ring is-2" />
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="clicker-pfx-bit" style={{ ["--i" as string]: i }} />
      ))}
      {shown.assetId ? <img className="clicker-pfx-icon" src={shown.assetId} alt="" /> : null}
    </div>
  )
}
