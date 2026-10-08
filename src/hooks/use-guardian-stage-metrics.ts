"use client"

import { useEffect, useState, type RefObject } from "react"
import type { StageMetrics } from "@/application/clicker-guardian-frame"
import type { Rect } from "@/domain/services/clicker-stage-safe"

/**
 * Measures the clicker stage that contains `ref` and the overlays on it (px, relative to the
 * stage). Selectors must match overlays only, never the boss's own box. Only reads the DOM; deciding what to do with the numbers is the application layer's job.
 * Re-measures whenever the stage, an overlay, or the set of overlays changes.
 */
export function useGuardianStageMetrics(
  ref: RefObject<HTMLElement | null>,
  selectors: readonly string[],
  stageSelector = ".clicker-stage",
): StageMetrics | null {
  const [metrics, setMetrics] = useState<StageMetrics | null>(null)
  const selectorKey = selectors.join(",")

  useEffect(() => {
    const own = ref.current
    const stage = own?.closest<HTMLElement>(stageSelector)
    if (!own || !stage) return
    let raf = 0
    const observed = new Set<Element>()
    const ro = new ResizeObserver(() => schedule())

    const measure = () => {
      raf = 0
      const sr = stage.getBoundingClientRect()
      const obstacles: Rect[] = []
      for (const el of stage.querySelectorAll(selectorKey)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) obstacles.push({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height })
      }
      setMetrics((prev) => (sameMetrics(prev, { size: { w: sr.width, h: sr.height }, obstacles }) ? prev : { size: { w: sr.width, h: sr.height }, obstacles }))
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    const watch = () => {
      const now = new Set<Element>(stage.querySelectorAll(selectorKey))
      for (const el of observed) {
        if (now.has(el)) continue
        ro.unobserve(el)
        observed.delete(el)
      }
      for (const el of now) {
        if (observed.has(el)) continue
        ro.observe(el)
        observed.add(el)
      }
      schedule()
    }
    ro.observe(stage)
    const mo = new MutationObserver(watch)
    mo.observe(stage, { childList: true, subtree: true })
    watch()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
    }
  }, [ref, selectorKey, stageSelector])

  return metrics
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5

function sameMetrics(a: StageMetrics | null, b: StageMetrics): boolean {
  if (!a || !near(a.size.w, b.size.w) || !near(a.size.h, b.size.h) || a.obstacles.length !== b.obstacles.length) return false
  return a.obstacles.every((o, i) => {
    const p = b.obstacles[i]!
    return near(o.x, p.x) && near(o.y, p.y) && near(o.w, p.w) && near(o.h, p.h)
  })
}
