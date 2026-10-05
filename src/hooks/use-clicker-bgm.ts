"use client"

import { useEffect, useRef } from "react"
import type { BgmScene } from "@/application/clicker-audio"
import { clickerBgmPorts, createClickerBgmEngine } from "@/application/clicker-bgm-engine"
import type { CoreVisual } from "@/application/clicker-ui"

export type { BgmScene } from "@/application/clicker-audio"
export { worldBgm } from "@/application/clicker-audio"

/**
 * Looping BGM with crossfades between scenes. No bgm_*.mp3 fetch until the first
 * pointer/key gesture and while music is muted in settings.
 */
export function useClickerBgm(
  visual: CoreVisual | undefined,
  { scene, muted, volume }: { scene: BgmScene; muted: boolean; volume: number },
) {
  const engineRef = useRef<ReturnType<typeof createClickerBgmEngine> | null>(null)

  useEffect(() => {
    const engine = createClickerBgmEngine(clickerBgmPorts())
    engineRef.current = engine

    const onGesture = () => engine.onUserGesture()
    const onVisibility = () => engine.onVisibility(document.visibilityState === "hidden")
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onVisibility()
    }

    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    engine.setState({ scene, muted, volume, visual })

    return () => {
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine lifetime is once; state syncs below
  }, [])

  useEffect(() => {
    engineRef.current?.setState({ scene, muted, volume, visual })
  }, [visual, scene, muted, volume])
}
