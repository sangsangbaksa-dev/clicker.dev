"use client"

import { pickEndingVideoQuality, type EndingVideoId, type EndingVideoQuality } from "@/domain/services/clicker-ending-timeline"

/** Browser media for the ending: HQ videos (silent), their SFX v2 mixes and the ending score. */
export const ENDING_MEDIA = {
  video: {
    guardian_death: "/clicker/ending/ending_guardian_death_hq_v1.mp4",
    core_awaken: "/clicker/ending/ending_core_awaken_hq_v1.mp4",
  },
  /** 1280x720 twins (same lengths, silent) for narrow viewports and save-data. */
  videoMobile: {
    guardian_death: "/clicker/ending/ending_guardian_death_hq_v1_720p.mp4",
    core_awaken: "/clicker/ending/ending_core_awaken_hq_v1_720p.mp4",
  },
  poster: {
    guardian_death: "/clicker/bg/region_core_heart.jpg",
    core_awaken: "/clicker/bg/loading_core_awakening.webp",
  },
  sfx: {
    guardian_death: "/clicker/audio/sfx_ending_guardian_death_v2_norm.mp3",
    core_awaken: "/clicker/audio/sfx_ending_core_awaken_v2_norm.mp3",
  },
  bgm: "/clicker/audio/bgm_ending_v1.mp3",
} as const satisfies {
  video: Record<EndingVideoId, string>
  videoMobile: Record<EndingVideoId, string>
  poster: Record<EndingVideoId, string>
  sfx: Record<EndingVideoId, string>
  bgm: string
}

type ConnectionInfo = { saveData?: boolean; effectiveType?: string }

/** Reads viewport + connection hints and lets the pure rule choose the render (HQ on the server / when unknown). */
export function readEndingVideoQuality(): EndingVideoQuality {
  if (typeof window === "undefined") return "hq"
  const conn = (navigator as Navigator & { connection?: ConnectionInfo }).connection
  return pickEndingVideoQuality({ viewportWidth: window.innerWidth, saveData: conn?.saveData, effectiveType: conn?.effectiveType })
}

export function endingVideoSrc(video: EndingVideoId, quality: EndingVideoQuality): string {
  return quality === "mobile720" ? ENDING_MEDIA.videoMobile[video] : ENDING_MEDIA.video[video]
}

/** Ending score sits under the cards like the other BGM (see BGM_MASTER_LEVEL). */
export const ENDING_BGM_MASTER = 0.5

export type EndingTrack = {
  /** Start at `getTime()` seconds; if the browser blocks it, retry on the next pointer/key gesture. */
  startWhenAllowed(getTime: () => number): void
  pause(): void
  resume(getTime: () => number): void
  time(): number
  isPlaying(): boolean
  seek(s: number): void
  setLevel(level: number): void
  /** Fade out, then pause and release — keeps running after the owner is gone. */
  fadeOutAndStop(seconds: number): void
  /** Fade in to the current target level over `seconds` (after startWhenAllowed). */
  fadeIn(seconds: number): void
}

const sharedWarm = new Map<string, HTMLAudioElement>()
/** Warm the HTTP cache for the ending audio (no playback). */
export function preloadEndingAudio(urls: readonly string[]) {
  if (typeof window === "undefined") return
  for (const url of urls) {
    if (sharedWarm.has(url)) continue
    const a = new Audio()
    a.preload = "auto"
    a.src = url
    sharedWarm.set(url, a)
  }
}

export function createEndingTrack(url: string): EndingTrack {
  const el = new Audio(url)
  el.preload = "auto"
  let level = 1
  let fade = 0
  let gestureOff: (() => void) | null = null
  let disposed = false

  const clearFade = () => {
    if (fade) window.cancelAnimationFrame(fade)
    fade = 0
  }
  const apply = (v: number) => {
    el.volume = Math.min(1, Math.max(0, v))
  }
  const ramp = (from: number, to: number, seconds: number, done?: () => void) => {
    clearFade()
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = seconds <= 0 ? 1 : Math.min(1, (now - t0) / (seconds * 1000))
      apply(from + (to - from) * k)
      if (k < 1) fade = window.requestAnimationFrame(tick)
      else {
        fade = 0
        done?.()
      }
    }
    fade = window.requestAnimationFrame(tick)
  }
  const play = (getTime: () => number) => {
    if (disposed) return
    try {
      el.currentTime = Math.max(0, getTime())
    } catch {
      /* metadata not ready yet — starts from 0, drift correction fixes it */
    }
    void el.play().catch(() => {
      if (disposed || gestureOff) return
      const retry = () => {
        gestureOff?.()
        play(getTime)
      }
      window.addEventListener("pointerdown", retry, { once: true, capture: true })
      window.addEventListener("keydown", retry, { once: true, capture: true })
      gestureOff = () => {
        window.removeEventListener("pointerdown", retry, true)
        window.removeEventListener("keydown", retry, true)
        gestureOff = null
      }
    })
  }

  return {
    startWhenAllowed: play,
    resume: play,
    pause() {
      el.pause()
    },
    time: () => el.currentTime,
    isPlaying: () => !el.paused && !el.ended,
    seek(s) {
      try {
        el.currentTime = Math.max(0, s)
      } catch {
        /* ignore */
      }
    },
    setLevel(v) {
      level = v
      if (!fade) apply(v)
    },
    fadeIn(seconds) {
      apply(0)
      ramp(0, level, seconds)
    },
    fadeOutAndStop(seconds) {
      gestureOff?.()
      const finish = () => {
        disposed = true
        el.pause()
        el.removeAttribute("src")
        el.load()
      }
      if (el.paused) return finish()
      ramp(el.volume, 0, seconds, finish)
    },
  }
}
