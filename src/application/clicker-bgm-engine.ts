// Relative .ts imports (like other application modules with unit tests) so node:test can load the engine.
import {
  bgmFadeMsFor,
  bgmFadeStep,
  bgmMayTouchTrack,
  bgmOutputLevel,
  bgmPlayerGain,
  bgmTrackFadeTarget,
  bgmTracksToWarm,
  type BgmTrackId,
} from "../domain/services/clicker-bgm.ts"
import { bgmBed, type BgmBedPhase } from "../domain/services/clicker-bgm-tracks.ts"
import type { BgmEngineState, BgmLoopTrack, ClickerBgmPorts } from "./clicker-audio-ports.ts"

type Runtime = {
  tracks: Partial<Record<BgmTrackId, BgmLoopTrack>>
  levels: Record<BgmTrackId, number>
  playPending: Set<BgmTrackId>
  hidden: boolean
  raf: number
  last: number
  /** Phase of the active two-part bed (rebirth, mine entrance); "intro" for every other scene. */
  bed: BgmBedPhase
  rebirthIntroHooked: boolean
  /** The bed's lead-in started playing and its hand-over timer is armed (or has fired). */
  bedArmed: boolean
  bedTimer: ReturnType<typeof setTimeout> | 0
}

export function createClickerBgmEngine(ports: ClickerBgmPorts) {
  const levels = Object.fromEntries(ports.allTrackIds().map((id) => [id, 0])) as Record<BgmTrackId, number>
  const runtime: Runtime = {
    tracks: {},
    levels,
    playPending: new Set(),
    hidden: typeof document !== "undefined" ? document.visibilityState === "hidden" : false,
    raf: 0,
    last: 0,
    bed: "intro",
    rebirthIntroHooked: false,
    bedArmed: false,
    bedTimer: 0,
  }

  let state: BgmEngineState = {
    scene: "hub",
    muted: true,
    volume: 0,
    visual: undefined,
    hasUserGesture: false,
  }

  const allowNetwork = () => bgmMayTouchTrack(state.hasUserGesture, state.muted)

  const clearBedTimer = () => {
    if (runtime.bedTimer) clearTimeout(runtime.bedTimer)
    runtime.bedTimer = 0
  }

  /** Lead-in -> loop: the loop restarts from 0 and both tracks fade over the bed's hand-over length. */
  const advanceBed = () => {
    const bed = bgmBed(state.scene)
    if (!bed || runtime.bed === "loop") return
    clearBedTimer()
    runtime.bed = "loop"
    runtime.tracks[bed.loop]?.rewind?.()
    kick()
  }

  /** Timer beds (mine entrance): count from the moment the lead-in is playing. */
  const armBedTimer = (key: BgmTrackId) => {
    const bed = bgmBed(state.scene)
    if (!bed || key !== bed.intro || bed.advance.kind !== "timer" || runtime.bedArmed) return
    runtime.bedArmed = true
    runtime.bedTimer = setTimeout(() => {
      runtime.bedTimer = 0
      advanceBed()
    }, bed.advance.afterMs)
  }

  const tryPlay = (key: BgmTrackId, track: BgmLoopTrack) => {
    if (!state.hasUserGesture || runtime.playPending.has(key)) return
    ports.wireTrack(key, track)
    runtime.playPending.add(key)
    void track.play().finally(() => {
      runtime.playPending.delete(key)
      armBedTimer(key)
    })
  }

  const hookRebirthIntroEnded = (track: BgmLoopTrack) => {
    if (runtime.rebirthIntroHooked || !track.onEnded) return
    runtime.rebirthIntroHooked = true
    track.onEnded(() => {
      if (state.scene !== "rebirth") return
      advanceBed()
    })
  }

  const rewindAll = (ids: readonly BgmTrackId[]) => {
    for (const id of ids) runtime.tracks[id]?.rewind?.()
  }

  /** Leaving / entering a two-part bed: restart its tracks and forget the phase. */
  const switchBedScene = (prevScene: BgmEngineState["scene"]) => {
    const prev = bgmBed(prevScene)
    if (prev) rewindAll(prev.rewindOnLeave)
    clearBedTimer()
    runtime.bed = "intro"
    runtime.bedArmed = false
    const next = bgmBed(state.scene)
    if (next) {
      rewindAll(next.rewindOnEnter)
      const intro = runtime.tracks[next.intro]
      if (state.scene === "rebirth" && intro) hookRebirthIntroEnded(intro)
    }
  }

  const step = (t: number) => {
    const dt = runtime.last ? t - runtime.last : 16
    runtime.last = t
    const playerGain = bgmPlayerGain(state.volume, state.muted, state.visual, runtime.hidden)
    const mayTouch = allowNetwork()
    const fadeMs = bgmFadeMsFor(state.scene, runtime.bed)
    // A bed's loop is fetched while its lead-in plays, so the hand-over never waits on the network.
    const primed = runtime.hidden ? [] : bgmTracksToWarm(state.scene)
    let moving = false
    for (const key of ports.allTrackIds()) {
      const target = bgmTrackFadeTarget(key, state.scene, runtime.hidden, playerGain, runtime.bed)
      let track = runtime.tracks[key]
      if (!track) {
        if (target === 0 && !primed.includes(key)) continue
        if (!mayTouch) continue
        const acquired = ports.acquireTrack(key, true)
        if (!acquired) continue
        track = acquired
        runtime.tracks[key] = track
        if (key === "rebirthIntro") hookRebirthIntroEnded(track)
        if (target === 0) track.preload?.()
      }
      if (target > 0 && mayTouch) tryPlay(key, track)
      const nextLevel = bgmFadeStep(runtime.levels[key], target, dt, fadeMs)
      runtime.levels[key] = nextLevel
      track.setOutputLevel(bgmOutputLevel(nextLevel, playerGain))
      if (nextLevel === 0) track.pause()
      if (nextLevel !== target) moving = true
    }
    runtime.raf = moving ? window.requestAnimationFrame(step) : 0
    if (!moving) runtime.last = 0
  }

  const kick = () => {
    if (!runtime.raf) runtime.raf = window.requestAnimationFrame(step)
  }

  const warmForScene = () => {
    ports.warmTracks(bgmTracksToWarm(state.scene), allowNetwork())
  }

  return {
    setState(next: Omit<BgmEngineState, "hasUserGesture"> & { hasUserGesture?: boolean }) {
      const prevScene = state.scene
      const sceneChanged = next.scene !== undefined && next.scene !== state.scene
      state = {
        ...state,
        ...next,
        hasUserGesture: next.hasUserGesture ?? state.hasUserGesture,
      }
      if (sceneChanged) {
        switchBedScene(prevScene)
        warmForScene()
      }
      kick()
    },
    onUserGesture() {
      state = { ...state, hasUserGesture: true }
      ports.resumeSharedContext()
      warmForScene()
      kick()
    },
    onVisibility(hidden: boolean) {
      runtime.hidden = hidden
      if (hidden) {
        for (const key of ports.allTrackIds()) {
          runtime.levels[key] = 0
          const track = runtime.tracks[key]
          if (track) {
            track.setOutputLevel(0)
            track.pause()
          }
        }
      } else {
        ports.resumeSharedContext()
        for (const key of ports.allTrackIds()) {
          const track = runtime.tracks[key]
          if (track && ports.hasGainNode(key)) tryPlay(key, track)
        }
      }
      kick()
    },
    dispose() {
      clearBedTimer()
      if (runtime.raf) window.cancelAnimationFrame(runtime.raf)
      for (const track of Object.values(runtime.tracks)) track.pause()
      runtime.tracks = {}
      ports.dispose()
    },
  }
}
