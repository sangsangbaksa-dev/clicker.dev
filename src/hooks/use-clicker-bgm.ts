"use client"

import { useEffect, useRef } from "react"
import { BGM_LOOP_SECONDS } from "@/data/clicker/bgm-loops"
import type { CoreVisual } from "@/domain/services/clicker-view"

/**
 * Region loops come from scripts/clicker-bgm.py: each file is `loop + 1s` where the last
 * second repeats the first, so looping [LOOP_START, LOOP_START + loop) is seamless no
 * matter how much encoder delay the browser's MP3 decoder leaves at the front.
 */
const LOOP_START = 0.5
const regionLoop = (key: keyof typeof BGM_LOOP_SECONDS) => ({
  src: `/clicker/audio/bgm_${key}.mp3`,
  loop: BGM_LOOP_SECONDS[key] as number,
})
const BGM_TRACKS = {
  core_chamber: regionLoop("core_chamber"),
  signal_relay: regionLoop("signal_relay"),
  phase_vault: regionLoop("phase_vault"),
  storm_spire: regionLoop("storm_spire"),
  deep_fault: regionLoop("deep_fault"),
  drone_foundry: regionLoop("drone_foundry"),
  mine: regionLoop("mine"),
  /** Monster hunts: tense and heavy, deliberately not upbeat. */
  battle: regionLoop("battle"),
  /** Rebirth / ending cue — loops whole. */
  chamber: { src: "/clicker/audio/bgm_chamber.ogg", loop: 0 },
}

export type BgmTrack = keyof typeof BGM_TRACKS
export type BgmScene = BgmTrack | "silent"

/** Tracks tied to a scene, never to a region id. */
const SCENE_TRACKS: ReadonlySet<string> = new Set(["mine", "battle", "chamber"])

/** Each world has its own theme; unknown regions fall back to home. */
export function regionBgm(regionId: string | undefined): BgmTrack {
  return regionId && regionId in BGM_TRACKS && !SCENE_TRACKS.has(regionId) ? (regionId as BgmTrack) : "core_chamber"
}

/** Scene changes crossfade over roughly this long instead of cutting. */
const FADE_S = 3
/** Fever lifts the mix, crisis sits it back; neither changes pitch. */
const VISUAL_GAIN: Partial<Record<CoreVisual, number>> = { fever: 1.2, crisis: 0.75 }

type Voice = {
  gain: GainNode
  source: AudioBufferSourceNode | null
  buffer: AudioBuffer | null
  loading: boolean
  stopTimer: number
}

/**
 * Looping BGM on Web Audio with crossfades between scenes. Suspends while the tab is
 * hidden, and creates/resumes the context on the first gesture (autoplay policy).
 * Tracks load lazily and are released once they fade out.
 */
export function useClickerBgm(
  visual: CoreVisual | undefined,
  { scene, muted, volume }: { scene: BgmScene; muted: boolean; volume: number },
) {
  const stateRef = useRef({ scene, gain: 0 })
  const applyRef = useRef<() => void>(() => {})

  useEffect(() => {
    let ctx: AudioContext | null = null
    let master: GainNode | null = null
    let disposed = false
    const voices = new Map<BgmTrack, Voice>()

    const ensureContext = () => {
      if (ctx) return ctx
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      return ctx
    }

    const voiceFor = (c: AudioContext, key: BgmTrack) => {
      let v = voices.get(key)
      if (!v) {
        const gain = c.createGain()
        gain.gain.value = 0
        gain.connect(master!)
        v = { gain, source: null, buffer: null, loading: false, stopTimer: 0 }
        voices.set(key, v)
      }
      return v
    }

    const load = (c: AudioContext, key: BgmTrack, v: Voice) => {
      if (v.buffer || v.loading) return
      v.loading = true
      fetch(BGM_TRACKS[key].src)
        .then((res) => {
          if (!res.ok) throw new Error(`bgm ${res.status}`)
          return res.arrayBuffer()
        })
        .then((data) => c.decodeAudioData(data))
        .then((buffer) => {
          if (disposed || voices.get(key) !== v) return
          v.buffer = buffer
          apply()
        })
        .catch(() => {
          /* missing / undecodable — stay silent for this scene */
        })
        .finally(() => {
          v.loading = false
        })
    }

    const start = (c: AudioContext, key: BgmTrack, v: Voice) => {
      if (v.source || !v.buffer) return
      const source = c.createBufferSource()
      source.buffer = v.buffer
      source.loop = true
      const { loop } = BGM_TRACKS[key]
      if (loop > 0 && v.buffer.duration >= LOOP_START + loop) {
        source.loopStart = LOOP_START
        source.loopEnd = LOOP_START + loop
      }
      source.connect(v.gain)
      source.start()
      v.source = source
    }

    const release = (key: BgmTrack, v: Voice) => {
      v.source?.stop()
      v.source?.disconnect()
      v.gain.disconnect()
      voices.delete(key)
    }

    const apply = () => {
      const c = ctx
      if (!c || !master || disposed) return
      const { scene: current, gain } = stateRef.current
      const now = c.currentTime
      master.gain.setTargetAtTime(Math.min(1, gain), now, 0.12)
      const target = gain > 0 && current !== "silent" ? current : null

      if (target) {
        const v = voiceFor(c, target)
        window.clearTimeout(v.stopTimer)
        v.stopTimer = 0
        load(c, target, v)
        if (v.buffer) {
          start(c, target, v)
          v.gain.gain.cancelScheduledValues(now)
          v.gain.gain.setTargetAtTime(1, now, FADE_S / 3)
        }
      }
      for (const [key, v] of voices) {
        if (key === target || v.stopTimer) continue
        v.gain.gain.cancelScheduledValues(now)
        v.gain.gain.setTargetAtTime(0, now, FADE_S / 4)
        // Free the decoded buffer once it's inaudible; revisiting refetches from HTTP cache.
        v.stopTimer = window.setTimeout(() => release(key, v), FADE_S * 1000 * 1.6)
      }
    }
    applyRef.current = apply

    // Keep listening: a context created before the first gesture stays suspended.
    // Capture phase: mine ore buttons stopPropagation() on pointerdown.
    const onGesture = () => {
      const c = ensureContext()
      if (!c) return
      if (c.state === "suspended" && document.visibilityState === "visible") void c.resume()
      apply()
    }
    const onVisibility = () => {
      if (!ctx) return
      if (document.visibilityState === "hidden") void ctx.suspend()
      else void ctx.resume()
    }

    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      disposed = true
      window.removeEventListener("pointerdown", onGesture, true)
      window.removeEventListener("keydown", onGesture, true)
      document.removeEventListener("visibilitychange", onVisibility)
      for (const [key, v] of voices) {
        window.clearTimeout(v.stopTimer)
        release(key, v)
      }
      void ctx?.close()
      applyRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    const gain = muted ? 0 : volume * (visual ? (VISUAL_GAIN[visual] ?? 1) : 1)
    stateRef.current = { scene, gain }
    applyRef.current()
  }, [visual, scene, muted, volume])
}
