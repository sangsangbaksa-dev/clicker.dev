"use client"

import { useCallback, useEffect, useRef } from "react"
import { clickerCues, drillLoopExpired, drillTapPlan, DRILL_LOOP_IDLE_MS } from "@/application/clicker-cues"

/**
 * Sound of the region drill rig: start on the first tap of a cycle, a hum while taps keep coming,
 * complete when the vein is bored. The hum ends on completion, DRILL_LOOP_IDLE_MS after the last
 * tap, when the region changes, or on unmount. What plays when is decided by `drillTapPlan`.
 * Returns the callback for an accepted tap with its payout (0 = no bore yet).
 */
export function useDrillCues(regionId: string | undefined): (reward: number, sessionContinues?: boolean) => void {
  const active = useRef(false)
  const lastTap = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    active.current = false
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    clickerCues().stopLoop("drillLoop")
  }, [])

  useEffect(() => stop, [regionId, stop])

  return useCallback(
    (reward: number, sessionContinues = false) => {
      const cues = clickerCues()
      const plan = drillTapPlan(active.current, reward, sessionContinues)
      for (const id of plan.play) cues.play(id)
      if (plan.loop === "stop") {
        stop()
        return
      }
      if (plan.loop === "start") {
        active.current = true
        cues.startLoop("drillLoop")
      }
      lastTap.current = performance.now()
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        if (drillLoopExpired(performance.now() - lastTap.current + 1)) stop()
      }, DRILL_LOOP_IDLE_MS)
    },
    [stop],
  )
}
