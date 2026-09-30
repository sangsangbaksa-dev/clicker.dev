"use client"

import { useEffect, useRef } from "react"
import type { CoreVisual } from "@/domain/services/clicker-view"
import type { BgmScene } from "@/domain/services/clicker-bgm"
import { createClickerBgmEngine } from "@/application/clicker-bgm-engine"
import { sharedAudioContext } from "@/components/clicker/clicker-sfx"
import { createHtmlClickerBgmPorts } from "@/infrastructure/audio/html-clicker-bgm-ports"

export type { BgmScene } from "@/domain/services/clicker-bgm"
export { worldBgmTrack as worldBgm } from "@/domain/services/clicker-bgm"

const bgmPorts = () =>
  createHtmlClickerBgmPorts({
    resumeSharedContext() {
      const c = sharedAudioContext()
      if (c && c.state !== "running" && c.state !== "closed") void c.resume().catch(() => {})
    },
    sharedAudioContext,
  })

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
    const engine = createClickerBgmEngine(bgmPorts())
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
