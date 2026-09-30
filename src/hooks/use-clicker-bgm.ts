"use client"

import { useEffect, useRef } from "react"
import type { CoreVisual } from "@/domain/services/clicker-view"
import {
  bgmFadeStep,
  bgmOutputLevel,
  bgmPlayerGain,
  bgmTrackFadeTarget,
  type BgmScene,
  type BgmTrackId,
} from "@/domain/services/clicker-bgm"
import { sharedAudioContext } from "@/components/clicker/clicker-sfx"
import {
  allBgmTrackIds,
  CLICKER_BGM_URL,
  warmBgmTracks,
  warmBgmUrl,
} from "@/infrastructure/audio/clicker-bgm-catalog"

export type { BgmScene } from "@/domain/services/clicker-bgm"
export { worldBgmTrack as worldBgm } from "@/domain/services/clicker-bgm"

type Track = BgmTrackId

/**
 * Looping BGM with crossfades between scenes. Fades out while the tab is hidden and
 * retries play on gesture until the browser allows it. Tracks load lazily on first use.
 */
export function useClickerBgm(
  visual: CoreVisual | undefined,
  { scene, muted, volume }: { scene: BgmScene; muted: boolean; volume: number },
) {
  const stateRef = useRef({ scene, muted, volume, visual })
  const kickRef = useRef<() => void>(() => {})

  useEffect(() => {
    const tracks: Partial<Record<Track, HTMLAudioElement>> = {}
    const gains: Partial<Record<Track, GainNode>> = {}
    const levels = Object.fromEntries(allBgmTrackIds().map((k) => [k, 0])) as Record<Track, number>
    const playPending = new Set<Track>()
    let unlocked = false
    let hidden = document.visibilityState === "hidden"
    let raf = 0
    let last = 0

    const track = (key: Track) => {
      let audio = tracks[key]
      if (!audio) {
        audio = new Audio(CLICKER_BGM_URL[key])
        audio.loop = true
        audio.volume = 0
        audio.preload = "auto"
        tracks[key] = audio
        void warmBgmUrl(CLICKER_BGM_URL[key])
      }
      return audio
    }

    const wire = (key: Track, audio: HTMLAudioElement) => {
      if (gains[key]) return
      const c = sharedAudioContext()
      if (!c) return
      try {
        const node = c.createGain()
        node.gain.value = 0
        c.createMediaElementSource(audio).connect(node)
        node.connect(c.destination)
        audio.volume = 1
        gains[key] = node
      } catch {
        /* already wired elsewhere or unsupported — element volume still works off iOS */
      }
    }

    const setLevel = (key: Track, audio: HTMLAudioElement, value: number) => {
      const node = gains[key]
      if (node) node.gain.value = value
      else audio.volume = value
    }

    const tryPlay = (key: Track, audio: HTMLAudioElement) => {
      if (!unlocked || audio.paused === false || playPending.has(key)) return
      wire(key, audio)
      playPending.add(key)
      void audio
        .play()
        .catch(() => {
          /* autoplay / not-ready — next gesture retries */
        })
        .finally(() => {
          playPending.delete(key)
        })
    }

    const resumeContext = () => {
      const c = sharedAudioContext()
      if (c && c.state !== "running" && c.state !== "closed") void c.resume().catch(() => {})
    }

    const step = (t: number) => {
      const dt = last ? t - last : 16
      last = t
      const { scene: current, muted: isMuted, volume: vol, visual: vis } = stateRef.current
      const playerGain = bgmPlayerGain(vol, isMuted, vis, hidden)
      let moving = false
      for (const key of allBgmTrackIds()) {
        const target = bgmTrackFadeTarget(key, current, hidden, playerGain)
        if (target === 0 && levels[key] === 0 && !tracks[key]) continue
        const audio = track(key)
        if (target > 0) tryPlay(key, audio)
        const nextLevel = bgmFadeStep(levels[key], target, dt)
        levels[key] = nextLevel
        setLevel(key, audio, bgmOutputLevel(nextLevel, playerGain))
        if (nextLevel === 0 && !audio.paused) audio.pause()
        if (nextLevel !== target) moving = true
      }
      raf = moving ? window.requestAnimationFrame(step) : 0
      if (!moving) last = 0
    }

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(step)
    }
    kickRef.current = kick

    const onGesture = () => {
      unlocked = true
      resumeContext()
      warmBgmTracks(allBgmTrackIds())
      kick()
    }

    const onVisibility = () => {
      hidden = document.visibilityState === "hidden"
      if (hidden) {
        for (const key of allBgmTrackIds()) {
          levels[key] = 0
          const audio = tracks[key]
          if (audio) {
            setLevel(key, audio, 0)
            audio.pause()
          }
        }
      } else {
        resumeContext()
        for (const key of allBgmTrackIds()) {
          const audio = tracks[key]
          if (audio && gains[key]) tryPlay(key, audio)
        }
      }
      kick()
    }

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onVisibility()
    }

    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    kick()
    return () => {
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
      if (raf) window.cancelAnimationFrame(raf)
      for (const audio of Object.values(tracks)) {
        audio.pause()
        audio.src = ""
      }
      for (const node of Object.values(gains)) node.disconnect()
      kickRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    stateRef.current = { scene, muted, volume, visual }
    warmBgmTracks(scene === "silent" ? ["hub"] : [scene])
    kickRef.current()
  }, [visual, scene, muted, volume])
}
