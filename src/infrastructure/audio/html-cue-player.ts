import type { ClickerCuePlayer } from "@/application/clicker-cue-player"
import { CUE_REGISTRY, cueUrl, cueVolume, type CueId } from "@/domain/services/clicker-audio-cues"
import { NO_LOOP_WISHES, dropLoop, loopsToRestart, wishLoop } from "@/domain/services/clicker-cue-loops"

/** Loop fade-out so a stopped hum/breath does not click. */
const LOOP_FADE_MS = 150

type Slot = { audio: HTMLAudioElement; lastAt: number; fade: ReturnType<typeof setInterval> | null }

/**
 * HTMLAudioElement-backed cue player. Nothing is created or fetched until the first pointer/key
 * gesture (browsers refuse autoplay before it; we do not even try), nothing plays while SFX are
 * muted or the tab is hidden, and a rejected play() is swallowed.
 */
export function createHtmlCuePlayer(): ClickerCuePlayer {
  const slots = new Map<CueId, Slot>()
  let muted = false
  let gesture = false
  /** Loops the game still wants; muting / a hidden tab silence them, they come back when sound is possible again. */
  let wishes = NO_LOOP_WISHES

  const onGesture = () => {
    gesture = true
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") silence()
    else resumeWished()
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", onGesture, true)
    window.addEventListener("keydown", onGesture, true)
    document.addEventListener("visibilitychange", onVisibility)
  }

  const canPlay = () => gesture && !muted && typeof document !== "undefined" && document.visibilityState !== "hidden"

  const slotFor = (id: CueId): Slot => {
    let slot = slots.get(id)
    if (!slot) {
      const audio = new Audio()
      audio.preload = "auto"
      audio.loop = CUE_REGISTRY[id].loop
      audio.src = cueUrl(id)
      slot = { audio, lastAt: -Infinity, fade: null }
      slots.set(id, slot)
    }
    return slot
  }

  const cancelFade = (slot: Slot) => {
    if (slot.fade !== null) {
      clearInterval(slot.fade)
      slot.fade = null
    }
  }

  const halt = (slot: Slot) => {
    cancelFade(slot)
    slot.audio.pause()
    try {
      slot.audio.currentTime = 0
    } catch {
      /* metadata not loaded yet */
    }
  }

  const start = (id: CueId) => {
    const slot = slotFor(id)
    cancelFade(slot)
    slot.audio.volume = cueVolume(id)
    void slot.audio.play().catch(() => {})
    return slot
  }

  /** Halts every sound but remembers the wanted loops. */
  function silence() {
    for (const slot of slots.values()) halt(slot)
  }

  /** Brings the still-wanted loops back (unmute, tab visible again). */
  function resumeWished() {
    for (const id of loopsToRestart(wishes, canPlay())) {
      const slot = slotFor(id)
      if (slot.audio.paused || slot.fade !== null) start(id)
    }
  }

  function stopAll() {
    wishes = NO_LOOP_WISHES
    silence()
  }

  return {
    play(id) {
      if (!canPlay() || CUE_REGISTRY[id].loop) return
      const slot = slotFor(id)
      const t = performance.now()
      if (t - slot.lastAt < (CUE_REGISTRY[id].minGapMs ?? 0)) return
      slot.lastAt = t
      try {
        slot.audio.currentTime = 0
      } catch {
        /* metadata not loaded yet */
      }
      start(id)
    },
    startLoop(id) {
      if (!CUE_REGISTRY[id].loop) return
      wishes = wishLoop(wishes, id)
      if (!canPlay()) return
      const slot = slotFor(id)
      if (!slot.audio.paused && slot.fade === null) return
      start(id)
    },
    stopLoop(id) {
      wishes = dropLoop(wishes, id)
      const slot = slots.get(id)
      if (!slot || slot.audio.paused || slot.fade !== null) return
      const from = slot.audio.volume
      const t0 = performance.now()
      slot.fade = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / LOOP_FADE_MS)
        slot.audio.volume = from * (1 - k)
        if (k >= 1) halt(slot)
      }, 30)
    },
    setMuted(value) {
      muted = value
      if (value) silence()
      else resumeWished()
    },
    stopAll,
  }
}
