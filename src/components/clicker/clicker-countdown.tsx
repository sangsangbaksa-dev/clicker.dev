"use client"

import { useEffect, useState } from "react"

/** Tenths left until `endsAt`, from the wall clock. */
function tenthsLeft(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 100))
}

/**
 * Stopwatch-style countdown: steps down every 0.1s on its own clock, so the number runs
 * smoothly instead of jumping with the game's 250ms repaints.
 */
export function ClickerCountdown({ endsAt, fallbackMs }: { endsAt: number; fallbackMs: number }) {
  const [tenths, setTenths] = useState<number | null>(null)
  useEffect(() => {
    let frame = 0
    const loop = () => {
      const next = tenthsLeft(endsAt)
      setTenths((prev) => (prev === next ? prev : next))
      if (next > 0) frame = window.requestAnimationFrame(loop)
    }
    loop()
    return () => window.cancelAnimationFrame(frame)
  }, [endsAt])
  // Before the first frame, show the game's own value so server and client markup match.
  const shown = tenths ?? Math.max(0, Math.ceil(fallbackMs / 100))
  return <>{(shown / 10).toFixed(1)}s</>
}
