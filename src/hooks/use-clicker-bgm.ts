"use client"

import { useEffect, useRef } from "react"
import type { CoreVisual } from "@/domain/services/clicker-view"
import { sharedAudioContext } from "@/components/clicker/clicker-sfx"

/**
 * Hub / mine loops plus the chamber cue for rebirth and ending (scripts/clicker-bgm.py).
 * Each file is [PRE_ROLL][loop][PRE_ROLL]; `loop` is the exact loop length the script
 * prints, so playback loops sample-accurately whatever encoder delay the decoder keeps.
 */
const BGM = {
  hub: { src: "/clicker/audio/bgm_hub_v3.mp3", loop: 43.636372 },
  mine: { src: "/clicker/audio/bgm_mine_v3.mp3", loop: 60 },
  chamber: { src: "/clicker/audio/bgm_chamber_v3.mp3", loop: 53.333333 },
} as const
const PRE_ROLL = 0.5

type Track = keyof typeof BGM
export type BgmScene = Track | "silent"

/** Scene changes crossfade over this long instead of cutting. */
const FADE_S = 0.9
/** Volume / fever / crisis changes on the playing track follow quickly. */
const LEVEL_S = 0.15
/** Fever lifts the mix, crisis sits it back; neither changes pitch. */
const VISUAL_GAIN: Partial<Record<CoreVisual, number>> = { fever: 1.2, crisis: 0.75 }

type Channel = {
  gain: GainNode
  buffer: AudioBuffer | null
  loading: boolean
  source: AudioBufferSourceNode | null
}

/**
 * Looping BGM through Web Audio (the SFX context): gain nodes do the crossfades and volume,
 * which also works on iOS where `HTMLAudioElement.volume` is read-only, and the context is
 * unlocked inside the first gesture so iOS lets it play. Tracks load on first use.
 */
export function useClickerBgm(
  visual: CoreVisual | undefined,
  { scene, muted, volume }: { scene: BgmScene; muted: boolean; volume: number },
) {
  const stateRef = useRef({ scene, gain: 0 })
  const applyRef = useRef<() => void>(() => {})

  useEffect(() => {
    let ctx: AudioContext | null = null
    let disposed = false
    const channels: Partial<Record<Track, Channel>> = {}

    const channel = (c: AudioContext, key: Track): Channel => {
      let ch = channels[key]
      if (!ch) {
        const gain = c.createGain()
        gain.gain.value = 0
        gain.connect(c.destination)
        ch = { gain, buffer: null, loading: false, source: null }
        channels[key] = ch
      }
      return ch
    }

    const load = (c: AudioContext, key: Track, ch: Channel) => {
      if (ch.buffer || ch.loading) return
      ch.loading = true
      fetch(BGM[key].src)
        .then((res) => res.arrayBuffer())
        .then((data) => c.decodeAudioData(data))
        .then((buffer) => {
          ch.buffer = buffer
          if (!disposed) apply()
        })
        .catch(() => {
          /* offline / decode failure — stay silent, retry on a later scene change */
        })
        .finally(() => {
          ch.loading = false
        })
    }

    const apply = () => {
      if (!ctx || disposed) return
      const now = ctx.currentTime
      const { scene: current, gain } = stateRef.current
      for (const key of Object.keys(BGM) as Track[]) {
        const target = gain > 0 && current === key ? Math.min(1, gain) : 0
        if (target === 0 && !channels[key]) continue
        const ch = channel(ctx, key)
        const playing = ch.source !== null
        if (target > 0 && !ch.source) {
          if (!ch.buffer) {
            load(ctx, key, ch)
            continue
          }
          const src = ctx.createBufferSource()
          src.buffer = ch.buffer
          src.loop = true
          src.loopStart = PRE_ROLL
          src.loopEnd = PRE_ROLL + BGM[key].loop
          src.connect(ch.gain)
          src.start(now, PRE_ROLL)
          ch.source = src
        }
        const g = ch.gain.gain
        g.cancelScheduledValues(now)
        g.setValueAtTime(g.value, now)
        g.linearRampToValueAtTime(target, now + (playing && target > 0 ? LEVEL_S : FADE_S))
        if (target === 0 && ch.source) {
          // Let the fade finish, then free the source; coming back starts the loop fresh.
          ch.source.stop(now + FADE_S + 0.05)
          ch.source = null
        }
      }
    }
    applyRef.current = apply

    // The context must be created/resumed inside a gesture for iOS. Capture phase: the
    // mine ore buttons stopPropagation() on pointerdown.
    const onGesture = () => {
      if (!ctx) ctx = sharedAudioContext()
      else if (ctx.state !== "running") void ctx.resume()
      apply()
    }
    // Background tabs: freeze the music where it is and pick it back up on return.
    const onVisibility = () => {
      if (!ctx) return
      if (document.visibilityState === "hidden") void ctx.suspend()
      else void ctx.resume().then(apply, () => {})
    }

    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      disposed = true
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisibility)
      for (const ch of Object.values(channels)) {
        try {
          ch.source?.stop()
        } catch {
          /* already stopped */
        }
        ch.gain.disconnect()
      }
      applyRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    const gain = muted ? 0 : volume * (visual ? (VISUAL_GAIN[visual] ?? 1) : 1)
    stateRef.current = { scene, gain }
    applyRef.current()
  }, [visual, scene, muted, volume])
}
