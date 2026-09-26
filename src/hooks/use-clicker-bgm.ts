"use client"

import { useEffect, useRef } from "react"
import type { CoreVisual } from "@/domain/services/clicker-view"
import { sharedAudioContext } from "@/components/clicker/clicker-sfx"

/** Hub / mine loops plus the chamber cue for rebirth and ending. */
const BGM_SRC = {
  hub: "/clicker/audio/bgm_hub_v2.mp3",
  mine: "/clicker/audio/bgm_mine_v2.mp3",
  chamber: "/clicker/audio/bgm_chamber_v2.mp3",
} as const

type Track = keyof typeof BGM_SRC
export type BgmScene = Track | "silent"

/** Scene changes crossfade over this long instead of cutting. */
const FADE_MS = 900
/** Fever lifts the mix, crisis sits it back; neither changes pitch. */
const VISUAL_GAIN: Partial<Record<CoreVisual, number>> = { fever: 1.2, crisis: 0.75 }

/**
 * Looping BGM with crossfades between scenes. Fades out while the tab is hidden and
 * retries play on gesture until the browser allows it. Tracks load lazily on first use.
 *
 * Levels go through a Web Audio gain node once a gesture has unlocked the shared context:
 * iOS Safari ignores `HTMLMediaElement.volume`, so without it the volume slider, the
 * crossfades and the fever/crisis mix would all play at full volume on iPhone.
 */
export function useClickerBgm(
  visual: CoreVisual | undefined,
  { scene, muted, volume }: { scene: BgmScene; muted: boolean; volume: number },
) {
  const stateRef = useRef({ scene, gain: 0 })
  const kickRef = useRef<() => void>(() => {})

  useEffect(() => {
    const tracks: Partial<Record<Track, HTMLAudioElement>> = {}
    const gains: Partial<Record<Track, GainNode>> = {}
    const levels: Record<Track, number> = { hub: 0, mine: 0, chamber: 0 }
    let unlocked = false
    let hidden = document.visibilityState === "hidden"
    let raf = 0
    let last = 0

    const track = (key: Track) => {
      let audio = tracks[key]
      if (!audio) {
        audio = new Audio(BGM_SRC[key])
        audio.loop = true
        audio.volume = 0
        tracks[key] = audio
      }
      return audio
    }

    /** Route a track through a gain node (once). Falls back to element volume. */
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

    const step = (t: number) => {
      const dt = last ? t - last : 16
      last = t
      const { scene: current, gain } = stateRef.current
      let moving = false
      for (const key of Object.keys(levels) as Track[]) {
        const target = !hidden && gain > 0 && current === key ? 1 : 0
        if (target === 0 && levels[key] === 0 && !tracks[key]) continue
        const audio = track(key)
        if (target > 0 && audio.paused && unlocked) {
          wire(key, audio)
          void audio.play().catch(() => {
            /* autoplay / not-ready — next gesture retries */
          })
        }
        const delta = dt / FADE_MS
        const level =
          target > levels[key] ? Math.min(target, levels[key] + delta) : Math.max(target, levels[key] - delta)
        levels[key] = level
        setLevel(key, audio, Math.min(1, level * gain))
        if (level === 0 && !audio.paused) audio.pause()
        if (level !== target) moving = true
      }
      raf = moving ? window.requestAnimationFrame(step) : 0
      if (!moving) last = 0
    }

    const kick = () => {
      if (!raf) raf = window.requestAnimationFrame(step)
    }
    kickRef.current = kick

    // Keep listening: a failed first play (or mute-on-gesture) must keep retrying.
    // Capture phase: mine ore buttons stopPropagation() on pointerdown.
    const onGesture = () => {
      unlocked = true
      kick()
    }
    // rAF stalls in background tabs, so pause directly instead of fading.
    const onVisibility = () => {
      hidden = document.visibilityState === "hidden"
      if (hidden) {
        for (const key of Object.keys(levels) as Track[]) {
          levels[key] = 0
          tracks[key]?.pause()
        }
      }
      kick()
    }

    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
    kick()
    return () => {
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisibility)
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
    const gain = muted ? 0 : volume * (visual ? (VISUAL_GAIN[visual] ?? 1) : 1)
    stateRef.current = { scene, gain }
    kickRef.current()
  }, [visual, scene, muted, volume])
}
